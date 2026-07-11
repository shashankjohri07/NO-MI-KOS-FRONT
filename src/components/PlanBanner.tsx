import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { billingApi, type Entitlement } from '../services/billingApi';
import '../styles/PlanBanner.css';

/**
 * Small plan/quota strip shown at the top of every tool. Renders nothing
 * while billing is disabled or on unlimited plans, so the tools look exactly
 * as before until the admin flips billing on.
 */
export default function PlanBanner() {
  const [ent, setEnt] = useState<Entitlement | null>(null);

  useEffect(() => {
    billingApi.me().then(setEnt);
  }, []);

  if (!ent || !ent.billingEnabled || ent.docsLimit === -1) return null;

  const out = ent.remaining === 0;
  return (
    <div className={`plan-banner${out ? ' plan-banner--out' : ''}`}>
      <span>
        {out ? (
          <>You've used all <strong>{ent.docsLimit}</strong> documents in your <strong>{ent.plan.name}</strong> plan.</>
        ) : (
          <><strong>{ent.plan.name}</strong> plan · <strong>{ent.remaining}</strong> of {ent.docsLimit} documents left this period.</>
        )}
      </span>
      <Link to="/pricing" className="plan-banner__link">
        {out ? 'Upgrade now →' : 'View plans →'}
      </Link>
    </div>
  );
}
