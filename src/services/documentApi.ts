import axios from 'axios';
import { signalBackendWaking } from '../components/ProcessingPanel';

// Default to the same-origin '/api' proxy (configured in nginx.conf +
// vite.config.ts). Same-origin means CORS never applies — no preflight, no
// dependency on the backend's Access-Control-Allow-Origin / FRONTEND_URL.
//
// Rollback: set VITE_API_BASE_URL=https://no-mi-kos-back.onrender.com/api/
// in the deploy environment to bypass the proxy and hit the backend
// directly. No code change needed.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/';

// Tolerates VITE_API_BASE_URL with or without a trailing slash. Vite's local
// proxy convention is '/api' (no slash); Render production URL is '/api/'.
const apiUrl = (path: string): string => {
  const base = API_BASE_URL.replace(/\/+$/, '');
  return `${base}/${path.replace(/^\/+/, '')}`;
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 600000, // 10 min for large PDFs with OCR
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface UploadedFile {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  path: string;
}

export interface PageReference {
  page_num: number;
  locations?: Array<{
    text: string;
    bbox: number[];
    font: string;
    size: number;
  }>;
  matches?: string[];
}

export interface ErrorResult {
  rule_id: string;
  status: 'fail' | 'warning' | 'pass' | 'info';
  severity: 'high' | 'medium' | 'low';
  description: string;
  detail: string;
  source?: string;
  missing?: string[];
  found?: string[];
  page_references?: PageReference[];
  expected_pages?: string;
}

export interface ErrorReport {
  ok: boolean;
  mode?: 'detect' | 'write' | 'both';
  summary: {
    document_type: string;
    total_pages: number;
    total_rules_checked: number;
    errors_count: number;
    warnings_count: number;
    passed_count: number;
    compliance_score: number;
    info_count: number;
    index_end_page?: number;
  };
  errors: ErrorResult[];
  warnings: ErrorResult[];
  passed: ErrorResult[];
  info: ErrorResult[];
  all_results: ErrorResult[];
  ocr_method: string;
  file: string;
  error?: string;
  annotated_pdf?: string;
  merged_pdf?: string;
  paginated_pdf?: string;
}

export interface BookmarkHeading {
  title: string;
  level: number;
  page: number;
  y?: number;
  confidence: number;
  source: 'auto_detected' | 'existing_toc' | 'user_created';
}

export interface BookmarkDetection {
  ok: boolean;
  existing_toc: boolean;
  headings: BookmarkHeading[];
  error?: string;
}

export interface IndexRow {
  title: string;
  description?: string;
  pages: string;
}

export interface IndexParty {
  lines: string[];
  role: string;
}

export interface IndexMatter {
  label: string;
  parties: IndexParty[];
}

export interface IndexPayload {
  court: string[];
  caseLines: string[];
  matters: IndexMatter[];
  indexTitle: string;
  rows: IndexRow[];
  advocates: string[];
  place: string;
  date: string;
}

export const documentApi = {
  async uploadDocument(file: File): Promise<UploadedFile> {
    const formData = new FormData();
    formData.append('document', file);

    const response = await apiClient.post<{ success: boolean; data: UploadedFile; error?: string }>(
      '/upload',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return response.data.data;
  },

  async detectErrors(
    files: File | File[],
    indexEndPage: number,
    mode: 'detect' | 'write' | 'both',
    onProgress?: (percent: number) => void
  ): Promise<ErrorReport> {
    const formData = new FormData();
    const fileList = Array.isArray(files) ? files : [files];
    for (const f of fileList) {
      formData.append('document', f);
    }
    // 1-indexed last page of the index; pages 1..N are skipped from the
    // pagination check. 0 means "no skip".
    formData.append('indexEndPage', String(Math.max(0, Math.floor(indexEndPage || 0))));
    // detect = rule check only; write = stamp page numbers only (fast path,
    // skips text extraction + rules); both = do everything.
    formData.append('mode', mode);

    const response = await apiClient.post<ErrorReport>('/detect-errors', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percent);
        }
      },
    });

    return response.data;
  },

  // Streaming write — backend pipes the numbered PDF directly into the
  // response, no JSON, no base64 inflation. Returns the Blob plus a
  // server-suggested filename.
  //
  // `annexures` are optional. When supplied, each annexure file becomes one
  // annexure: file 1 gets "Annexure A-1" stamped on its first page,
  // file 2 gets "Annexure A-2", and so on. They are appended after the
  // merged main PDF and pagination continues across them.
  // Async-first: stage the upload as a background job (POST /api/jobs/...),
  // poll until the worker finishes, then fetch the result. This decouples
  // the user's request from the heavy PDF processing — no HTTP timeout / OOM
  // on big files, survives concurrent load. If the backend has no async
  // pipeline configured (503) or doesn't know the endpoint (404), it
  // transparently falls back to the legacy synchronous stream.
  //
  // `onProgress` (optional) reports {state, progress} during polling so the
  // UI can show "Queued / Processing N%". Existing 4-arg callers are
  // unaffected.
  async writePagination(
    files: File | File[],
    indexEndPage: number,
    annexures: File[] = [],
    signatures?: { client?: File | null; advocate?: File | null },
    /** Kept in the signature for backwards-compat with existing callers
     * that pass an onProgress (no-op now — the pipeline is synchronous). */
    _onProgress?: (info: { state: string; progress: number }) => void,
    /**
     * Optional comma+range spec ("1, 3-5, 8") of additional MAIN-document
     * pages — referenced by their stamped page number — that should also
     * get client/advocate signatures. Annexure pages already auto-sign on
     * every page, so out-of-range entries are silently dropped server-side.
     * Empty / undefined = preserve current behaviour.
     */
    signPages?: string,
    /**
     * Optional SEPARATE signature images for the special main-document pages
     * named in `signPages`. Independent of `signatures` (which sign every
     * annexure page). When omitted, the backend falls back to `signatures`
     * for the special pages — preserving older callers' behaviour.
     */
    specialSignatures?: { client?: File | null; advocate?: File | null }
  ): Promise<{ blob: Blob; filename: string }> {
    void _onProgress;
    const fileList = Array.isArray(files) ? files : [files];
    const fd = new FormData();
    for (const f of fileList) fd.append('document', f);
    for (const f of annexures) fd.append('annex', f);
    if (signatures?.client) fd.append('clientSignature', signatures.client);
    if (signatures?.advocate) fd.append('advocateSignature', signatures.advocate);
    if (specialSignatures?.client) fd.append('specialSignatureClient', specialSignatures.client);
    if (specialSignatures?.advocate)
      fd.append('specialSignatureAdvocate', specialSignatures.advocate);
    fd.append('indexEndPage', String(Math.max(0, Math.floor(indexEndPage || 0))));
    if (signPages && signPages.trim()) fd.append('signPages', signPages.trim());

    const fallbackName = `${annexures.length ? 'NUMBERED_WITH_ANNEXURES_' : 'NUMBERED_'}${(
      fileList[0]?.name || 'document'
    ).replace(/\.pdf$/i, '')}.pdf`;

    // Render free-tier dynos sleep after ~15 min idle; the first request
    // returns a gateway error while the dyno cold-starts. Wake + retry once.
    const GATEWAY = new Set([502, 503, 504]);
    let resp = await fetch(apiUrl('write-pagination'), { method: 'POST', body: fd });
    if (GATEWAY.has(resp.status)) {
      await waitForBackendAwake();
      // FormData can't be re-sent on Safari; rebuild defensively.
      const fdRetry = new FormData();
      for (const f of fileList) fdRetry.append('document', f);
      for (const f of annexures) fdRetry.append('annex', f);
      if (signatures?.client) fdRetry.append('clientSignature', signatures.client);
      if (signatures?.advocate) fdRetry.append('advocateSignature', signatures.advocate);
      if (specialSignatures?.client)
        fdRetry.append('specialSignatureClient', specialSignatures.client);
      if (specialSignatures?.advocate)
        fdRetry.append('specialSignatureAdvocate', specialSignatures.advocate);
      fdRetry.append('indexEndPage', String(Math.max(0, Math.floor(indexEndPage || 0))));
      if (signPages && signPages.trim()) fdRetry.append('signPages', signPages.trim());
      resp = await fetch(apiUrl('write-pagination'), { method: 'POST', body: fdRetry });
    }
    if (!resp.ok) {
      const text = await resp.text();
      if (GATEWAY.has(resp.status)) {
        throw new Error(
          'The processing server is waking up and did not respond in time. Please hit Try Again in a few seconds.'
        );
      }
      try {
        throw new Error(JSON.parse(text).error || `HTTP ${resp.status}`);
      } catch {
        throw new Error(text || `HTTP ${resp.status}`);
      }
    }
    const blob = await resp.blob();
    const cd = resp.headers.get('Content-Disposition') || '';
    const m = cd.match(/filename="([^"]+)"/);
    return { blob, filename: m ? m[1] : fallbackName };
  },

  // Bookmark detection — uploads the PDF(s) and returns the proposed
  // heading tree as JSON. Stateless: nothing persists server-side; the
  // review happens in the browser and the finalized tree goes back through
  // applyBookmarks() together with the same files.
  async detectBookmarks(files: File | File[]): Promise<BookmarkDetection> {
    const fileList = Array.isArray(files) ? files : [files];
    const fd = new FormData();
    for (const f of fileList) fd.append('document', f);

    const GATEWAY = new Set([502, 503, 504]);
    let resp = await fetch(apiUrl('bookmarks/detect'), { method: 'POST', body: fd });
    if (GATEWAY.has(resp.status)) {
      await waitForBackendAwake();
      const fdRetry = new FormData();
      for (const f of fileList) fdRetry.append('document', f);
      resp = await fetch(apiUrl('bookmarks/detect'), { method: 'POST', body: fdRetry });
    }
    if (!resp.ok) {
      let msg = `HTTP ${resp.status}`;
      try {
        msg = (await resp.json()).error || msg;
      } catch {
        // non-JSON error body — keep the status text
      }
      throw new Error(msg);
    }
    return resp.json();
  },

  // Inject the user-finalized bookmark tree and stream back the PDF.
  async applyBookmarks(
    files: File | File[],
    headings: BookmarkHeading[]
  ): Promise<{ blob: Blob; filename: string }> {
    const fileList = Array.isArray(files) ? files : [files];
    const build = () => {
      const fd = new FormData();
      for (const f of fileList) fd.append('document', f);
      fd.append('headings', JSON.stringify(headings));
      return fd;
    };

    const GATEWAY = new Set([502, 503, 504]);
    let resp = await fetch(apiUrl('bookmarks/apply'), { method: 'POST', body: build() });
    if (GATEWAY.has(resp.status)) {
      await waitForBackendAwake();
      resp = await fetch(apiUrl('bookmarks/apply'), { method: 'POST', body: build() });
    }
    if (!resp.ok) {
      const text = await resp.text();
      try {
        throw new Error(JSON.parse(text).error || `HTTP ${resp.status}`);
      } catch (e) {
        if (e instanceof Error && e.message !== text) throw e;
        throw new Error(text || `HTTP ${resp.status}`);
      }
    }
    const blob = await resp.blob();
    const cd = resp.headers.get('Content-Disposition') || '';
    const m = cd.match(/filename="([^"]+)"/);
    const fallback = `BOOKMARKED_${(fileList[0]?.name || 'document').replace(/\.pdf$/i, '')}.pdf`;
    return { blob, filename: m ? m[1] : fallback };
  },

  // Generate a court-filing "Master Index" page from typed case details.
  // With document files the index is prepended to the merged PDF; without,
  // just the index page(s) come back.
  async generateIndex(
    payload: IndexPayload,
    files: File[] = []
  ): Promise<{ blob: Blob; filename: string }> {
    const build = () => {
      const fd = new FormData();
      for (const f of files) fd.append('document', f);
      fd.append('payload', JSON.stringify(payload));
      return fd;
    };

    const GATEWAY = new Set([502, 503, 504]);
    let resp = await fetch(apiUrl('index/generate'), { method: 'POST', body: build() });
    if (GATEWAY.has(resp.status)) {
      await waitForBackendAwake();
      resp = await fetch(apiUrl('index/generate'), { method: 'POST', body: build() });
    }
    if (!resp.ok) {
      const text = await resp.text();
      try {
        throw new Error(JSON.parse(text).error || `HTTP ${resp.status}`);
      } catch (e) {
        if (e instanceof Error && e.message !== text) throw e;
        throw new Error(text || `HTTP ${resp.status}`);
      }
    }
    const blob = await resp.blob();
    const cd = resp.headers.get('Content-Disposition') || '';
    const m = cd.match(/filename="([^"]+)"/);
    const fallback = files.length
      ? `INDEXED_${(files[0]?.name || 'document').replace(/\.pdf$/i, '')}.pdf`
      : 'INDEX.pdf';
    return { blob, filename: m ? m[1] : fallback };
  },

  // Lightweight ping. Use it to wake a sleeping Render free-tier dyno
  // before the user submits.
  async warmUp(): Promise<void> {
    try {
      await fetch(apiUrl('health'), { method: 'GET' });
    } catch {
      // Best-effort — failures are silent. The real submit will surface them.
    }
  },
};

// Poll /health until the dyno is awake. Render free-tier cold starts take
// ~30-60s; cap the wait so a genuinely dead backend still surfaces an error.
async function waitForBackendAwake(maxMs = 90000): Promise<void> {
  signalBackendWaking(); // lets any visible ProcessingPanel switch its message
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const r = await fetch(apiUrl('health'), { method: 'GET' });
      if (r.ok) return;
    } catch {
      // network blip while the dyno spins up — keep polling
    }
    await new Promise((res) => setTimeout(res, 3000));
  }
}

/** Fire-and-forget tool usage ping. Never throws, never blocks the caller. */
export function trackTool(tool: string): void {
  fetch(apiUrl('track'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool }),
  }).catch(() => {});
}

export default documentApi;
