// backend/src/payment/IPaymentProvider.ts
//
// This is the ONLY file the rest of the application imports from.
// BillingService, controllers, and middleware never touch Stripe or Paddle directly.
// Swapping providers = change one env var (PAYMENT_PROVIDER=paddle).
//
// ─────────────────────────────────────────────────────────────────────────────

import { BillingCycle } from "@prisma/client";


// ---------------------------------------------------------------------------
// Provider-agnostic input types
// ---------------------------------------------------------------------------

export interface CreateCheckoutParams {
  workspaceId:       string;
  ownerId:           string;
  providerCustomerId: string;    // resolved before calling — Stripe customer ID or Paddle customer ID
  planName:          string;
  billingCycle:      BillingCycle;
  trialDays?:        number;
  successUrl:        string;
  cancelUrl:         string;
  metadata:          Record<string, string>;
}

export interface CreatePortalParams {
  providerCustomerId: string;
  returnUrl:          string;
}

export interface ChangePlanParams {
  providerSubscriptionId: string;
  newProviderPriceId:     string;
  isUpgrade:              boolean;  // controls proration behaviour
  metadata:               Record<string, string>;
}

export interface CancelSubscriptionParams {
  providerSubscriptionId: string;
  immediately:            boolean;
  reason?:                string;
}

export interface ReactivateSubscriptionParams {
  providerSubscriptionId: string;
}

export interface CreateCustomerParams {
  email: string;
  name?: string;
  metadata: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Provider-agnostic output types
// ---------------------------------------------------------------------------

export interface CheckoutResult {
  url: string;
}

export interface PortalResult {
  url: string;
}

export interface CustomerResult {
  providerCustomerId: string;
}

// ---------------------------------------------------------------------------
// Normalised webhook event — what every handler writes into the DB
// The provider-specific webhook handlers translate their raw payloads into this.
// ---------------------------------------------------------------------------

export type NormalisedEventType =
  | 'CHECKOUT_COMPLETED'
  | 'SUBSCRIPTION_CREATED'
  | 'SUBSCRIPTION_UPDATED'
  | 'SUBSCRIPTION_CANCELED'
  | 'SUBSCRIPTION_TRIAL_ENDING'
  | 'INVOICE_PAID'
  | 'INVOICE_PAYMENT_FAILED'
  | 'INVOICE_CREATED'
  | 'INVOICE_UPDATED';

export interface NormalisedSubscriptionEvent {
  type:                   NormalisedEventType;
  providerEventId:        string;           // for idempotency (Stripe event.id / Paddle event_id)
  providerSubscriptionId: string;
  providerCustomerId:     string;
  providerPriceId:        string;
  planName:               string;           // resolved from price ID
  status:                 NormalisedSubStatus;
  billingCycle:           BillingCycle;
  currentPeriodStart:     Date;
  currentPeriodEnd:       Date;
  cancelAtPeriodEnd:      boolean;
  canceledAt:             Date | null;
  trialStart:             Date | null;
  trialEnd:               Date | null;
  metadata:               Record<string, string>;  // must contain workspaceId + ownerId
  raw:                    unknown;                 // original payload (stored in BillingEvent)
}

export interface NormalisedInvoiceEvent {
  type:                   NormalisedEventType;
  providerEventId:        string;
  providerInvoiceId:      string;
  providerCustomerId:     string | null;  // ← add this
  providerSubscriptionId: string | null;
  providerPaymentId:      string | null;
  amountDue:              number;   // cents
  amountPaid:             number;
  amountRemaining:        number;
  currency:               string;
  status:                 NormalisedInvoiceStatus;
  invoiceNumber:          string | null;
  invoicePdfUrl:          string | null;
  hostedInvoiceUrl:       string | null;
  periodStart:            Date | null;
  periodEnd:              Date | null;
  dueDate:                Date | null;
  paidAt:                 Date | null;
  attemptCount:           number;
  paymentMethodType:      string | null;
  cardLast4:              string | null;
  lineItems:              unknown;
  metadata:               Record<string, string>;
  raw:                    unknown;
}

export type NormalisedSubStatus =
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'UNPAID'
  | 'PAUSED'
  | 'INCOMPLETE'
  | 'INCOMPLETE_EXPIRED';

export type NormalisedInvoiceStatus =
  | 'DRAFT'
  | 'OPEN'
  | 'PAID'
  | 'VOID'
  | 'UNCOLLECTIBLE';

// ---------------------------------------------------------------------------
// The interface every provider must implement
// ---------------------------------------------------------------------------

export interface IPaymentProvider {
  readonly name: string;   // 'stripe' | 'paddle' — stored in BillingEvent for debugging

  // Customer management
  createCustomer(params: CreateCustomerParams): Promise<CustomerResult>;

  // Checkout
  createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutResult>;

  // Self-service management portal (Stripe has a hosted portal; Paddle has their own)
  createPortalSession(params: CreatePortalParams): Promise<PortalResult>;

  // Subscription mutations
  changePlan(params: ChangePlanParams): Promise<void>;
  cancelSubscription(params: CancelSubscriptionParams): Promise<void>;
  reactivateSubscription(params: ReactivateSubscriptionParams): Promise<void>;

  // Webhook: verify the request came from the real provider, then normalise it.
  // Returns null if the event type is unrecognised/unhandled (not an error).
  verifyAndParseWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<NormalisedSubscriptionEvent | NormalisedInvoiceEvent | null>;
}