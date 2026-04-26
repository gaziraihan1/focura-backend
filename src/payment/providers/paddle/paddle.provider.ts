// backend/src/payment/providers/paddle/paddle.provider.ts

import {
  EventName,
  type SubscriptionCreatedEvent,
  type SubscriptionUpdatedEvent,
  type SubscriptionCanceledEvent,
  type SubscriptionTrialingEvent,
  type TransactionBilledEvent,
  type TransactionCompletedEvent,
  type TransactionCreatedEvent,
  type TransactionPaymentFailedEvent,
  type TransactionUpdatedEvent,
} from '@paddle/paddle-node-sdk';

import { BillingCycle } from '@prisma/client';

import type {
  IPaymentProvider,
  CreateCustomerParams,
  CreateCheckoutParams,
  CreatePortalParams,
  ChangePlanParams,
  CancelSubscriptionParams,
  ReactivateSubscriptionParams,
  CustomerResult,
  CheckoutResult,
  PortalResult,
  NormalisedSubscriptionEvent,
  NormalisedInvoiceEvent,
  NormalisedSubStatus,
  NormalisedInvoiceStatus,
} from '../../IpaymentProvider.js';

import {
  getPaddle,
  getPaddleWebhookSecret,
  PADDLE_PRICE_IDS,
  PADDLE_PRICE_TO_PLAN,
} from '../../../modules/billing/config/paddle.js';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type PaddleItem = {
  priceId: string;
  quantity?: number;
};

// ─────────────────────────────────────────────────────────────
// Status maps
// ─────────────────────────────────────────────────────────────

function mapSubStatus(status: string): NormalisedSubStatus {
  const map: Record<string, NormalisedSubStatus> = {
    active: 'ACTIVE',
    canceled: 'CANCELED',
    past_due: 'PAST_DUE',
    paused: 'PAUSED',
    trialing: 'TRIALING',
  };
  return map[status] ?? 'INCOMPLETE';
}

function mapInvoiceStatus(status: string): NormalisedInvoiceStatus {
  const map: Record<string, NormalisedInvoiceStatus> = {
    draft: 'DRAFT',
    ready: 'OPEN',
    billed: 'OPEN',
    paid: 'PAID',
    completed: 'PAID',
    canceled: 'VOID',
    past_due: 'UNCOLLECTIBLE',
  };
  return map[status] ?? 'DRAFT';
}

function mapBillingCycle(interval?: string): BillingCycle {
  return interval === 'year' ? 'YEARLY' : 'MONTHLY';
}

// ─────────────────────────────────────────────────────────────

function resolvePriceId(planName: string, billingCycle: BillingCycle): string {
  const prices = PADDLE_PRICE_IDS[planName];

  if (!prices) {
    throw new Error(`[PaddleProvider] No price config for plan: ${planName}`);
  }

  const priceId =
    billingCycle === 'YEARLY' ? prices.yearly : prices.monthly;

  if (!priceId) {
    throw new Error(`[PaddleProvider] Missing price ID for ${planName}`);
  }

  return priceId;
}

function toDate(value?: string | null, fallback = new Date()): Date {
  if (!value) return fallback;
  const d = new Date(value);
  return isNaN(d.getTime()) ? fallback : d;
}

// ─────────────────────────────────────────────────────────────

export class PaddleProvider implements IPaymentProvider {
  readonly name = 'paddle';

  // ── Customer ───────────────────────────────────────────────

  async createCustomer(params: CreateCustomerParams): Promise<CustomerResult> {
    const paddle = getPaddle();

    const customer = await paddle.customers.create({
      email: params.email,
      name: params.name,
      customData: params.metadata,
    });

    return { providerCustomerId: customer.id };
  }

  // ── Checkout ───────────────────────────────────────────────

