// backend/src/payment/providers/paddle/paddle.provider.ts
//
// Paddle Billing provider — @paddle/paddle-node-sdk ^3.8.0
// Paddle Billing is merchant-of-record: tax, VAT, invoicing all handled by Paddle.
// Stripe stays in place; switch via PAYMENT_PROVIDER=paddle in .env.
// ─────────────────────────────────────────────────────────────────────────────

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
  paddle,
  PADDLE_PRICE_IDS,
  PADDLE_PRICE_TO_PLAN,
  PADDLE_WEBHOOK_SECRET,
} from '../../../modules/billing/config/paddle.js';

// ---------------------------------------------------------------------------
// Webhook event data types — SDK uses *Event wrappers for webhook payloads.
// The .data field on each event is the entity payload (matches entity shape
// but typed separately in the SDK).
// ---------------------------------------------------------------------------

type AnySubEventData =
  | SubscriptionCreatedEvent['data']
  | SubscriptionUpdatedEvent['data']
  | SubscriptionCanceledEvent['data']
  | SubscriptionTrialingEvent['data'];

type AnyTxnEventData =
  | TransactionCompletedEvent['data']
  | TransactionPaymentFailedEvent['data']
  | TransactionCreatedEvent['data']
  | TransactionUpdatedEvent['data']
  | TransactionBilledEvent['data'];

// ---------------------------------------------------------------------------
// Status maps
// ---------------------------------------------------------------------------

function mapSubStatus(status: string): NormalisedSubStatus {
  const map: Record<string, NormalisedSubStatus> = {
    active:   'ACTIVE',
    canceled: 'CANCELED',
    past_due: 'PAST_DUE',
    paused:   'PAUSED',
    trialing: 'TRIALING',
  };
  return map[status] ?? 'INCOMPLETE';
}

function mapInvoiceStatus(status: string): NormalisedInvoiceStatus {
  const map: Record<string, NormalisedInvoiceStatus> = {
    draft:     'DRAFT',
    ready:     'OPEN',
    billed:    'OPEN',
    paid:      'PAID',
    completed: 'PAID',
    canceled:  'VOID',
    past_due:  'UNCOLLECTIBLE',
  };
  return map[status] ?? 'DRAFT';
}

function mapBillingCycle(interval: string | undefined): BillingCycle {
  return interval === 'year' ? 'YEARLY' : 'MONTHLY';
}

// ---------------------------------------------------------------------------
// Price ID resolver
// ---------------------------------------------------------------------------

function resolvePriceId(planName: string, billingCycle: BillingCycle): string {
  const prices = PADDLE_PRICE_IDS[planName];
  if (!prices) throw new Error(`[PaddleProvider] No price config for plan: ${planName}`);

  const priceId = billingCycle === 'YEARLY' ? prices.yearly : prices.monthly;
  if (!priceId) {
    throw new Error(`[PaddleProvider] Missing env var PADDLE_PRICE_${planName}_${billingCycle}`);
  }
  return priceId;
}

// ---------------------------------------------------------------------------
// Safe date helper
// ---------------------------------------------------------------------------

function toDate(value: string | null | undefined, fallback = new Date()): Date {
  if (!value) return fallback;
  const d = new Date(value);
  return isNaN(d.getTime()) ? fallback : d;
}

// ---------------------------------------------------------------------------
// Subscription event data → NormalisedSubscriptionEvent fields
// Subscription entity fields confirmed from SDK source:
//   canceledAt, scheduledChange, currentBillingPeriod, customData, items
// No trialDates on Subscription — trial end is stored in scheduledChange
// for trialing subs; we read nextBilledAt as the trial end boundary.
// ---------------------------------------------------------------------------

