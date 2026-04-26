// backend/src/billing/config/paddle.ts
import { Environment, Paddle } from '@paddle/paddle-node-sdk';


let paddleInstance: Paddle | null = null;

export function getPaddle(): Paddle {
  if (!paddleInstance) {
    if (!process.env.PADDLE_API_KEY) {
      throw new Error('PADDLE_API_KEY is not defined');
    }

    paddleInstance = new Paddle(process.env.PADDLE_API_KEY, {
      environment:
        process.env.NODE_ENV === 'production'
          ? Environment.production
          : Environment.sandbox,
    });
  }

  return paddleInstance;
}


export interface PaddlePriceConfig {
  monthly: string;
  yearly: string;
}

export const PADDLE_PRICE_IDS: Record<string, PaddlePriceConfig> = {
  PRO: {
    monthly: process.env.PADDLE_PRICE_PRO_MONTHLY || '',
    yearly: process.env.PADDLE_PRICE_PRO_YEARLY || '',
  },
  BUSINESS: {
    monthly: process.env.PADDLE_PRICE_BUSINESS_MONTHLY || '',
    yearly: process.env.PADDLE_PRICE_BUSINESS_YEARLY || '',
  },
};


export const PADDLE_PRICE_TO_PLAN = new Map<
  string,
  { planName: string; cycle: 'MONTHLY' | 'YEARLY' }
>();

for (const [planName, prices] of Object.entries(PADDLE_PRICE_IDS)) {
  if (prices.monthly) {
    PADDLE_PRICE_TO_PLAN.set(prices.monthly, {
      planName,
      cycle: 'MONTHLY',
    });
  }

  if (prices.yearly) {
    PADDLE_PRICE_TO_PLAN.set(prices.yearly, {
      planName,
      cycle: 'YEARLY',
    });
  }
}


export function getPaddleWebhookSecret(): string {
  if (!process.env.PADDLE_WEBHOOK_SECRET) {
    throw new Error('PADDLE_WEBHOOK_SECRET is not defined');
  }

  return process.env.PADDLE_WEBHOOK_SECRET;
}