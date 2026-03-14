// backend/src/payment/provider.registry.ts
//
// Single source of truth for which payment provider is active.
// Change PAYMENT_PROVIDER=paddle in .env and you're done.
//
// Usage (anywhere in the app):
//   import { getPaymentProvider } from '../payment/provider.registry';
//   const provider = getPaymentProvider();
//   const result   = await provider.createCheckoutSession(params);
// ─────────────────────────────────────────────────────────────────────────────

import type { IPaymentProvider } from './IpaymentProvider.js';
import { StripeProvider }        from './providers/stripe/stripe.provider.js';
import { PaddleProvider }        from './providers/paddle/paddle.provider.js';

type SupportedProvider = 'stripe' | 'paddle';

// Module-level singleton — instantiated once at server start
let instance: IPaymentProvider | null = null;

export function getPaymentProvider(): IPaymentProvider {
  if (instance) return instance;

  const name = (process.env.PAYMENT_PROVIDER ?? 'stripe').toLowerCase() as SupportedProvider;

  switch (name) {
    case 'stripe':
      instance = new StripeProvider();
      break;
    case 'paddle':
      instance = new PaddleProvider();
      break;
    default:
      throw new Error(
        `[PaymentRegistry] Unknown PAYMENT_PROVIDER="${name}". Supported: stripe, paddle`
      );
  }

  console.log(`[PaymentRegistry] Active provider: ${instance.name}`);
  return instance;
}

// Exposed for testing — lets tests inject a mock provider
export function setPaymentProvider(provider: IPaymentProvider): void {
  instance = provider;
}

// Reset — used between tests
export function resetPaymentProvider(): void {
  instance = null;
}