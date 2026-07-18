import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  adminApi,
  type AdminEvent,
  type AdminEntry,
  type DashboardStats,
  type SendSummary,
  type Whoami,
  type ToolStat,
  type FeedbackEntry,
  type ProductTagMap,
  type ProductTag,
  type EmailSettings,
  type EmailEffective,
  type BillingConfigView,
  type BillingPlan,
  type SubscriptionRow,
  getRemoveBgStatus,
  saveRemoveBgKey,
} from '../../services/adminApi';
import { PRODUCT_DEFS } from '../Products';
import { BarChart, LineChart, DonutChart, MiniSparkline } from './Charts';
import '../../styles/Admin.css';

export default function Admin() {
  const navigate = useNavigate();
  const [who, setWho] = useState<Whoami | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [admins, setAdmins] = useState<AdminEntry[]>([]);
  const [toolStats, setToolStats] = useState<ToolStat[]>([]);
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);

  const refresh = useCallback(async () => {
    try {
      const [s, e, a, ts, fb] = await Promise.all([
        adminApi.stats(), adminApi.listEvents(), adminApi.listAdmins(),
        adminApi.getToolStats(), adminApi.listFeedback(),
      ]);
      setStats(s);
      setEvents(e);
      setAdmins(a);
      setToolStats(ts);
      setFeedback(fb);
    } catch {
      /* individual sections show their own errors below */
    }
  }, []);

  useEffect(() => {
    (async () => {
      const w = await adminApi.whoami();
      setWho(w);
      if (!w.isAdmin) {
        navigate('/', { replace: true });
        return;
      }
      refresh();
    })();
  }, [navigate, refresh]);

  useEffect(() => {
    if (!who?.isAdmin) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') {
        adminApi.stats().then(setStats).catch(() => {});
      }
    }, 30_000);
    return () => clearInterval(id);
  }, [who]);

  if (!who) return <div className="adm"><p className="adm__loading">Checking access…</p></div>;
  if (!who.isAdmin) return null;

  return (
    <div className="adm">
      <div className="adm__container">
        <div className="adm__ws">
          <button className="adm__ws-tab adm__ws-tab--active" type="button">
            ◆ Admin Dashboard
          </button>
          <button className="adm__ws-tab" type="button" onClick={() => navigate('/products')}>
            🛠 Document Tools →
          </button>
        </div>

        <header className="adm__header">
          <h1 className="adm__title">Dashboard</h1>
          <p className="adm__subtitle">
            Signed in as <strong>{who.email}</strong>
          </p>
          <span className="adm__live"><span className="adm__live-dot" /> Live — updates automatically</span>
        </header>

        <StatsSection stats={stats} toolStats={toolStats} />

        <ToolStats stats={toolStats} />

        <FeedbackList entries={feedback} onChange={refresh} />

        <ProductTags />

        <EmailSettingsCard />

        <BillingCard />

        <IntegrationsCard />

        <ManageAdmins admins={admins} self={who.email} onChange={refresh} />

        <NewEvent subscriberCount={stats?.totalUsers ?? 0} onCreated={refresh} selfEmail={who.email} />

        <PastEvents events={events} onChange={refresh} />
      </div>
    </div>
  );
}

/* ── Stats + charts ───────────────────────────────────────────────────────── */