function buildSubFields(
  sub: AnySubEventData,
  eventId: string,
  raw: unknown,
): Omit<NormalisedSubscriptionEvent, 'type'> {
  const firstItem  = sub.items?.[0];
  const priceId    = firstItem?.price?.id ?? '';
  const planMeta   = PADDLE_PRICE_TO_PLAN.get(priceId);
  const interval   = firstItem?.price?.billingCycle?.interval;
  const customData = (sub.customData ?? {}) as Record<string, string>;

  // Paddle surfaces trial end as nextBilledAt when status === 'trialing'
  const trialEnd =
    sub.status === 'trialing' && sub.nextBilledAt
      ? toDate(sub.nextBilledAt)
      : null;

  return {
    providerEventId:        eventId,
    providerSubscriptionId: sub.id,
    providerCustomerId:     sub.customerId,
    providerPriceId:        priceId,
    planName:               planMeta?.planName ?? customData.planName ?? 'PRO',
    status:                 mapSubStatus(sub.status),
    billingCycle:           mapBillingCycle(interval),
    currentPeriodStart:     toDate(sub.currentBillingPeriod?.startsAt),
    currentPeriodEnd:       toDate(
      sub.currentBillingPeriod?.endsAt,
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    ),
    cancelAtPeriodEnd: sub.scheduledChange?.action === 'cancel',
    canceledAt:        sub.canceledAt ? toDate(sub.canceledAt) : null,
    trialStart:        null, // not exposed in Paddle webhook subscription payload
    trialEnd,
    metadata:          customData,
    raw,
  };
}

// ---------------------------------------------------------------------------
// PaddleProvider
// ---------------------------------------------------------------------------

export class PaddleProvider implements IPaymentProvider {
  readonly name = 'paddle';

  // ── Customer ──────────────────────────────────────────────────────────────

  async createCustomer(params: CreateCustomerParams): Promise<CustomerResult> {
    const customer = await paddle.customers.create({
      email:      params.email,
      name:       params.name,
      customData: params.metadata,
    });
    return { providerCustomerId: customer.id };
  }

  // ── Checkout ──────────────────────────────────────────────────────────────
  // Paddle uses Transactions for hosted checkout.
  // customData carries workspaceId + ownerId so webhooks can provision correctly.

  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutResult> {
    const priceId = resolvePriceId(params.planName, params.billingCycle);

    const transaction = await paddle.transactions.create({
      customerId: params.providerCustomerId,
      items:      [{ priceId, quantity: 1 }],
      checkout:   { url: params.successUrl },
      customData: {
        workspaceId:  params.workspaceId,
        ownerId:      params.ownerId,
        planName:     params.planName,
        billingCycle: params.billingCycle,
      },
    });

    const url = transaction.checkout?.url;
    if (!url) throw new Error('[PaddleProvider] Paddle returned no checkout URL');

    return { url };
  }

  // ── Portal ────────────────────────────────────────────────────────────────

  async createPortalSession(params: CreatePortalParams): Promise<PortalResult> {
    const session = await paddle.customerPortalSessions.create(
      params.providerCustomerId,
      [],
    );

    const url = session.urls?.general?.overview;
    if (!url) throw new Error('[PaddleProvider] Paddle returned no portal URL');

    return { url };
  }

  // ── Plan change ───────────────────────────────────────────────────────────

  async changePlan(params: ChangePlanParams): Promise<void> {
    const sub = await paddle.subscriptions.get(params.providerSubscriptionId);

    // Paddle requires the full items array — replace all items with new price
    const updatedItems = (sub.items ?? []).map((item) => ({
      priceId:  params.newProviderPriceId,
      quantity: item.quantity ?? 1,
    }));

    await paddle.subscriptions.update(params.providerSubscriptionId, {
      items:               updatedItems,
      prorationBillingMode: params.isUpgrade
        ? 'prorated_immediately'
        : 'prorated_next_billing_period',
      customData: params.metadata,
    });
  }

  // ── Cancel ────────────────────────────────────────────────────────────────

