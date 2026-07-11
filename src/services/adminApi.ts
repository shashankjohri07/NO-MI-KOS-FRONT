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

export interface ToolStat {
  tool: string;
  count: number;
}

export interface FeedbackEntry {
  id: string;
  email: string | null;
  message: string;
  tool: string | null;
  created_at: string;
}

/** Card tag override per product key, editable from the admin dashboard. */
export interface ProductTag {
  tag: string;
  tagVariant: 'live' | 'soon' | 'later';
}
export type ProductTagMap = Record<string, ProductTag>;

/** Email sender settings as the admin dashboard sees them — the app
 * password itself is never sent back, only whether one is saved. */
export interface EmailSettings {
  gmailUser: string;
  fromName: string;
  hasPassword: boolean;
}
export interface EmailEffective {
  from: string;
  user: string;
  mode: 'gmail' | 'resend' | 'dry-run';
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

  async getToolStats(): Promise<ToolStat[]> {
    try {
      const r = await client.get<{ ok: boolean; stats: ToolStat[] }>('/admin/tool-stats');
      return r.data.stats ?? [];
    } catch { return []; }
  },

  async listFeedback(): Promise<FeedbackEntry[]> {
    try {
      const r = await client.get<{ ok: boolean; entries: FeedbackEntry[] }>('/admin/feedback');
      return r.data.entries ?? [];
    } catch { return []; }
  },

  async testSend(input: Omit<CreateEventInput, 'sendNow'>): Promise<{ sent: number; dryRun: boolean }> {
    const r = await client.post<{ ok: boolean; sent: number; dryRun: boolean; error?: string }>(
      '/admin/events/test-send',
      input,
    );
    if (!r.data.ok) throw new Error(r.data.error || 'Failed to send test email');
    return { sent: r.data.sent, dryRun: r.data.dryRun };
  },

  // Public read — the products page calls this too (via fetchProductTags
  // below); the admin dashboard uses it to prefill the editor.
  async getProductTags(): Promise<ProductTagMap> {
    try {
      const r = await client.get<{ ok: boolean; tags: ProductTagMap }>('/products/config');
      return r.data.tags ?? {};
    } catch { return {}; }
  },

  async saveProductTags(tags: ProductTagMap): Promise<void> {
    const r = await client.put<{ ok: boolean; error?: string }>('/admin/products/config', { tags });
    if (!r.data.ok) throw new Error(r.data.error || 'Failed to save product tags');
  },

  async deleteEvent(id: string): Promise<void> {
    const r = await client.delete<{ ok: boolean; error?: string }>(`/admin/events/${encodeURIComponent(id)}`);
    if (!r.data.ok) throw new Error(r.data.error || 'Failed to delete event');
  },

  async clearEvents(): Promise<void> {
    const r = await client.delete<{ ok: boolean; error?: string }>('/admin/events');
    if (!r.data.ok) throw new Error(r.data.error || 'Failed to clear events');
  },

  async clearFeedback(): Promise<void> {
    const r = await client.delete<{ ok: boolean; error?: string }>('/admin/feedback');
    if (!r.data.ok) throw new Error(r.data.error || 'Failed to clear feedback');
  },

  async getEmailSettings(): Promise<{ config: EmailSettings; effective: EmailEffective }> {
    const r = await client.get<{ ok: boolean; config: EmailSettings; effective: EmailEffective }>(
      '/admin/email/config',
    );
    return { config: r.data.config, effective: r.data.effective };
  },

  /** Pass gmailAppPassword: undefined to keep the saved one, '' to clear it. */
  async saveEmailSettings(input: {
    gmailUser: string;
    fromName: string;
    gmailAppPassword?: string;
  }): Promise<{ config: EmailSettings; effective: EmailEffective }> {
    const r = await client.put<{
      ok: boolean; config: EmailSettings; effective: EmailEffective; error?: string;
    }>('/admin/email/config', input);
    if (!r.data.ok) throw new Error(r.data.error || 'Failed to save email settings');
    return { config: r.data.config, effective: r.data.effective };
  },
};

/** Public, unauthenticated read of the product tag config for the landing /
 * products page. Silent {} on failure — cards fall back to their built-in
 * defaults. */
export async function fetchProductTags(): Promise<ProductTagMap> {
  try {
    const r = await fetch(`${API_BASE_URL.replace(/\/+$/, '')}/products/config`);
    if (!r.ok) return {};
    const data = await r.json();
    return data?.tags ?? {};
  } catch {
    return {};
  }
}

/** Fire-and-forget: register the signed-in user's email for event updates.
 * Called after successful login/signup; failures are silent by design — the
 * user's auth flow must never break because the subscribe call hiccuped. */
export function subscribeForUpdates(email: string): void {
  client.post('/subscribe', { email }).catch(() => {});
}