function StatsSection({ stats, toolStats }: { stats: DashboardStats | null; toolStats: ToolStat[] }) {
  if (!stats) return <section className="adm__card"><p className="adm__empty">Loading stats…</p></section>;

  const cumulative = (() => {
    let run = stats.totalUsers - stats.perDay.reduce((a, d) => a + d.count, 0);
    return stats.perDay.map((d) => ({ date: d.date, count: (run += d.count) }));
  })();

  const totalToolUsage = toolStats.reduce((a, s) => a + s.count, 0);
  const sparkData = stats.perDay.map((d) => d.count);

  const weekGrowth = stats.perDay.length >= 7
    ? stats.perDay.slice(-7).reduce((a, d) => a + d.count, 0)
    : stats.newThisWeek;
  const prevWeek = stats.perDay.length >= 14
    ? stats.perDay.slice(0, 7).reduce((a, d) => a + d.count, 0)
    : 0;
  const growthPct = prevWeek > 0 ? Math.round(((weekGrowth - prevWeek) / prevWeek) * 100) : 0;

  return (
    <>
      <div className="adm__kpi-grid">
        <div className="adm__kpi">
          <div className="adm__kpi-icon">👥</div>
          <div className="adm__kpi-body">
            <span className="adm__kpi-num">{stats.totalUsers.toLocaleString()}</span>
            <span className="adm__kpi-label">Total users</span>
          </div>
          <MiniSparkline data={cumulative.map((d) => d.count)} />
        </div>

        <div className="adm__kpi adm__kpi--accent">
          <div className="adm__kpi-icon">✦</div>
          <div className="adm__kpi-body">
            <span className="adm__kpi-num">{stats.newToday.toLocaleString()}</span>
            <span className="adm__kpi-label">New today</span>
          </div>
          {stats.newToday > 0 && <span className="adm__kpi-badge">+{stats.newToday}</span>}
        </div>

        <div className="adm__kpi">
          <div className="adm__kpi-icon">📈</div>
          <div className="adm__kpi-body">
            <span className="adm__kpi-num">{stats.newThisWeek.toLocaleString()}</span>
            <span className="adm__kpi-label">This week</span>
          </div>
          {growthPct !== 0 && (
            <span className={`adm__kpi-trend ${growthPct > 0 ? 'adm__kpi-trend--up' : 'adm__kpi-trend--down'}`}>
              {growthPct > 0 ? '↑' : '↓'} {Math.abs(growthPct)}%
            </span>
          )}
        </div>

        <div className="adm__kpi">
          <div className="adm__kpi-icon">📧</div>
          <div className="adm__kpi-body">
            <span className="adm__kpi-num">{stats.emailsSent.toLocaleString()}</span>
            <span className="adm__kpi-label">Emails sent</span>
          </div>
        </div>

        <div className="adm__kpi">
          <div className="adm__kpi-icon">📅</div>
          <div className="adm__kpi-body">
            <span className="adm__kpi-num">{stats.totalEvents.toLocaleString()}</span>
            <span className="adm__kpi-label">Events</span>
          </div>
        </div>

        <div className="adm__kpi">
          <div className="adm__kpi-icon">⚡</div>
          <div className="adm__kpi-body">
            <span className="adm__kpi-num">{totalToolUsage.toLocaleString()}</span>
            <span className="adm__kpi-label">Tool runs</span>
          </div>
          <MiniSparkline data={sparkData} color="#1a1a1a" />
        </div>
      </div>

      <div className="adm__charts">
        <div className="adm__chart-card">
          <h3 className="adm__chart-title">New users · last 14 days</h3>
          <BarChart data={stats.perDay} />
        </div>
        <div className="adm__chart-card">
          <h3 className="adm__chart-title">Total users · growth</h3>
          <LineChart data={cumulative} />
        </div>
      </div>
    </>
  );
}

/* ── Product card tags ────────────────────────────────────────────────────── */

const VARIANT_LABELS: Record<ProductTag['tagVariant'], string> = {
  live: 'Green (live)',
  soon: 'Gold (highlight)',
  later: 'Grey (muted)',
};

