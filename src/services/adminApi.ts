import axios from 'axios';

// Same-origin '/api' proxy (vercel.json + nginx.conf + vite proxy) — cookies
// set by the auth service via the '/auth-api' proxy are host-scoped, so the
// browser attaches them here too and the backend can verify identity.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // event creation waits for the email blast
  withCredentials: true,
});

export interface Whoami {
  ok: boolean;
  signedIn: boolean;
  email?: string;
  isAdmin: boolean;
}

export interface AdminEvent {
  id: string;
  title: string;
  description: string;
  event_date: string;
  image_url: string | null;
  link_url: string | null;
  created_by: string;
  created_at: string;
  sent_at: string | null;
  sent_count: number;
}

export interface CreateEventInput {
  title: string;
  description: string;
  event_date: string;
  image_url?: string;
  link_url?: string;
  sendNow: boolean;
}

export interface SendSummary {
  sent: number;
  failed: number;
  dryRun: boolean;
}

export interface DashboardStats {
  totalUsers: number;
  newToday: number;
  newThisWeek: number;
  totalEvents: number;
  emailsSent: number;
  perDay: { date: string; count: number }[];
}

export interface AdminEntry {
  email: string;
  protected: boolean;
}

export const adminApi = {
  async whoami(): Promise<Whoami> {
    try {
      const r = await client.get<Whoami>('/admin/whoami');
      return r.data;
    } catch {
      return { ok: false, signedIn: false, isAdmin: false };
    }
  },

  async listEvents(): Promise<AdminEvent[]> {
    const r = await client.get<{ ok: boolean; events: AdminEvent[] }>('/admin/events');
    return r.data.events ?? [];
  },

  async subscriberCount(): Promise<number> {
    const r = await client.get<{ ok: boolean; count: number }>('/admin/subscribers');
    return r.data.count ?? 0;
  },

  async createEvent(input: CreateEventInput): Promise<{ event: AdminEvent; send: SendSummary | null }> {
    const r = await client.post<{ ok: boolean; event: AdminEvent; send: SendSummary | null; error?: string }>(
      '/admin/events',
      input,
    );
    if (!r.data.ok) throw new Error(r.data.error || 'Failed to create event');
    return { event: r.data.event, send: r.data.send };
  },

  async stats(): Promise<DashboardStats> {
    const r = await client.get<{ ok: boolean; stats: DashboardStats }>('/admin/stats');
    return r.data.stats;
  },

  async listAdmins(): Promise<AdminEntry[]> {
    const r = await client.get<{ ok: boolean; admins: AdminEntry[] }>('/admin/admins');
    return r.data.admins ?? [];
  },

  async addAdmin(email: string): Promise<void> {
    const r = await client.post<{ ok: boolean; error?: string }>('/admin/admins', { email });
    if (!r.data.ok) throw new Error(r.data.error || 'Failed to add admin');
  },

  async removeAdmin(email: string): Promise<void> {
    const r = await client.delete<{ ok: boolean; error?: string }>('/admin/admins', { data: { email } });
    if (!r.data.ok) throw new Error(r.data.error || 'Failed to remove admin');
  },
};

/** Fire-and-forget: register the signed-in user's email for event updates.
 * Called after successful login/signup; failures are silent by design — the
 * user's auth flow must never break because the subscribe call hiccuped. */
export function subscribeForUpdates(email: string): void {
  client.post('/subscribe', { email }).catch(() => {});
}
