import { checkoutResponseSchema, planResponseSchema, type Locale } from '@moneyflow/shared';

import { apiRequest } from '@/lib/api';

/** Start a Stripe Checkout session (test mode) and leave the app for Stripe's hosted page. */
export async function startCheckout(locale: Locale): Promise<void> {
  const { url } = await apiRequest('/billing/checkout', {
    method: 'POST',
    body: { locale },
    schema: checkoutResponseSchema,
  });
  const target = new URL(url);
  // Only ever follow a URL on Stripe's own checkout domain.
  if (target.protocol !== 'https:' || !target.hostname.endsWith('stripe.com'))
    throw new Error('Unexpected checkout URL');
  window.location.assign(target.toString());
}

export function confirmCheckout(sessionId: string) {
  return apiRequest('/billing/confirm', {
    method: 'POST',
    body: { sessionId },
    schema: planResponseSchema,
  });
}

export function cancelSubscription() {
  return apiRequest('/billing/cancel', { method: 'POST', schema: planResponseSchema });
}