function ProductTags() {
  const [tags, setTags] = useState<ProductTagMap>(() =>
    Object.fromEntries(
      PRODUCT_DEFS.map((p) => [p.key, { tag: p.tag, tagVariant: p.tagVariant, order: p.order }]),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    adminApi.getProductTags().then((saved) => {
      if (Object.keys(saved).length > 0) setTags((t) => ({ ...t, ...saved }));
    });
  }, []);

  const patch = (key: string, p: Partial<ProductTag>) =>
    setTags((t) => ({ ...t, [key]: { ...t[key], ...p } }));

  const save = async () => {
    for (const [key, t] of Object.entries(tags)) {
      if (!t.tag.trim()) {
        setMsg({ kind: 'err', text: `Tag text for "${key}" cannot be empty.` });
        return;
      }
    }
    setBusy(true);
    setMsg(null);
    try {
      await adminApi.saveProductTags(tags);
      setMsg({ kind: 'ok', text: 'Saved — the products page shows the new tags immediately.' });
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Failed to save.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="adm__card">
      <h2 className="adm__card-title">Product card tags</h2>
      <p className="adm__hint">
        The badge shown on each product card ("Live", "New", …) and the order the cards appear
        on the products page (1 = shown first). Changes apply to the live products page without a
        code deploy.
      </p>

      <table className="adm__table">
        <thead>
          <tr><th>Order</th><th>Product</th><th>Tag text</th><th>Style</th></tr>
        </thead>
        <tbody>
          {PRODUCT_DEFS.map((p) => (
            <tr key={p.key}>
              <td>
                <input
                  className="adm__input"
                  type="number"
                  min={1}
                  style={{ width: '4.5rem' }}
                  value={tags[p.key]?.order ?? p.order}
                  onChange={(e) => patch(p.key, { order: Number(e.target.value) })}
                />
              </td>
              <td>{p.title}</td>
              <td>
                <input
                  className="adm__input"
                  value={tags[p.key]?.tag ?? ''}
                  maxLength={30}
                  onChange={(e) => patch(p.key, { tag: e.target.value })}
                />
              </td>
              <td>
                <select
                  className="adm__input"
                  value={tags[p.key]?.tagVariant ?? 'live'}
                  onChange={(e) =>
                    patch(p.key, { tagVariant: e.target.value as ProductTag['tagVariant'] })
                  }
                >
                  {Object.entries(VARIANT_LABELS).map(([v, label]) => (
                    <option key={v} value={v}>{label}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {msg && <p className={`adm__notice adm__notice--${msg.kind}`}>{msg.text}</p>}

      <div className="adm__actions">
        <button className="adm__btn adm__btn--primary" disabled={busy} onClick={save}>
          {busy ? 'Saving…' : 'Save tags'}
        </button>
      </div>
    </section>
  );
}

/* ── Email settings ───────────────────────────────────────────────────────── */

const MODE_LABELS: Record<EmailEffective['mode'], string> = {
  gmail: '✓ Gmail SMTP — emails will send',
  resend: '✓ Resend — emails will send',
  'dry-run': '⚠ No provider configured — emails are NOT being sent (dry run)',
};

function EmailSettingsCard() {
  const [cfg, setCfg] = useState<EmailSettings | null>(null);
  const [effective, setEffective] = useState<EmailEffective | null>(null);
  const [gmailUser, setGmailUser] = useState('');
  const [fromName, setFromName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    adminApi.getEmailSettings().then(({ config, effective }) => {
      setCfg(config);
      setEffective(effective);
      setGmailUser(config.gmailUser);
      setFromName(config.fromName);
    }).catch(() => setMsg({ kind: 'err', text: 'Could not load email settings.' }));
  }, []);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await adminApi.saveEmailSettings({
        gmailUser: gmailUser.trim(),
        fromName: fromName.trim(),
        ...(password.trim() ? { gmailAppPassword: password.trim() } : {}),
      });
      setCfg(r.config);
      setEffective(r.effective);
      setPassword('');
      setMsg({ kind: 'ok', text: 'Saved — new emails go out from this account immediately. Use "Send test to me" in New event to verify.' });
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Failed to save.' });
    } finally {
      setBusy(false);
    }
  };

  const clearPassword = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await adminApi.saveEmailSettings({
        gmailUser: gmailUser.trim(),
        fromName: fromName.trim(),
        gmailAppPassword: '',
      });
      setCfg(r.config);
      setEffective(r.effective);
      setPassword('');
      setMsg({ kind: 'ok', text: 'Saved password cleared — falling back to the server environment variable (if set).' });
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Failed.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="adm__card">
      <h2 className="adm__card-title">Email sending</h2>
      <p className="adm__hint">
        The Gmail account event emails are sent from. Change it here anytime — no code deploy
        needed. The password is a Google <strong>App Password</strong> (Google Account → Security →
        2-Step Verification → App passwords), not the normal Gmail password. Leave a field blank to
        keep using the server's environment variable.
      </p>

      {effective && (
        <p className={`adm__notice adm__notice--${effective.mode === 'dry-run' ? 'err' : 'ok'}`}>
          {MODE_LABELS[effective.mode]}
          {effective.mode !== 'dry-run' && <> — sending as <strong>{effective.from}</strong></>}
        </p>
      )}

      <div className="adm__row">
        <div className="adm__col">
          <label className="adm__label" htmlFor="adm-em-user">Sender Gmail address</label>
          <input id="adm-em-user" type="email" className="adm__input" value={gmailUser}
                 placeholder="events@gmail.com" onChange={(e) => setGmailUser(e.target.value)} />
        </div>
        <div className="adm__col">
          <label className="adm__label" htmlFor="adm-em-name">Sender display name</label>
          <input id="adm-em-name" className="adm__input" value={fromName} maxLength={100}
                 placeholder="Nomikos" onChange={(e) => setFromName(e.target.value)} />
        </div>
      </div>

      <label className="adm__label" htmlFor="adm-em-pass">
        Gmail app password {cfg?.hasPassword && <span title="A password is saved">(saved ✓ — type to replace)</span>}
      </label>
      <input id="adm-em-pass" type="password" className="adm__input" value={password}
             autoComplete="new-password"
             placeholder={cfg?.hasPassword ? '•••• •••• •••• ••••  (unchanged)' : '16-character app password'}
             onChange={(e) => setPassword(e.target.value)} />

      {msg && <p className={`adm__notice adm__notice--${msg.kind}`}>{msg.text}</p>}

      <div className="adm__actions">
        <button className="adm__btn adm__btn--primary" disabled={busy} onClick={save}>
          {busy ? 'Saving…' : 'Save email settings'}
        </button>
        {cfg?.hasPassword && (
          <button className="adm__btn adm__btn--ghost" disabled={busy} onClick={clearPassword}>
            Clear saved password
          </button>
        )}
      </div>
    </section>
  );
}

/* ── Billing / subscriptions ─────────────────────────────────────────────── */

function BillingCard() {
  const [cfg, setCfg] = useState<BillingConfigView | null>(null);
  const [allTools, setAllTools] = useState<string[]>([]);
  const [subs, setSubs] = useState<SubscriptionRow[]>([]);
  const [keySecret, setKeySecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    adminApi.getBillingConfig().then(({ config, allTools }) => {
      setCfg(config);
      setAllTools(allTools);
    }).catch(() => setMsg({ kind: 'err', text: 'Could not load billing config.' }));
    adminApi.listSubscriptions().then(setSubs);
  }, []);

  if (!cfg) {
    return (
      <section className="adm__card">
        <h2 className="adm__card-title">Subscriptions &amp; billing</h2>
        <p className="adm__empty">{msg?.text ?? 'Loading…'}</p>
      </section>
    );
  }

  const patchPlan = (i: number, p: Partial<BillingPlan>) =>
    setCfg({ ...cfg, plans: cfg.plans.map((pl, j) => (j === i ? { ...pl, ...p } : pl)) });

  const toggleTool = (i: number, tool: string) => {
    const plan = cfg.plans[i];
    const tools = plan.tools.includes(tool)
      ? plan.tools.filter((t) => t !== tool)
      : [...plan.tools, tool];
    patchPlan(i, { tools });
  };

  const addPlan = () =>
    setCfg({
      ...cfg,
      plans: [
        ...cfg.plans,
        {
          id: `plan${cfg.plans.length + 1}`, name: '', description: '',
          priceInr: 0, periodDays: 30, docsPerPeriod: 10, tools: [...allTools],
        },
      ],
    });

  const removePlan = (i: number) =>
    setCfg({ ...cfg, plans: cfg.plans.filter((_, j) => j !== i) });

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const saved = await adminApi.saveBillingConfig({
        enabled: cfg.enabled,
        keyId: cfg.keyId,
        ...(keySecret.trim() ? { keySecret: keySecret.trim() } : {}),
        plans: cfg.plans,
      });
      setCfg(saved);
      setKeySecret('');
      setMsg({
        kind: 'ok',
        text: saved.enabled
          ? 'Saved — billing is LIVE. Users now see plans and quotas.'
          : 'Saved — billing is OFF. Every tool stays free and unlimited.',
      });
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Failed to save.' });
    } finally {
      setBusy(false);
    }
  };

  const now = new Date().toISOString();
  const activeSubs = subs.filter((s) => s.status === 'active' && s.expires_at > now);
  const totalRevenue = subs.reduce((sum, s) => {
    const plan = cfg.plans.find((p) => p.id === s.plan_id);
    return sum + (plan?.priceInr ?? 0);
  }, 0);

  return (
    <section className="adm__card">
      <h2 className="adm__card-title">Subscriptions &amp; billing</h2>
      <p className="adm__hint">
        Define the plans, their price, how many documents they allow per period, and which tools
        they include — like a streaming subscription, access stops by itself when a plan expires.
        The master switch turns the whole system on or off; while OFF, everything stays free.
      </p>

      <label className="adm__toggle">
        <input
          type="checkbox"
          checked={cfg.enabled}
          onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })}
        />
        <strong>{cfg.enabled ? 'Billing is ON' : 'Billing is OFF'}</strong> — {cfg.enabled
          ? 'users are limited by their plan'
          : 'all tools free and unlimited for everyone'}
      </label>

      {cfg.enabled && subs.length > 0 && (
        <div className="adm__billing-summary">
          <div className="adm__billing-metric">
            <span className="adm__billing-metric-num">{activeSubs.length}</span>
            <span className="adm__billing-metric-label">Active subs</span>
          </div>
          <div className="adm__billing-metric">
            <span className="adm__billing-metric-num">₹{totalRevenue.toLocaleString('en-IN')}</span>
            <span className="adm__billing-metric-label">Total revenue</span>
          </div>
          <div className="adm__billing-metric">
            <span className="adm__billing-metric-num">{subs.length}</span>
            <span className="adm__billing-metric-label">All-time subs</span>
          </div>
          <DonutChart
            value={activeSubs.length}
            max={subs.length || 1}
            label="Active rate"
            color="#2ea043"
          />
        </div>
      )}

      <div className="adm__row">
        <div className="adm__col">
          <label className="adm__label" htmlFor="adm-rzp-id">Razorpay Key ID</label>
          <input id="adm-rzp-id" className="adm__input" value={cfg.keyId}
                 placeholder="rzp_test_…" onChange={(e) => setCfg({ ...cfg, keyId: e.target.value })} />
        </div>
        <div className="adm__col">
          <label className="adm__label" htmlFor="adm-rzp-secret">
            Razorpay Key Secret {cfg.hasKeySecret && <span>(saved ✓ — type to replace)</span>}
          </label>
          <input id="adm-rzp-secret" type="password" className="adm__input" value={keySecret}
                 autoComplete="new-password"
                 placeholder={cfg.hasKeySecret ? '••••••••  (unchanged)' : 'from the Razorpay dashboard'}
                 onChange={(e) => setKeySecret(e.target.value)} />
        </div>
      </div>

      {cfg.plans.map((p, i) => (
        <div key={i} className="adm__plan">
          <div className="adm__plan-head">
            <input className="adm__input adm__plan-name" value={p.name} maxLength={40}
                   placeholder="Plan name" onChange={(e) => patchPlan(i, { name: e.target.value })} />
            <input className="adm__input adm__plan-id" value={p.id} maxLength={30}
                   placeholder="id (e.g. pro)" onChange={(e) => patchPlan(i, { id: e.target.value })} />
            <button className="adm__admin-remove" disabled={busy || cfg.plans.length <= 1}
                    onClick={() => removePlan(i)}>Remove</button>
          </div>
          <input className="adm__input" value={p.description} maxLength={200}
                 placeholder="One-line description shown on the pricing page"
                 onChange={(e) => patchPlan(i, { description: e.target.value })} />
          <div className="adm__row">
            <div className="adm__col">
              <label className="adm__label">Price (₹ per period; 0 = free)</label>
              <input type="number" min={0} className="adm__input" value={p.priceInr}
                     onChange={(e) => patchPlan(i, { priceInr: Number(e.target.value) })} />
            </div>
            <div className="adm__col">
              <label className="adm__label">Period (days)</label>
              <input type="number" min={1} className="adm__input" value={p.periodDays}
                     onChange={(e) => patchPlan(i, { periodDays: Number(e.target.value) })} />
            </div>
            <div className="adm__col">
              <label className="adm__label">Documents / period (-1 = unlimited)</label>
              <input type="number" min={-1} className="adm__input" value={p.docsPerPeriod}
                     onChange={(e) => patchPlan(i, { docsPerPeriod: Number(e.target.value) })} />
            </div>
          </div>
          <div className="adm__plan-tools">
            {allTools.map((t) => (
              <label key={t} className="adm__plan-tool">
                <input type="checkbox" checked={p.tools.includes(t)}
                       onChange={() => toggleTool(i, t)} />
                {TOOL_LABELS[t] ?? t}
              </label>
            ))}
          </div>
        </div>
      ))}

      <div className="adm__actions">
        <button className="adm__btn adm__btn--outline" disabled={busy} onClick={addPlan}>
          + Add plan
        </button>
        <button className="adm__btn adm__btn--primary" disabled={busy} onClick={save}>
          {busy ? 'Saving…' : 'Save billing settings'}
        </button>
      </div>
      {msg && <p className={`adm__notice adm__notice--${msg.kind}`}>{msg.text}</p>}

      <h3 className="adm__chart-title" style={{ marginTop: '1.5rem' }}>
        Active subscriptions ({activeSubs.length})
      </h3>
      {subs.length === 0 ? (
        <p className="adm__empty">No paid subscriptions yet.</p>
      ) : (
        <table className="adm__table">
          <thead>
            <tr><th>User</th><th>Plan</th><th>Status</th><th>Expires</th></tr>
          </thead>
          <tbody>
            {subs.slice(0, 50).map((s) => (
              <tr key={s.id}>
                <td>{s.email}</td>
                <td>{s.plan_id}</td>
                <td>
                  <span className={`adm__status ${
                    s.status === 'active' && s.expires_at > now ? 'adm__status--active' :
                    s.status === 'cancelled' ? 'adm__status--cancel' : 'adm__status--expired'
                  }`}>
                    {s.status === 'active' && s.expires_at > now ? 'Active'
                      : s.status === 'cancelled' ? 'Cancelled' : 'Expired'}
                  </span>
                </td>
                <td>{new Date(s.expires_at).toLocaleDateString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/* ── Manage admins ────────────────────────────────────────────────────────── */

function ManageAdmins({ admins, self, onChange }: { admins: AdminEntry[]; self?: string; onChange: () => void }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const add = async () => {
    const e = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
      setMsg({ kind: 'err', text: 'Enter a valid email.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await adminApi.addAdmin(e);
      setEmail('');
      setMsg({ kind: 'ok', text: `${e} is now an admin.` });
      onChange();
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Failed.' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (e: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await adminApi.removeAdmin(e);
      setMsg({ kind: 'ok', text: `${e} removed.` });
      onChange();
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Failed.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="adm__card">
      <h2 className="adm__card-title">Admins</h2>
      <p className="adm__hint">
        Anyone you add here can sign in and access this workspace. Only an existing admin can grant
        access — no one can make themselves an admin.
      </p>

      <ul className="adm__admins">
        {admins.map((a) => (
          <li key={a.email} className="adm__admin-row">
            <span className="adm__admin-email">{a.email}</span>
            {a.protected ? (
              <span className="adm__admin-tag" title="Configured in environment — protected">🔒 owner</span>
            ) : a.email === self ? (
              <span className="adm__admin-tag">you</span>
            ) : (
              <button className="adm__admin-remove" disabled={busy} onClick={() => remove(a.email)}>
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="adm__admin-add">
        <input
          className="adm__input"
          type="email"
          placeholder="new-admin@email.com"
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          onKeyDown={(ev) => ev.key === 'Enter' && add()}
        />
        <button className="adm__btn adm__btn--primary" disabled={busy} onClick={add}>
          Add admin
        </button>
      </div>
      {msg && <p className={`adm__notice adm__notice--${msg.kind}`}>{msg.text}</p>}
    </section>
  );
}

/* ── New event ────────────────────────────────────────────────────────────── */

function renderPreviewHtml(
  title: string, description: string,
  eventDate: string, imageUrl: string, linkUrl: string,
): string {
  const dateStr = eventDate
    ? new Date(eventDate + 'T00:00:00').toLocaleDateString('en-IN', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })
    : '';
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const paragraphs = (description || ' ')
    .split(/\n+/)
    .map((p) => `<p style="margin:0 0 12px;line-height:1.6;color:#333;">${esc(p)}</p>`)
    .join('');
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f1ea;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="text-align:center;padding:18px 0 26px;">
      <span style="font-size:30px;font-weight:bold;color:#1a1a1a;letter-spacing:-0.5px;">Nomikos</span><span style="font-size:30px;font-weight:bold;color:#b8962e;">.</span>
    </div>
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e8e2d4;">
      ${imageUrl.trim() ? `<img src="${imageUrl}" alt="" width="560" style="display:block;width:100%;height:auto;" />` : ''}
      <div style="padding:28px 30px;">
        <h1 style="margin:0 0 6px;font-size:24px;color:#1a1a1a;">${esc(title || 'Untitled')}</h1>
        ${dateStr ? `<p style="margin:0 0 18px;font-size:14px;color:#b8962e;font-weight:bold;">${dateStr}</p>` : ''}
        ${paragraphs}
        ${linkUrl.trim() ? `<div style="text-align:center;margin:26px 0 8px;"><a href="${linkUrl}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;">View details</a></div>` : ''}
      </div>
    </div>
    <p style="text-align:center;font-size:11px;color:#999;margin-top:22px;line-height:1.6;">
      You are receiving this because you have an account on Nomikos.<br/>
      Reply to this email to unsubscribe from event updates.
    </p>
  </div>
</body></html>`;
}

function NewEvent({ subscriberCount, onCreated, selfEmail }: { subscriberCount: number; onCreated: () => void; selfEmail?: string }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const previewHtml = renderPreviewHtml(title, description, eventDate, imageUrl, linkUrl);

  const submit = async (sendNow: boolean) => {
    if (!title.trim() || !description.trim()) {
      setNotice({ kind: 'err', text: 'Title and description are required.' });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const { send } = await adminApi.createEvent({
        title: title.trim(),
        description: description.trim(),
        event_date: eventDate,
        image_url: imageUrl.trim() || undefined,
        link_url: linkUrl.trim() || undefined,
        sendNow,
      });
      setNotice({ kind: 'ok', text: summarise(sendNow, send) });
      setTitle(''); setDescription(''); setEventDate(''); setImageUrl(''); setLinkUrl('');
      onCreated();
    } catch (e) {
      setNotice({ kind: 'err', text: e instanceof Error ? e.message : 'Failed to create event.' });
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    if (!title.trim() || !description.trim()) {
      setNotice({ kind: 'err', text: 'Title and description are required for a test send.' });
      return;
    }
    setTestBusy(true);
    setNotice(null);
    try {
      const r = await adminApi.testSend({
        title: title.trim(),
        description: description.trim(),
        event_date: eventDate,
        image_url: imageUrl.trim() || undefined,
        link_url: linkUrl.trim() || undefined,
      });
      setNotice({
        kind: 'ok',
        text: r.dryRun
          ? 'DRY RUN — no provider configured. Email was not sent.'
          : `Test email sent to ${selfEmail || 'you'}.`,
      });
    } catch (e) {
      setNotice({ kind: 'err', text: e instanceof Error ? e.message : 'Test send failed.' });
    } finally {
      setTestBusy(false);
    }
  };

  return (
    <section className="adm__card">
      <div className="adm__card-header">
        <h2 className="adm__card-title" style={{ margin: 0 }}>New event</h2>
        <button
          type="button"
          className={`adm__btn adm__btn--outline adm__btn--sm${showPreview ? ' adm__btn--active' : ''}`}
          onClick={() => setShowPreview((v) => !v)}
        >
          {showPreview ? 'Hide preview' : 'Preview email'}
        </button>
      </div>

      <div className={`adm__compose${showPreview ? ' adm__compose--split' : ''}`}>
        <div className="adm__compose-form">
          <label className="adm__label" htmlFor="adm-title">Title *</label>
          <input id="adm-title" className="adm__input" value={title} maxLength={200}
                 placeholder="e.g. Nomikos Legal-Tech Webinar" onChange={(e) => setTitle(e.target.value)} />

          <label className="adm__label" htmlFor="adm-desc">Description *</label>
          <textarea id="adm-desc" className="adm__textarea" value={description} rows={5} maxLength={5000}
                    placeholder="What is the event about? This text goes into the email."
                    onChange={(e) => setDescription(e.target.value)} />

          <div className="adm__row">
            <div className="adm__col">
              <label className="adm__label" htmlFor="adm-date">Event date</label>
              <input id="adm-date" type="date" className="adm__input" value={eventDate}
                     onChange={(e) => setEventDate(e.target.value)} />
            </div>
            <div className="adm__col">
              <label className="adm__label" htmlFor="adm-link">Details / registration link</label>
              <input id="adm-link" type="url" className="adm__input" value={linkUrl}
                     placeholder="https://…" onChange={(e) => setLinkUrl(e.target.value)} />
            </div>
          </div>

          <label className="adm__label" htmlFor="adm-img">Banner image URL</label>
          <input id="adm-img" type="url" className="adm__input" value={imageUrl}
                 placeholder="https://… (shown at the top of the email)"
                 onChange={(e) => setImageUrl(e.target.value)} />
          {imageUrl.trim() && !showPreview && (
            <img className="adm__img-preview" src={imageUrl} alt="banner preview"
                 onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
          )}
        </div>

        {showPreview && (
          <div className="adm__compose-preview">
            <p className="adm__preview-label">Live preview</p>
            <iframe
              className="adm__preview-iframe"
              srcDoc={previewHtml}
              title="Email preview"
              sandbox="allow-same-origin"
            />
          </div>
        )}
      </div>

      {notice && <p className={`adm__notice adm__notice--${notice.kind}`}>{notice.text}</p>}

      <div className="adm__actions">
        <button type="button" className="adm__btn adm__btn--primary" disabled={busy || testBusy}
                onClick={() => submit(true)}>
          {busy ? 'Working…' : `Create & email ${subscriberCount} user${subscriberCount === 1 ? '' : 's'}`}
        </button>
        <button type="button" className="adm__btn adm__btn--outline" disabled={busy || testBusy}
                onClick={() => submit(false)}>
          Save without sending
        </button>
        <button type="button" className="adm__btn adm__btn--ghost" disabled={busy || testBusy}
                onClick={sendTest} title={`Send a test to ${selfEmail || 'yourself'}`}>
          {testBusy ? 'Sending…' : 'Send test to me'}
        </button>
      </div>
    </section>
  );
}

/* ── Past events ──────────────────────────────────────────────────────────── */

function PastEvents({ events, onChange }: { events: AdminEvent[]; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const del = async (ev: AdminEvent) => {
    if (!window.confirm(`Delete event "${ev.title}"? This only removes the record — emails already sent are unaffected.`)) return;
    setBusy(true);
    setMsg(null);
    try {
      await adminApi.deleteEvent(ev.id);
      setMsg({ kind: 'ok', text: `"${ev.title}" deleted.` });
      onChange();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Failed to delete.' });
    } finally {
      setBusy(false);
    }
  };

  const clearAll = async () => {
    if (!window.confirm(`Delete ALL ${events.length} events? This cannot be undone.`)) return;
    setBusy(true);
    setMsg(null);
    try {
      await adminApi.clearEvents();
      setMsg({ kind: 'ok', text: 'All events cleared.' });
      onChange();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Failed to clear.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="adm__card">
      <div className="adm__card-header">
        <h2 className="adm__card-title" style={{ margin: 0 }}>Past events</h2>
        {events.length > 0 && (
          <button className="adm__btn adm__btn--outline adm__btn--sm" disabled={busy} onClick={clearAll}>
            Clear all events
          </button>
        )}
      </div>
      {events.length === 0 ? (
        <p className="adm__empty">No events yet.</p>
      ) : (
        <table className="adm__table">
          <thead>
            <tr><th>Title</th><th>Event date</th><th>Emailed</th><th>Created</th><th /></tr>
          </thead>
          <tbody>
            {events.map((ev) => (
              <tr key={ev.id}>
                <td>{ev.title}</td>
                <td>{ev.event_date || '—'}</td>
                <td>{ev.sent_at ? `✓ ${ev.sent_count} sent` : 'not sent'}</td>
                <td>{new Date(ev.created_at).toLocaleDateString()}</td>
                <td>
                  <button className="adm__admin-remove" disabled={busy} onClick={() => del(ev)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {msg && <p className={`adm__notice adm__notice--${msg.kind}`}>{msg.text}</p>}
    </section>
  );
}

/* ── Tool usage stats ─────────────────────────────────────────────────────── */

const TOOL_LABELS: Record<string, string> = {
  'document-prep': 'Document Prep',
  'page-numbering': 'Page Numbering',
  'annexures': 'Annexures',
  'signatures': 'Signatures',
  'bookmarks': 'Bookmarks',
  'index-generator': 'Index Generator',
};

const TOOL_COLORS: Record<string, string> = {
  'document-prep': '#1a1a1a',
  'page-numbering': '#b8962e',
  'annexures': '#2e6fb8',
  'signatures': '#8b3a2a',
  'bookmarks': '#2ea043',
  'index-generator': '#7c3aed',
};

function ToolStats({ stats }: { stats: ToolStat[] }) {
  const total = stats.reduce((a, s) => a + s.count, 0);
  const max = Math.max(...stats.map((s) => s.count), 1);

  return (
    <section className="adm__card">
      <div className="adm__card-header">
        <h2 className="adm__card-title" style={{ margin: 0 }}>Tool usage</h2>
        {total > 0 && <span className="adm__tool-total">{total} total runs</span>}
      </div>
      {stats.length === 0 ? (
        <p className="adm__empty">No usage data yet — will populate as users complete tool runs.</p>
      ) : (
        <div className="adm__tool-stats">
          {stats.map((s) => {
            const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
            const color = TOOL_COLORS[s.tool] ?? '#1a1a1a';
            return (
              <div key={s.tool} className="adm__tool-row">
                <span className="adm__tool-name">{TOOL_LABELS[s.tool] ?? s.tool}</span>
                <div className="adm__tool-bar-wrap">
                  <div className="adm__tool-bar" style={{ width: `${(s.count / max) * 100}%`, background: color }} />
                </div>
                <span className="adm__tool-count">{s.count}</span>
                <span className="adm__tool-pct">{pct}%</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ── User feedback ────────────────────────────────────────────────────────── */

function FeedbackList({ entries, onChange }: { entries: FeedbackEntry[]; onChange: () => void }) {
  const [busy, setBusy] = useState(false);

  const clearAll = async () => {
    if (!window.confirm(`Delete ALL ${entries.length} feedback entries? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await adminApi.clearFeedback();
      onChange();
    } catch {
      /* refresh shows current state either way */
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="adm__card">
      <div className="adm__card-header">
        <h2 className="adm__card-title" style={{ margin: 0 }}>User feedback</h2>
        {entries.length > 0 && (
          <button className="adm__btn adm__btn--outline adm__btn--sm" disabled={busy} onClick={clearAll}>
            Clear all feedback
          </button>
        )}
      </div>
      {entries.length === 0 ? (
        <p className="adm__empty">No feedback yet.</p>
      ) : (
        <ul className="adm__feedback-list">
          {entries.map((f) => (
            <li key={f.id} className="adm__feedback-item">
              <div className="adm__feedback-meta">
                <span className="adm__feedback-email">{f.email || 'anonymous'}</span>
                {f.tool && <span className="adm__feedback-tag">{TOOL_LABELS[f.tool] ?? f.tool}</span>}
                <span className="adm__feedback-date">{new Date(f.created_at).toLocaleDateString('en-IN')}</span>
              </div>
              <p className="adm__feedback-msg">{f.message}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ── Integrations (remove.bg) ─────────────────────────────────────────────── */

function IntegrationsCard() {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [key, setKey] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getRemoveBgStatus().then((r) => setHasKey(r.hasKey)).catch(() => {});
  }, []);

  const save = async () => {
    if (!key.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      await saveRemoveBgKey(key.trim());
      setHasKey(true);
      setKey('');
      setMsg({ kind: 'ok', text: 'API key saved.' });
    } catch {
      setMsg({ kind: 'err', text: 'Could not save key.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="adm__card">
      <h2 className="adm__card-title">Integrations</h2>
      <div className="adm__field">
        <label className="adm__field-label">
          Remove.bg API Key
          {hasKey !== null && (
            <span className={`adm__status-badge adm__status-badge--${hasKey ? 'active' : 'inactive'}`}>
              {hasKey ? 'Configured' : 'Not set'}
            </span>
          )}
        </label>
        <p className="adm__field-hint">
          Used to remove signature image backgrounds before stamping. Get a key at remove.bg/api.
        </p>
        <div className="adm__inline-form">
          <input
            type="password"
            className="adm__input"
            placeholder={hasKey ? '••••••••  (replace)' : 'Paste your remove.bg API key'}
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <button className="adm__btn adm__btn--primary" disabled={busy || !key.trim()} onClick={save}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
        {msg && <p className={msg.kind === 'ok' ? 'adm__msg--ok' : 'adm__msg--err'}>{msg.text}</p>}
      </div>
    </section>
  );
}

function summarise(sendNow: boolean, send: SendSummary | null): string {
  if (!sendNow) return 'Event saved (no email sent).';
  if (!send) return 'Event saved.';
  if (send.dryRun) {
    return `Event saved. Email is in DRY-RUN mode (no RESEND_API_KEY configured) — would have emailed ${send.sent} user(s).`;
  }
  return `Event saved and emailed to ${send.sent} user(s)${send.failed ? ` (${send.failed} failed)` : ''}.`;
}
