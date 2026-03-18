import { Request, Response } from "express";
import { getPaymentProvider } from "./provider.registry.js";
import type {
  NormalisedSubscriptionEvent,
  NormalisedInvoiceEvent,
} from "./IpaymentProvider.js";
import {
  BillingEventType,
  SubStatus,
  WorkspacePlan,
  InvoiceStatus,
} from "@prisma/client";
import { prisma } from "../index.js";
import { BILLING_CACHE } from "../redis/redis.client.js";

function safeDate(
  value: Date | null | undefined,
  fallback: Date = new Date(),
): Date {
  if (!value || isNaN(value.getTime())) return fallback;
  return value;
}

async function resolveWorkspaceFromSubId(
  providerSubId: string | null,
): Promise<string | undefined> {
  if (!providerSubId) return undefined;
  const sub = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: providerSubId },
    select: { workspaceId: true },
  });
  return sub?.workspaceId ?? undefined;
}

async function resolveWorkspaceFromCustomerId(
  customerId: string | null,
): Promise<string | undefined> {
  if (!customerId) return undefined;
  const sub = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
    select: { workspaceId: true },
    orderBy: { createdAt: "desc" }, // ← most recent, not random first match
  });
  return sub?.workspaceId ?? undefined;
}

export async function webhookHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const provider = getPaymentProvider();

  let event: NormalisedSubscriptionEvent | NormalisedInvoiceEvent | null;
  try {
    event = await provider.verifyAndParseWebhook(
      req.body as Buffer,
      req.headers as Record<string, string | string[] | undefined>,
    );
  } catch (err) {
    console.error("[Webhook] Verification failed:", err);
    res.status(400).json({ error: "Webhook verification failed" });
    return;
  }

  if (!event) {
    res.json({ received: true });
    return;
  }

  const existing = await prisma.billingEvent.findUnique({
    where: { stripeEventId: event.providerEventId },
  });

  if (existing?.processed) {
    console.log(`[Webhook] Already processed: ${event.providerEventId}`);
    res.json({ received: true });
    return;
  }

  const billingEvent = await prisma.billingEvent.upsert({
    where: { stripeEventId: event.providerEventId },
    create: {
      stripeEventId: event.providerEventId,
      type: mapEventType(event.type),
      payload: event.raw as any,
      processed: false,
    },
    update: {},
  });

  try {
    await processEvent(event);
    await prisma.billingEvent.update({
      where: { id: billingEvent.id },
      data: { processed: true },
    });
    res.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Webhook] Processing failed for ${event.type}:`, message);
    await prisma.billingEvent.update({
      where: { id: billingEvent.id },
      data: { error: message },
    });
    res.status(500).json({ error: "Processing failed" });
  }
}

async function processEvent(
  event: NormalisedSubscriptionEvent | NormalisedInvoiceEvent,
): Promise<void> {
  switch (event.type) {
    case "CHECKOUT_COMPLETED":
      return handleCheckoutCompleted(event as NormalisedSubscriptionEvent);
    case "SUBSCRIPTION_CREATED":
    case "SUBSCRIPTION_UPDATED":
      return handleSubscriptionUpserted(event as NormalisedSubscriptionEvent);
    case "SUBSCRIPTION_CANCELED":
      return handleSubscriptionCanceled(event as NormalisedSubscriptionEvent);
    case "SUBSCRIPTION_TRIAL_ENDING":
      return handleTrialEnding(event as NormalisedSubscriptionEvent);
    case "INVOICE_PAID":
      return handleInvoicePaid(event as NormalisedInvoiceEvent);
    case "INVOICE_PAYMENT_FAILED":
      return handleInvoicePaymentFailed(event as NormalisedInvoiceEvent);
    case "INVOICE_CREATED":
    case "INVOICE_UPDATED":
      return handleInvoiceUpsert(event as NormalisedInvoiceEvent);
    default:
      console.log(`[Webhook] No handler for event type: ${event.type}`);
  }
}

async function handleCheckoutCompleted(event: NormalisedSubscriptionEvent) {
  const { workspaceId } = event.metadata;
  console.log(`[Webhook] Checkout completed for workspace ${workspaceId}`);
}

async function handleSubscriptionUpserted(event: NormalisedSubscriptionEvent) {
  const { workspaceId, ownerId } = event.metadata;

  if (!workspaceId) {
    console.warn(
      "[Webhook] Subscription event missing workspaceId metadata — skipping",
    );
    return;
  }

  const plan = await prisma.plan.findUnique({
    where: { name: event.planName },
  });
  if (!plan) throw new Error(`Plan not found in DB: ${event.planName}`);

  await prisma.subscription.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      stripeSubscriptionId: event.providerSubscriptionId,
      stripeCustomerId: event.providerCustomerId,
      stripePriceId: event.providerPriceId,
      planId: plan.id,
      billingCycle: event.billingCycle,
      status: event.status as SubStatus,
      currentPeriodStart: safeDate(event.currentPeriodStart),
      currentPeriodEnd: safeDate(
        event.currentPeriodEnd,
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      ),
      cancelAtPeriodEnd: event.cancelAtPeriodEnd,
      canceledAt: event.canceledAt,
      trialStart: event.trialStart,
      trialEnd: event.trialEnd,
      metadata: event.metadata as any,
    },
    update: {
      stripeSubscriptionId: event.providerSubscriptionId,
      stripePriceId: event.providerPriceId,
      planId: plan.id,
      billingCycle: event.billingCycle,
      status: event.status as SubStatus,
      currentPeriodStart: safeDate(event.currentPeriodStart),
      currentPeriodEnd: safeDate(
        event.currentPeriodEnd,
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      ),
      cancelAtPeriodEnd: event.cancelAtPeriodEnd,
      canceledAt: event.canceledAt,
      trialEnd: event.trialEnd,
      metadata: event.metadata as any,
    },
  });

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      plan: event.planName as WorkspacePlan,
      maxMembers: plan.maxMembersPerWs,
      maxStorage: plan.maxStorageMb,
    },
  });

  await BILLING_CACHE.invalidateWorkspace(workspaceId, ownerId);
  console.log(
    `[Webhook] Subscription upserted: workspace=${workspaceId} plan=${event.planName} status=${event.status}`,
  );

  const savedSub = await prisma.subscription.findUnique({
    where: { workspaceId },
  });
  if (savedSub) {
    const backfilled = await prisma.invoice.updateMany({
      where: {
        workspaceId, // must already be correctly assigned to this workspace
        subscriptionId: null, // only fill in missing links
      },
      data: {
        subscriptionId: savedSub.id,
        payerId: ownerId ?? undefined,
      },
    });
    if (backfilled.count > 0) {
      console.log(
        `[Webhook] Backfilled ${backfilled.count} invoices for workspace ${workspaceId}`,
      );
      await BILLING_CACHE.invalidateWorkspace(workspaceId, ownerId);
    }
  }
}

async function handleSubscriptionCanceled(event: NormalisedSubscriptionEvent) {
  const { workspaceId } = event.metadata;
  if (!workspaceId) return;

  await prisma.subscription.update({
    where: { workspaceId },
    data: { status: "CANCELED", canceledAt: new Date() },
  });

  const freePlan = await prisma.plan.findUnique({ where: { name: "FREE" } });
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      plan: "FREE",
      maxMembers: freePlan?.maxMembersPerWs ?? 5,
      maxStorage: freePlan?.maxStorageMb ?? 500,
    },
  });

  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true },
  });
  await BILLING_CACHE.invalidateWorkspace(workspaceId, ws?.ownerId);
  console.log(`[Webhook] Workspace ${workspaceId} downgraded to FREE`);
}

async function handleTrialEnding(event: NormalisedSubscriptionEvent) {
  const { workspaceId } = event.metadata;
  if (!workspaceId) return;
  // TODO: send "trial ending soon" email
  console.log(`[Webhook] Trial ending soon for workspace ${workspaceId}`);
}

async function handleInvoicePaid(event: NormalisedInvoiceEvent) {
  await upsertInvoice(event);

  if (event.providerPaymentId) {
    const workspaceId = await resolveWorkspaceFromSubId(
      event.providerSubscriptionId,
    );

    await prisma.payment.upsert({
      where: { stripePaymentIntentId: event.providerPaymentId },
      create: {
        stripePaymentIntentId: event.providerPaymentId,
        workspaceId: workspaceId ?? undefined,
        payerId: event.metadata?.ownerId ?? undefined,
        amount: event.amountPaid,
        currency: event.currency,
        status: "SUCCEEDED",
        paymentMethod: event.paymentMethodType ?? undefined,
        last4: event.cardLast4 ?? undefined,
      },
      update: { status: "SUCCEEDED" },
    });
  }

  console.log(`[Webhook] Invoice paid: ${event.providerInvoiceId}`);
}

async function handleInvoicePaymentFailed(event: NormalisedInvoiceEvent) {
  await upsertInvoice(event);

  if (event.providerSubscriptionId) {
    const sub = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: event.providerSubscriptionId },
    });
    if (sub) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: "PAST_DUE" },
      });
      await BILLING_CACHE.invalidateWorkspace(sub.workspaceId);
    }
  }
  console.warn(`[Webhook] Invoice payment FAILED: ${event.providerInvoiceId}`);
}

async function handleInvoiceUpsert(event: NormalisedInvoiceEvent) {
  await upsertInvoice(event);
}

async function upsertInvoice(event: NormalisedInvoiceEvent) {
  let workspaceId: string | undefined =
    event.metadata?.workspaceId || undefined;

  if (!workspaceId && event.providerSubscriptionId) {
    workspaceId = await resolveWorkspaceFromSubId(event.providerSubscriptionId);
  }

  if (!workspaceId && event.providerCustomerId) {
    workspaceId = await resolveWorkspaceFromCustomerId(
      event.providerCustomerId,
    );
  }

  const sub = event.providerSubscriptionId
    ? await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: event.providerSubscriptionId },
      })
    : null;

  const payerId: string | undefined =
    event.metadata?.ownerId ||
    (workspaceId
      ? (
          await prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { ownerId: true },
          })
        )?.ownerId
      : undefined) ||
    undefined;

  await prisma.invoice.upsert({
    where: { stripeInvoiceId: event.providerInvoiceId },
    create: {
      stripeInvoiceId: event.providerInvoiceId,
      subscriptionId: sub?.id,
      workspaceId,
      payerId,
      amountDue: event.amountDue,
      amountPaid: event.amountPaid,
      amountRemaining: event.amountRemaining,
      currency: event.currency,
      status: event.status as InvoiceStatus,
      invoiceNumber: event.invoiceNumber,
      invoicePdf: event.invoicePdfUrl,
      hostedUrl: event.hostedInvoiceUrl,
      periodStart: event.periodStart,
      periodEnd: event.periodEnd,
      dueDate: event.dueDate,
      paidAt: event.paidAt,
      lineItems: event.lineItems as any,
      attemptCount: event.attemptCount,
    },
    update: {
      ...(sub?.id && { subscriptionId: sub.id }),
      ...(workspaceId && { workspaceId }),
      ...(payerId && { payerId }),
      status: event.status as InvoiceStatus,
      amountPaid: event.amountPaid,
      amountRemaining: event.amountRemaining,
      invoicePdf: event.invoicePdfUrl ?? undefined,
      hostedUrl: event.hostedInvoiceUrl ?? undefined,
      paidAt: event.paidAt ?? undefined,
      attemptCount: event.attemptCount,
    },
  });

  if (workspaceId) await BILLING_CACHE.invalidateWorkspace(workspaceId);
}

function mapEventType(type: string): BillingEventType {
  const map: Record<string, BillingEventType> = {
    CHECKOUT_COMPLETED: "CHECKOUT_COMPLETED",
    SUBSCRIPTION_CREATED: "SUBSCRIPTION_CREATED",
    SUBSCRIPTION_UPDATED: "SUBSCRIPTION_UPDATED",
    SUBSCRIPTION_CANCELED: "SUBSCRIPTION_CANCELED",
    SUBSCRIPTION_TRIAL_ENDING: "SUBSCRIPTION_TRIAL_ENDED",
    INVOICE_PAID: "INVOICE_PAID",
    INVOICE_PAYMENT_FAILED: "INVOICE_PAYMENT_FAILED",
    INVOICE_CREATED: "INVOICE_CREATED",
    INVOICE_UPDATED: "INVOICE_CREATED",
  };
  return map[type] ?? "SUBSCRIPTION_UPDATED";
}
