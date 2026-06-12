import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  adminApi,
  type AdminEvent,
  type AdminEntry,
  type DashboardStats,
  type SendSummary,
  type Whoami,
} from '../../services/adminApi';
import { BarChart, LineChart } from './Charts';
import '../../styles/Admin.css';

/**
 * Admin workspace — dashboard stats, manage admins, and create/email events.
 * Access is decided by the backend's /admin/whoami; non-admins are bounced
 * home. Normal users never reach here and their experience is untouched.
 */
export default function Admin() {
  const navigate = useNavigate();
  const [who, setWho] = useState<Whoami | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [admins, setAdmins] = useState<AdminEntry[]>([]);

  const refresh = useCallback(async () => {
    try {
      const [s, e, a] = await Promise.all([adminApi.stats(), adminApi.listEvents(), adminApi.listAdmins()]);
      setStats(s);
      setEvents(e);
      setAdmins(a);
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

  if (!who) return <div className="adm"><p className="adm__loading">Checking access…</p></div>;
  if (!who.isAdmin) return null; // redirecting

  return (
    <div className="adm">
      <div className="adm__container">
        {/* Workspace switcher — admin has two: this dashboard and the normal app. */}
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
        </header>

        <StatsSection stats={stats} />

        <ManageAdmins admins={admins} self={who.email} onChange={refresh} />

        <NewEvent subscriberCount={stats?.totalUsers ?? 0} onCreated={refresh} />

        <PastEvents events={events} />
      </div>
    </div>
  );
}

/* ── Stats + charts ───────────────────────────────────────────────────────── */

function StatsSection({ stats }: { stats: DashboardStats | null }) {
  if (!stats) return <section className="adm__card"><p className="adm__empty">Loading stats…</p></section>;
  const cumulative = (() => {
    let run = stats.totalUsers - stats.perDay.reduce((a, d) => a + d.count, 0);
    return stats.perDay.map((d) => ({ date: d.date, count: (run += d.count) }));
  })();

  return (
    <>
      <div className="adm__stats">
        <StatCard num={stats.totalUsers} label="Total users" />
        <StatCard num={stats.newToday} label="New today" accent />
        <StatCard num={stats.newThisWeek} label="New this week" />
        <StatCard num={stats.totalEvents} label="Events created" />
        <StatCard num={stats.emailsSent} label="Emails sent" />
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

function StatCard({ num, label, accent }: { num: number; label: string; accent?: boolean }) {
  return (
    <div className={`adm__stat${accent ? ' adm__stat--accent' : ''}`}>
      <span className="adm__stat-num">{num.toLocaleString()}</span>
      <span className="adm__stat-label">{label}</span>
    </div>
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

function NewEvent({ subscriberCount, onCreated }: { subscriberCount: number; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

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

  return (
    <section className="adm__card">
      <h2 className="adm__card-title">New event</h2>

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
      {imageUrl.trim() && (
        <img className="adm__img-preview" src={imageUrl} alt="banner preview"
             onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
      )}

      {notice && <p className={`adm__notice adm__notice--${notice.kind}`}>{notice.text}</p>}

      <div className="adm__actions">
        <button type="button" className="adm__btn adm__btn--primary" disabled={busy}
                onClick={() => submit(true)}>
          {busy ? 'Working…' : `Create & email ${subscriberCount} user${subscriberCount === 1 ? '' : 's'}`}
        </button>
        <button type="button" className="adm__btn adm__btn--outline" disabled={busy}
                onClick={() => submit(false)}>
          Save without sending
        </button>
      </div>
    </section>
  );
}

/* ── Past events ──────────────────────────────────────────────────────────── */

function PastEvents({ events }: { events: AdminEvent[] }) {
  return (
    <section className="adm__card">
      <h2 className="adm__card-title">Past events</h2>
      {events.length === 0 ? (
        <p className="adm__empty">No events yet.</p>
      ) : (
        <table className="adm__table">
          <thead>
            <tr><th>Title</th><th>Event date</th><th>Emailed</th><th>Created</th></tr>
          </thead>
          <tbody>
            {events.map((ev) => (
              <tr key={ev.id}>
                <td>{ev.title}</td>
                <td>{ev.event_date || '—'}</td>
                <td>{ev.sent_at ? `✓ ${ev.sent_count} sent` : 'not sent'}</td>
                <td>{new Date(ev.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
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
