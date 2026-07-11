import { useEffect, useState } from 'react';
import { billingApi, openRazorpayCheckout, type Entitlement } from '../services/billingApi';
import type { BillingPlan } from '../services/adminApi';
import { adminApi } from '../services/adminApi';
import '../styles/Pricing.css';

const TOOL_LABELS: Record<string, string> = {
  'document-prep': 'Document Prep',
  'page-numbering': 'Page Numbering',
  'annexures': 'Annexures',
  'signatures': 'Signatures',
  'bookmarks': 'Bookmarks',
  'index-generator': 'Index Generator',
};

/** Plan cards + Razorpay checkout. Hidden behind the admin's billing switch:
 * when billing is off this page simply says everything is free. */
export default function Pricing() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [ent, setEnt] = useState<Entitlement | null>(null);
  const [email, setEmail] = useState<string | undefined>();
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    billingApi.plans().then(({ enabled, plans }) => {
      setEnabled(enabled);
      setPlans(plans);
    });
    billingApi.me().then(setEnt);
    adminApi.whoami().then((w) => setEmail(w.email));
  }, []);

  const buy = async (plan: BillingPlan) => {
    setNotice(null);
    setBusyPlan(plan.id);
    try {
      const order = await billingApi.createOrder(plan.id);
      const payment = await openRazorpayCheckout({
        keyId: order.keyId,
        orderId: order.orderId,
        amount: order.amount,
        currency: order.currency,
        planName: plan.name,
        email,
      });
      const newEnt = await billingApi.verify({
        planId: plan.id,
        orderId: payment.orderId,
        paymentId: payment.paymentId,
        signature: payment.signature,
      });
      setEnt(newEnt);
      setNotice({
        kind: 'ok',
        text: `You're on ${plan.name}! Active until ${new Date(newEnt.expiresAt || '').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
      });
    } catch (e) {
      const m = e instanceof Error ? e.message : 'Payment failed.';
      if (!/cancelled/i.test(m)) setNotice({ kind: 'err', text: m });
    } finally {
      setBusyPlan(null);
    }
  };

  if (enabled === null) {
    return <div className="pr"><div className="pr__container"><p className="pr__loading">Loading plans…</p></div></div>;
  }

  return (
    <div className="pr">
      <div className="pr__container">
        <header className="pr__header">
          <h1 className="pr__title">Plans &amp; Pricing</h1>
          {enabled ? (
            <p className="pr__subtitle">
              Pick the plan that fits your practice. Subscriptions stop automatically when they
              end — no surprise charges, renew whenever you like.
            </p>
          ) : (
            <p className="pr__subtitle">
              All tools are currently <strong>free and unlimited</strong> — enjoy! Paid plans may
              be introduced later.
            </p>
          )}
        </header>

        {ent?.billingEnabled && (
          <div className="pr__current">
            You're on the <strong>{ent.plan.name}</strong> plan
            {ent.expiresAt && (
              <> · active until {new Date(ent.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</>
            )}
            {ent.docsLimit !== -1 && (
              <> · {ent.remaining} of {ent.docsLimit} documents left</>
            )}
          </div>
        )}

        {notice && <p className={`pr__notice pr__notice--${notice.kind}`}>{notice.text}</p>}

        {enabled && (
          <div className="pr__grid">
            {plans.map((p) => {
              const isCurrent = ent?.plan.id === p.id && (p.priceInr === 0 || ent?.expiresAt);
              return (
                <div key={p.id} className={`pr__card${isCurrent ? ' pr__card--current' : ''}`}>
                  <h2 className="pr__plan-name">{p.name}</h2>
                  <p className="pr__price">
                    {p.priceInr === 0 ? 'Free' : `₹${p.priceInr.toLocaleString('en-IN')}`}
                    {p.priceInr > 0 && (
                      <span className="pr__period"> / {p.periodDays === 30 ? 'month' : `${p.periodDays} days`}</span>
                    )}
                  </p>
                  {p.description && <p className="pr__desc">{p.description}</p>}
                  <ul className="pr__features">
                    <li>
                      {p.docsPerPeriod === -1
                        ? '✓ Unlimited documents'
                        : `✓ ${p.docsPerPeriod} documents / ${p.periodDays === 30 ? 'month' : `${p.periodDays} days`}`}
                    </li>
                    {p.tools.map((t) => (
                      <li key={t}>✓ {TOOL_LABELS[t] ?? t}</li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <span className="pr__current-tag">Current plan</span>
                  ) : p.priceInr > 0 ? (
                    <button
                      type="button"
                      className="pr__buy"
                      disabled={busyPlan !== null}
                      onClick={() => buy(p)}
                    >
                      {busyPlan === p.id ? 'Opening payment…' : `Get ${p.name}`}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