  async cancelSubscription(params: CancelSubscriptionParams): Promise<void> {
    await paddle.subscriptions.cancel(params.providerSubscriptionId, {
      effectiveFrom: params.immediately ? 'immediately' : 'next_billing_period',
    });
  }

  // ── Reactivate ────────────────────────────────────────────────────────────
  // Clears a scheduled cancellation — subscription continues as normal.

  async reactivateSubscription(params: ReactivateSubscriptionParams): Promise<void> {
    await paddle.subscriptions.update(params.providerSubscriptionId, {
      scheduledChange: null,
    });
  }

  // ── Webhook ───────────────────────────────────────────────────────────────

  async verifyAndParseWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<NormalisedSubscriptionEvent | NormalisedInvoiceEvent | null> {
    const sig = headers['paddle-signature'];
    const sigStr = Array.isArray(sig) ? sig[0] : (sig ?? '');

    if (!sigStr)              throw new Error('[PaddleProvider] Missing paddle-signature header');
    if (!PADDLE_WEBHOOK_SECRET) throw new Error('[PaddleProvider] PADDLE_WEBHOOK_SECRET not set');

    const event = await paddle.webhooks.unmarshal(
      rawBody.toString('utf-8'),
      PADDLE_WEBHOOK_SECRET,
      sigStr,
    );

    if (!event) throw new Error('[PaddleProvider] Invalid Paddle webhook signature');

    const eventId = event.eventId;

    switch (event.eventType) {

      case EventName.SubscriptionCreated: {
        const data = (event as SubscriptionCreatedEvent).data;
        return { type: 'SUBSCRIPTION_CREATED', ...buildSubFields(data, eventId, event) };
      }

      case EventName.SubscriptionUpdated: {
        const data = (event as SubscriptionUpdatedEvent).data;
        return { type: 'SUBSCRIPTION_UPDATED', ...buildSubFields(data, eventId, event) };
      }

      case EventName.SubscriptionCanceled: {
        const data = (event as SubscriptionCanceledEvent).data;
        return { type: 'SUBSCRIPTION_CANCELED', ...buildSubFields(data, eventId, event) };
      }

      // SubscriptionTrialing fires when a subscription enters trial status.
      // Maps to SUBSCRIPTION_TRIAL_ENDING in our normalised type so the handler
      // can send "trial ending" emails — adjust mapping if you add TRIAL_STARTED.
      case EventName.SubscriptionTrialing: {
        const data = (event as SubscriptionTrialingEvent).data;
        return { type: 'SUBSCRIPTION_TRIAL_ENDING', ...buildSubFields(data, eventId, event) };
      }

      case EventName.TransactionCompleted: {
        const data = (event as TransactionCompletedEvent).data;
        return this.normaliseTxnAsInvoice('INVOICE_PAID', data, eventId, event);
      }

      case EventName.TransactionPaymentFailed: {
        const data = (event as TransactionPaymentFailedEvent).data;
        return this.normaliseTxnAsInvoice('INVOICE_PAYMENT_FAILED', data, eventId, event);
      }

      case EventName.TransactionCreated: {
        const data = (event as TransactionCreatedEvent).data;
        return this.normaliseTxnAsInvoice('INVOICE_CREATED', data, eventId, event);
      }

      case EventName.TransactionUpdated: {
        const data = (event as TransactionUpdatedEvent).data;
        return this.normaliseTxnAsInvoice('INVOICE_UPDATED', data, eventId, event);
      }

      // TransactionBilled = checkout completed + subscription provisioned.
      // Maps to CHECKOUT_COMPLETED so handleCheckoutCompleted() fires.
      case EventName.TransactionBilled: {
        const data       = (event as TransactionBilledEvent).data;
        const customData = (data.customData ?? {}) as Record<string, string>;
        const priceId    = data.items?.[0]?.price?.id ?? '';
        const planMeta   = PADDLE_PRICE_TO_PLAN.get(priceId);
        const interval   = data.items?.[0]?.price?.billingCycle?.interval;

        return {
          type:                   'CHECKOUT_COMPLETED',
          providerEventId:        eventId,
          providerSubscriptionId: data.subscriptionId ?? '',
          providerCustomerId:     data.customerId ?? '',
          providerPriceId:        priceId,
          planName:               planMeta?.planName ?? customData.planName ?? 'PRO',
          status:                 'ACTIVE',
          billingCycle:           mapBillingCycle(interval),
          currentPeriodStart:     toDate(data.billingPeriod?.startsAt),
          currentPeriodEnd:       toDate(data.billingPeriod?.endsAt),
          cancelAtPeriodEnd:      false,
          canceledAt:             null,
          trialStart:             null,
          trialEnd:               null,
          metadata:               customData,
          raw:                    event,
        } satisfies NormalisedSubscriptionEvent;
      }

      default:
        console.log(`[PaddleProvider] Unhandled event type: ${event.eventType}`);
        return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Private: Paddle Transaction event data → NormalisedInvoiceEvent
  //
  // Transaction.invoiceId = Paddle invoice ID (inv_xxx) — not a PDF URL.
  // PDF URL must be fetched on-demand via paddle.invoices.getPdf(invoiceId).
  // We store invoiceId in invoiceNumber so billing.service can fetch it later.
  // ---------------------------------------------------------------------------

  private normaliseTxnAsInvoice(
    type:    NormalisedInvoiceEvent['type'],
    txn:     AnyTxnEventData,
    eventId: string,
    raw:     unknown,
  ): NormalisedInvoiceEvent {
    const customData = (txn.customData ?? {}) as Record<string, string>;
    const totals     = txn.details?.totals;

    const amountDue       = Number(totals?.total ?? 0);
    // Use the last successful payment amount; fall back to 0
    const lastPayment     = txn.payments?.[txn.payments.length - 1];
    const amountPaid      = lastPayment?.amount ? Number(lastPayment.amount) : 0;
    const amountRemaining = Math.max(0, amountDue - amountPaid);
    const paidAt          = lastPayment?.capturedAt ? toDate(lastPayment.capturedAt) : null;

    const paymentMethod     = lastPayment?.methodDetails;
    const paymentMethodType = paymentMethod?.type ?? null;
    const cardLast4         = paymentMethod?.card?.last4 ?? null;

   const lineItems = (txn.details?.lineItems ?? []).map((li) => ({
  description: li.product?.name ?? '',
  amount:      Number(li.totals?.total ?? 0),
  currency:    txn.currencyCode,
  priceId:     li.priceId ?? null,
}));
    return {
      type,
      providerEventId:        eventId,
      providerInvoiceId:      txn.id,
      providerCustomerId:     txn.customerId ?? null,
      providerSubscriptionId: txn.subscriptionId ?? null,
      providerPaymentId:      lastPayment?.paymentAttemptId ?? null,
      amountDue,
      amountPaid,
      amountRemaining,
      currency:               (txn.currencyCode ?? 'USD').toLowerCase(),
      status:                 mapInvoiceStatus(txn.status),
      // invoiceNumber holds Paddle's human-readable number if available,
      // otherwise we store invoiceId so the service can fetch the PDF later.
      invoiceNumber:          txn.invoiceNumber ?? txn.invoiceId ?? null,
      invoicePdfUrl:          null, // fetched on-demand: paddle.invoices.getPdf(invoiceId)
      hostedInvoiceUrl:       null, // Paddle has no hosted invoice URL
      periodStart:            txn.billingPeriod?.startsAt ? toDate(txn.billingPeriod.startsAt) : null,
      periodEnd:              txn.billingPeriod?.endsAt   ? toDate(txn.billingPeriod.endsAt)   : null,
      dueDate:                null,
      paidAt,
      attemptCount:           txn.payments?.length ?? 0,
      paymentMethodType,
      cardLast4,
      lineItems,
      metadata:               customData,
      raw,
    };
  }
}