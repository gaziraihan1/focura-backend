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

// ---------------------------------------------------------------------------
// Plan → Stripe Price mapping
// ---------------------------------------------------------------------------

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
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Plan limits — two separate concerns:
//
//   maxWorkspacesOwned  → USER-level limit. How many workspaces a user can
//                         CREATE in total, determined by their HIGHEST active
//                         workspace plan across all owned workspaces.
//                         e.g. if user has 1 FREE + 1 PRO workspace, they get
//                         the PRO creation allowance (5 total workspaces).
//
//   everything else     → WORKSPACE-level limits. Enforced per-workspace
//                         based on that workspace's own plan. Upgrading
//                         Workspace A has zero effect on Workspace B.
// ---------------------------------------------------------------------------

export const PLAN_LIMITS = {
  FREE: {
    // User-level
    maxWorkspacesOwned: 1,    // a user with only FREE workspaces can own up to 3
    // Workspace-level
    maxMembersPerWs:    5,
    maxStorageMb:       1024,
    maxFileSizeMb:      5,
    maxMeetingsPerMo:   10,
    maxProjects:        3,
    analyticsAccess:    false,
    prioritySupport:    false,
    apiAccess:          false,
  },
  PRO: {
    // User-level — upgrading any one workspace to PRO raises the user's
    // total workspace creation ceiling to 10
    maxWorkspacesOwned: 5,
    // Workspace-level (only the upgraded workspace gets these)
    maxMembersPerWs:    25,
    maxStorageMb:       10_240,
    maxFileSizeMb:      50,
    maxMeetingsPerMo:   -1,
    maxProjects:        -1,
    analyticsAccess:    true,
    prioritySupport:    false,
    apiAccess:          false,
  },
  BUSINESS: {
    // User-level — at least one BUSINESS workspace = unlimited workspace creation
    maxWorkspacesOwned: -1,
    // Workspace-level
    maxMembersPerWs:    -1,
    maxStorageMb:       102_400,
    maxFileSizeMb:      100,
    maxMeetingsPerMo:   -1,
    maxProjects:        -1,
    analyticsAccess:    true,
    prioritySupport:    true,
    apiAccess:          true,
  },
} as const;

export type PlanName = keyof typeof PLAN_LIMITS;