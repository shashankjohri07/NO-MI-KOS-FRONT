import axios from 'axios';
import type { BillingPlan } from './adminApi';

/**
 * User-side billing: plans, the signed-in user's entitlement, Razorpay
 * checkout, and the per-document "consume" gate the tools call before
 * processing. When billing is disabled server-side everything here reports
 * unlimited access, so the tools behave exactly as before.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/';

const client = axios.create({ baseURL: API_BASE_URL, timeout: 30000, withCredentials: true });

export interface Entitlement {
  billingEnabled: boolean;
  plan: BillingPlan;
  expiresAt: string | null;
  docsUsed: number;
  docsLimit: number; // -1 = unlimited
  remaining: number; // -1 = unlimited
}

export interface ConsumeResult {
  allowed: boolean;
  remaining: number; // -1 = unlimited
  /** 'quota_exhausted' | 'tool_not_in_plan' when blocked. */
  code?: string;
  message?: string;
}

export const billingApi = {
  async plans(): Promise<{ enabled: boolean; plans: BillingPlan[] }> {
    try {
      const r = await client.get<{ ok: boolean; enabled: boolean; plans: BillingPlan[] }>(
        '/billing/plans',
      );
      return { enabled: Boolean(r.data.enabled), plans: r.data.plans ?? [] };
    } catch {
      return { enabled: false, plans: [] };
    }
  },

  async me(): Promise<Entitlement | null> {
    try {
      const r = await client.get<{ ok: boolean; entitlement: Entitlement }>('/billing/me');
      return r.data.entitlement ?? null;
    } catch {
      return null;
    }
  },

  /** Gate one document run. Fail-open on network errors — billing must never
   * block a filing because of a hiccup. */
  async consume(tool: string): Promise<ConsumeResult> {
    try {
      const r = await client.post<{ ok: boolean; remaining: number }>('/billing/consume', { tool });
      return { allowed: true, remaining: r.data.remaining ?? -1 };
    } catch (e) {
      if (axios.isAxiosError(e) && (e.response?.status === 402 || e.response?.status === 403)) {
        const data = e.response.data as { code?: string; error?: string };
        return {
          allowed: false,
          remaining: 0,
          code: data?.code,
          message: data?.error || 'Your plan does not allow this.',
        };
      }
      return { allowed: true, remaining: -1 };
    }
  },

  async createOrder(planId: string): Promise<{
    orderId: string; amount: number; currency: string; keyId: string;
    plan: { id: string; name: string };
  }> {
    const r = await client.post('/billing/order', { planId });
    if (!r.data.ok) throw new Error(r.data.error || 'Could not start payment');
    return r.data;
  },

  async verify(input: {
    planId: string; orderId: string; paymentId: string; signature: string;
  }): Promise<Entitlement> {
    const r = await client.post<{ ok: boolean; entitlement: Entitlement; error?: string }>(
      '/billing/verify',
      input,
    );
    if (!r.data.ok) throw new Error(r.data.error || 'Payment verification failed');
    return r.data.entitlement;
  },
};

/** Load Razorpay's checkout.js once and open the payment modal. Resolves with
 * the payment details on success, rejects if the user closes the modal. */
export function openRazorpayCheckout(opts: {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  planName: string;
  email?: string;
}): Promise<{ paymentId: string; orderId: string; signature: string }> {
  return new Promise((resolve, reject) => {
    const open = () => {
      const RazorpayCtor = (window as unknown as { Razorpay?: new (o: object) => { open: () => void } })
        .Razorpay;
      if (!RazorpayCtor) {
        reject(new Error('Could not load the payment window. Check your connection and retry.'));
        return;
      }
      const rzp = new RazorpayCtor({
        key: opts.keyId,
        order_id: opts.orderId,
        amount: opts.amount,
        currency: opts.currency,
        name: 'Nomikos',
        description: `${opts.planName} plan`,
        prefill: opts.email ? { email: opts.email } : undefined,
        theme: { color: '#b8962e' },
        handler: (resp: {
          razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string;
        }) =>
          resolve({
            paymentId: resp.razorpay_payment_id,
            orderId: resp.razorpay_order_id,
            signature: resp.razorpay_signature,
          }),
        modal: { ondismiss: () => reject(new Error('Payment cancelled.')) },
      });
      rzp.open();
    };

    if ((window as unknown as { Razorpay?: unknown }).Razorpay) {
      open();
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = open;
    s.onerror = () => reject(new Error('Could not load the payment window. Check your connection and retry.'));
    document.body.appendChild(s);
  });
}

/** One-line gate for the tools: returns null when the run may proceed, or a
 * user-facing block message (quota over / tool not in plan) when it may not.
 * Fail-open by design — network problems never block a filing. */
export async function gateTool(tool: string): Promise<string | null> {
  const r = await billingApi.consume(tool);
  if (r.allowed) return null;
  return `${r.message} Visit the Plans & Pricing page to upgrade.`;
}

export default billingApi;
