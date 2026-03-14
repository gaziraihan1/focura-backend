// backend/src/payment/providers/paddle/paddle.provider.ts
//
// Paddle implementation stub.
// Fill in each method when you're ready to switch — the interface guarantees
// BillingService and all callers will work without any other changes.
//
// Paddle SDK: npm install @paddle/paddle-node-sdk
// Docs: https://developer.paddle.com/
// ─────────────────────────────────────────────────────────────────────────────

// import { Paddle } from '@paddle/paddle-node-sdk';
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
import { BillingCycle } from '@prisma/client';

// ---------------------------------------------------------------------------
// Paddle client (uncomment when ready)
// ---------------------------------------------------------------------------

// const paddle = new Paddle(process.env.PADDLE_API_KEY!, {
//   environment: process.env.PADDLE_ENV === 'production' ? 'production' : 'sandbox',
// });

const PADDLE_WEBHOOK_SECRET = process.env.PADDLE_WEBHOOK_SECRET!;

// ---------------------------------------------------------------------------
// Paddle status → normalised status map
// Paddle subscription statuses: active | canceled | past_due | paused | trialing
// ---------------------------------------------------------------------------

function mapPaddleSubStatus(status: string): NormalisedSubStatus {
  const map: Record<string, NormalisedSubStatus> = {
    active:    'ACTIVE',
    canceled:  'CANCELED',
    past_due:  'PAST_DUE',
    paused:    'PAUSED',
    trialing:  'TRIALING',
  };
  return map[status] ?? 'INCOMPLETE';
}

function mapPaddleInvoiceStatus(status: string): NormalisedInvoiceStatus {
  const map: Record<string, NormalisedInvoiceStatus> = {
    billed:   'OPEN',
    paid:     'PAID',
    canceled: 'VOID',
    past_due: 'UNCOLLECTIBLE',
  };
  return map[status] ?? 'DRAFT';
}

function mapPaddleBillingCycle(interval: string): BillingCycle {
  return interval === 'year' ? 'YEARLY' : 'MONTHLY';
}

// ---------------------------------------------------------------------------
// Paddle provider implementation
// ---------------------------------------------------------------------------

export class PaddleProvider implements IPaymentProvider {
  readonly name = 'paddle';

  // ---- Customer ------------------------------------------------------------
  // NOTE: Paddle uses its own customer management via checkout.
  // Customers are auto-created on first purchase. You can also create them
  // explicitly via the Customers API.

  async createCustomer(params: CreateCustomerParams): Promise<CustomerResult> {
    // TODO: implement when switching to Paddle
    // const customer = await paddle.customers.create({
    //   email:  params.email,
    //   name:   params.name,
    //   customData: params.metadata,
    // });
    // return { providerCustomerId: customer.id };

    throw new Error('[PaddleProvider] createCustomer not yet implemented');
  }

  // ---- Checkout ------------------------------------------------------------
  // Paddle uses client-side overlay checkout or hosted checkout links.
  // For hosted checkout (closest to Stripe Checkout), use Transactions API.

  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutResult> {
    // TODO: implement when switching to Paddle
    // Paddle price IDs follow the same env var convention:
    //   PADDLE_PRICE_PRO_MONTHLY, PADDLE_PRICE_PRO_YEARLY, etc.
    //
    // const priceEnvKey = `PADDLE_PRICE_${params.planName}_${params.billingCycle}`;
    // const priceId     = process.env[priceEnvKey];
    // if (!priceId) throw new Error(`[PaddleProvider] No price for ${priceEnvKey}`);
    //
    // const transaction = await paddle.transactions.create({
    //   items: [{ priceId, quantity: 1 }],
    //   customerId: params.providerCustomerId,
    //   customData: params.metadata,
    //   checkout: {
    //     url: params.successUrl,
    //   },
    // });
    //
    // return { url: transaction.checkout!.url! };

    throw new Error('[PaddleProvider] createCheckoutSession not yet implemented');
  }

  // ---- Portal --------------------------------------------------------------
  // Paddle has a Customer Portal. You get a portal session URL via the API.

  async createPortalSession(params: CreatePortalParams): Promise<PortalResult> {
    // TODO: implement when switching to Paddle
    // const session = await paddle.customerPortalSessions.create({
    //   customerId: params.providerCustomerId,
    // });
    // return { url: session.urls.general.overview };

    throw new Error('[PaddleProvider] createPortalSession not yet implemented');
  }

  // ---- Plan change ---------------------------------------------------------
  // Paddle calls this "updating a subscription". Proration is handled via
  // the `prorationBillingMode` field.

  async changePlan(params: ChangePlanParams): Promise<void> {
    // TODO: implement when switching to Paddle
    // await paddle.subscriptions.update(params.providerSubscriptionId, {
    //   items: [{ priceId: params.newProviderPriceId, quantity: 1 }],
    //   prorationBillingMode: params.isUpgrade ? 'full_immediately' : 'do_not_bill',
    //   customData: params.metadata,
    // });

    throw new Error('[PaddleProvider] changePlan not yet implemented');
  }

  // ---- Cancel --------------------------------------------------------------

  async cancelSubscription(params: CancelSubscriptionParams): Promise<void> {
    // TODO: implement when switching to Paddle
    // await paddle.subscriptions.cancel(params.providerSubscriptionId, {
    //   effectiveFrom: params.immediately ? 'immediately' : 'next_billing_period',
    // });

    throw new Error('[PaddleProvider] cancelSubscription not yet implemented');
  }

  // ---- Reactivate ----------------------------------------------------------

  async reactivateSubscription(params: ReactivateSubscriptionParams): Promise<void> {
    // TODO: implement when switching to Paddle
    // await paddle.subscriptions.activate(params.providerSubscriptionId);

    throw new Error('[PaddleProvider] reactivateSubscription not yet implemented');
  }

  // ---- Webhook -------------------------------------------------------------
  // Paddle sends webhook notifications signed with HMAC-SHA256.

  async verifyAndParseWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<NormalisedSubscriptionEvent | NormalisedInvoiceEvent | null> {
    // TODO: implement when switching to Paddle
    //
    // 1. Verify signature:
    //    const signature = headers['paddle-signature'] as string;
    //    const isValid   = paddle.webhooks.isSignatureValid(rawBody, signature, PADDLE_WEBHOOK_SECRET);
    //    if (!isValid) throw new Error('[PaddleProvider] Invalid webhook signature');
    //
    // 2. Parse event:
    //    const event = JSON.parse(rawBody.toString());
    //
    // 3. Map Paddle event types to NormalisedEventType:
    //    Paddle event types: transaction.completed, subscription.created,
    //    subscription.updated, subscription.canceled, subscription.past_due
    //
    // 4. Map fields to NormalisedSubscriptionEvent / NormalisedInvoiceEvent
    //    Key field mapping:
    //      Stripe customerId     → Paddle event.data.customer_id
    //      Stripe subscriptionId → Paddle event.data.id (for subscription events)
    //      Stripe priceId        → Paddle event.data.items[0].price.id
    //      Stripe metadata       → Paddle event.data.custom_data
    //      Stripe period_start   → Paddle event.data.current_billing_period.starts_at
    //      Stripe period_end     → Paddle event.data.current_billing_period.ends_at
    //
    // 5. Return the normalised event — the handler in webhook.router.ts
    //    processes it identically regardless of provider.

    throw new Error('[PaddleProvider] verifyAndParseWebhook not yet implemented');
  }
}