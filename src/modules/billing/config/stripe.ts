// backend/src/billing/config/stripe.ts
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not defined');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-02-25.clover',
  typescript: true,
  maxNetworkRetries: 3,
  timeout: 10_000,
  telemetry: false,
});

export interface StripePriceConfig {
  monthly: string;
  yearly:  string;
}

export const STRIPE_PRICE_IDS: Record<string, StripePriceConfig> = {
  PRO: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY!,
    yearly:  process.env.STRIPE_PRICE_PRO_YEARLY!,
  },
  BUSINESS: {
    monthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY!,
    yearly:  process.env.STRIPE_PRICE_BUSINESS_YEARLY!,
  },
};

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;