  async createCheckoutSession(
    params: CreateCheckoutParams
  ): Promise<CheckoutResult> {
    const paddle = getPaddle();

    const priceId = resolvePriceId(
      params.planName,
      params.billingCycle
    );

    const txn = await paddle.transactions.create({
      customerId: params.providerCustomerId,
      items: [{ priceId, quantity: 1 }],
      checkout: { url: params.successUrl },
      customData: {
        workspaceId: params.workspaceId,
        ownerId: params.ownerId,
        planName: params.planName,
        billingCycle: params.billingCycle,
      },
    });

    const url = txn.checkout?.url;
    if (!url) throw new Error('Missing checkout URL');

    return { url };
  }

  // ── Portal ────────────────────────────────────────────────

  async createPortalSession(
    params: CreatePortalParams
  ): Promise<PortalResult> {
    const paddle = getPaddle();

    const session = await paddle.customerPortalSessions.create(
      params.providerCustomerId,
      []
    );

    const url = session.urls?.general?.overview;
    if (!url) throw new Error('Missing portal URL');

    return { url };
  }

  // ── Change Plan ───────────────────────────────────────────

  async changePlan(params: ChangePlanParams): Promise<void> {
    const paddle = getPaddle();

    const sub = await paddle.subscriptions.get(
      params.providerSubscriptionId
    );

    const updatedItems: PaddleItem[] = (sub.items ?? []).map(
      (item: { quantity?: number }) => ({
        priceId: params.newProviderPriceId,
        quantity: item.quantity ?? 1,
      })
    );

    await paddle.subscriptions.update(params.providerSubscriptionId, {
      items: updatedItems,
    });
  }

  // ── Cancel ────────────────────────────────────────────────

  async cancelSubscription(
    params: CancelSubscriptionParams
  ): Promise<void> {
    const paddle = getPaddle();

    await paddle.subscriptions.cancel(params.providerSubscriptionId, {
      effectiveFrom: params.immediately
        ? 'immediately'
        : 'next_billing_period',
    });
  }

  // ── Reactivate ────────────────────────────────────────────

  async reactivateSubscription(
    params: ReactivateSubscriptionParams
  ): Promise<void> {
    const paddle = getPaddle();

    await paddle.subscriptions.update(params.providerSubscriptionId, {
      scheduledChange: null,
    });
  }

  // ── Webhook ───────────────────────────────────────────────

  async verifyAndParseWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>
  ): Promise<
    NormalisedSubscriptionEvent | NormalisedInvoiceEvent | null
  > {
    const paddle = getPaddle();
    const secret = getPaddleWebhookSecret();

    const sig = headers['paddle-signature'];
    const sigStr = Array.isArray(sig) ? sig[0] : sig ?? '';

    if (!sigStr) throw new Error('Missing signature');

    const event = await paddle.webhooks.unmarshal(
      rawBody.toString(),
      secret,
      sigStr
    );

    if (!event) return null;

    const eventId = event.eventId;

    switch (event.eventType) {
      case EventName.SubscriptionCreated: {
        const data = (event as SubscriptionCreatedEvent).data;

        return {
          type: 'SUBSCRIPTION_CREATED',
          providerEventId: eventId,
          providerSubscriptionId: data.id,
          providerCustomerId: data.customerId,
          providerPriceId: data.items?.[0]?.price?.id ?? '',
          planName:
            PADDLE_PRICE_TO_PLAN.get(
              data.items?.[0]?.price?.id ?? ''
            )?.planName ?? 'PRO',
          status: mapSubStatus(data.status),
          billingCycle: mapBillingCycle(
            data.items?.[0]?.price?.billingCycle?.interval
          ),
          currentPeriodStart: toDate(
            data.currentBillingPeriod?.startsAt
          ),
          currentPeriodEnd: toDate(
            data.currentBillingPeriod?.endsAt
          ),
          cancelAtPeriodEnd: false,
          canceledAt: null,
          trialStart: null,
          trialEnd: null,
          metadata: data.customData ?? {},
          raw: event,
        };
      }

      default:
        return null;
    }
  }
}