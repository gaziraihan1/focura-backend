// // backend/src/payment/providers/mock/mock.provider.ts
// //
// // Drop-in test provider. Inject it via setPaymentProvider() before each test.
// // All methods are jest.fn() so you can assert calls and control return values.
// //
// // Usage in tests:
// //   import { mockProvider, resetMockProvider } from './mock.provider';
// //   import { setPaymentProvider }               from '../../provider.registry';
// //
// //   beforeEach(() => { resetMockProvider(); setPaymentProvider(mockProvider); });
// //
// //   it('creates checkout and redirects', async () => {
// //     mockProvider.createCheckoutSession.mockResolvedValue({ url: 'https://mock-checkout.test' });
// //     const url = await BillingService.createCheckoutSession({ ... });
// //     expect(url).toBe('https://mock-checkout.test');
// //   });
// // ─────────────────────────────────────────────────────────────────────────────

// import type {
//   IPaymentProvider,
//   CreateCustomerParams,
//   CreateCheckoutParams,
//   CreatePortalParams,
//   ChangePlanParams,
//   CancelSubscriptionParams,
//   ReactivateSubscriptionParams,
//   CustomerResult,
//   CheckoutResult,
//   PortalResult,
//   NormalisedSubscriptionEvent,
//   NormalisedInvoiceEvent,
// } from '../../IpaymentProvider.js';

// // ---------------------------------------------------------------------------
// // Typed mock — every method is individually mockable
// // ---------------------------------------------------------------------------

// export interface MockPaymentProvider extends IPaymentProvider {
//   createCustomer:         jest.MockedFunction<IPaymentProvider['createCustomer']>;
//   createCheckoutSession:  jest.MockedFunction<IPaymentProvider['createCheckoutSession']>;
//   createPortalSession:    jest.MockedFunction<IPaymentProvider['createPortalSession']>;
//   changePlan:             jest.MockedFunction<IPaymentProvider['changePlan']>;
//   cancelSubscription:     jest.MockedFunction<IPaymentProvider['cancelSubscription']>;
//   reactivateSubscription: jest.MockedFunction<IPaymentProvider['reactivateSubscription']>;
//   verifyAndParseWebhook:  jest.MockedFunction<IPaymentProvider['verifyAndParseWebhook']>;
// }

// function makeMockProvider(): MockPaymentProvider {
//   return {
//     name: 'mock',

//     createCustomer: jest.fn<Promise<CustomerResult>, [CreateCustomerParams]>()
//       .mockResolvedValue({ providerCustomerId: 'mock_cus_test' }),

//     createCheckoutSession: jest.fn<Promise<CheckoutResult>, [CreateCheckoutParams]>()
//       .mockResolvedValue({ url: 'https://mock-checkout.example.com/pay' }),

//     createPortalSession: jest.fn<Promise<PortalResult>, [CreatePortalParams]>()
//       .mockResolvedValue({ url: 'https://mock-portal.example.com/manage' }),

//     changePlan: jest.fn<Promise<void>, [ChangePlanParams]>()
//       .mockResolvedValue(undefined),

//     cancelSubscription: jest.fn<Promise<void>, [CancelSubscriptionParams]>()
//       .mockResolvedValue(undefined),

//     reactivateSubscription: jest.fn<Promise<void>, [ReactivateSubscriptionParams]>()
//       .mockResolvedValue(undefined),

//     verifyAndParseWebhook: jest.fn<
//       Promise<NormalisedSubscriptionEvent | NormalisedInvoiceEvent | null>,
//       [Buffer, Record<string, string | string[] | undefined>]
//     >().mockResolvedValue(null),
//   };
// }

// // Singleton for the test suite — reset between tests
// export let mockProvider = makeMockProvider();

// export function resetMockProvider(): void {
//   mockProvider = makeMockProvider();
// }

// // ---------------------------------------------------------------------------
// // Example test helper: simulate a subscription.updated webhook
// // ---------------------------------------------------------------------------

// export function makeMockSubscriptionEvent(
//   overrides: Partial<NormalisedSubscriptionEvent> = {},
// ): NormalisedSubscriptionEvent {
//   return {
//     type:                   'SUBSCRIPTION_UPDATED',
//     providerEventId:        'evt_mock_001',
//     providerSubscriptionId: 'sub_mock_001',
//     providerCustomerId:     'cus_mock_001',
//     providerPriceId:        'price_mock_pro_monthly',
//     planName:               'PRO',
//     status:                 'ACTIVE',
//     billingCycle:           'MONTHLY',
//     currentPeriodStart:     new Date('2025-01-01'),
//     currentPeriodEnd:       new Date('2025-02-01'),
//     cancelAtPeriodEnd:      false,
//     canceledAt:             null,
//     trialStart:             null,
//     trialEnd:               null,
//     metadata:               { workspaceId: 'ws_test_001', ownerId: 'user_test_001' },
//     raw:                    {},
//     ...overrides,
//   };
// }