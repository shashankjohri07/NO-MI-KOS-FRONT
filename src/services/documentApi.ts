import axios from 'axios';

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
    onProgress?: (info: { state: string; progress: number }) => void,
    /**
     * Optional comma+range spec ("1, 3-5, 8") of additional MAIN-document
     * pages — referenced by their stamped page number — that should also
     * get client/advocate signatures. Annexure pages already auto-sign on
     * every page, so out-of-range entries are silently dropped server-side.
     * Empty / undefined = preserve current behaviour.
     */
    signPages?: string
  ): Promise<{ blob: Blob; filename: string }> {
    const fileList = Array.isArray(files) ? files : [files];
    const buildForm = () => {
      const fd = new FormData();
      for (const f of fileList) fd.append('document', f);
      for (const f of annexures) fd.append('annex', f);
      if (signatures?.client) fd.append('clientSignature', signatures.client);
      if (signatures?.advocate) fd.append('advocateSignature', signatures.advocate);
      fd.append('indexEndPage', String(Math.max(0, Math.floor(indexEndPage || 0))));
      if (signPages && signPages.trim()) fd.append('signPages', signPages.trim());
      return fd;
    };
    const fallbackName = `${annexures.length ? 'NUMBERED_WITH_ANNEXURES_' : 'NUMBERED_'}${(
      fileList[0]?.name || 'document'
    ).replace(/\.pdf$/i, '')}.pdf`;

    // Render free-tier dynos sleep after ~15 min idle; the first request
    // returns a gateway error while the dyno cold-starts. Wake + retry once.
    const GATEWAY = new Set([502, 503, 504]);

    // ── 1. Try to enqueue an async job ──
    // A backend without the async branch deployed has no such route; Express
    // may reset the connection mid-upload (fetch throws) instead of cleanly
    // returning 404. Either way → fall back to the legacy sync stream so the
    // deploy order (frontend-before-backend) can't break uploads.
    let createResp: Response;
    try {
      createResp = await fetch(apiUrl('jobs/write-pagination'), {
        method: 'POST',
        body: buildForm(),
      });
      if (GATEWAY.has(createResp.status)) {
        await waitForBackendAwake();
        createResp = await fetch(apiUrl('jobs/write-pagination'), {
          method: 'POST',
          body: buildForm(),
        });
      }
    } catch {
      return writePaginationSync(buildForm(), fallbackName);
    }

    // Async path unavailable (old backend / Redis+R2 not provisioned) →
    // legacy synchronous stream. Behaviour identical to before.
    if (createResp.status === 404 || createResp.status === 503) {
      return writePaginationSync(buildForm(), fallbackName);
    }

    if (!createResp.ok) {
      const text = await createResp.text();
      if (GATEWAY.has(createResp.status)) {
        throw new Error(
          'The processing server is waking up and did not respond in time. Please hit Try Again in a few seconds.'
        );
      }
      try {
        throw new Error(JSON.parse(text).error || `HTTP ${createResp.status}`);
      } catch {
        throw new Error(text || `HTTP ${createResp.status}`);
      }
    }

    const { jobId } = (await createResp.json()) as { jobId: string };
    onProgress?.({ state: 'queued', progress: 0 });

    // ── 2. Poll until the worker completes ──
    const POLL_MS = 2500;
    const MAX_MS = 20 * 60 * 1000; // 20 min ceiling for very large filings
    const start = Date.now();
    while (Date.now() - start < MAX_MS) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      let statusResp: Response;
      try {
        statusResp = await fetch(apiUrl(`jobs/${jobId}`));
      } catch {
        continue; // transient network blip — keep polling
      }
      if (GATEWAY.has(statusResp.status)) continue;
      if (!statusResp.ok) {
        const t = await statusResp.text();
        try {
          throw new Error(JSON.parse(t).error || `HTTP ${statusResp.status}`);
        } catch {
          throw new Error(t || `HTTP ${statusResp.status}`);
        }
      }
      const data = (await statusResp.json()) as {
        state: string;
        progress?: number;
        resultUrl?: string;
        downloadName?: string;
        error?: string;
      };
      if (data.state === 'completed' && data.resultUrl) {
        onProgress?.({ state: 'completed', progress: 100 });
        const fileResp = await fetch(data.resultUrl);
        if (!fileResp.ok) throw new Error('Could not download the finished file.');
        return { blob: await fileResp.blob(), filename: data.downloadName || fallbackName };
      }
      if (data.state === 'failed') {
        throw new Error(data.error || 'Processing failed on the server.');
      }
      onProgress?.({ state: data.state, progress: data.progress ?? 0 });
    }
    throw new Error('Processing timed out. The file may be too large — please try again.');
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

// Legacy synchronous stream — used only when the async job pipeline isn't
// available on the backend (404/503). Preserves the original behaviour:
// Python pipes the PDF straight into the HTTP response.
async function writePaginationSync(
  formData: FormData,
  fallbackName: string
): Promise<{ blob: Blob; filename: string }> {
  const GATEWAY = new Set([502, 503, 504]);
  let resp = await fetch(apiUrl('write-pagination'), { method: 'POST', body: formData });
  if (GATEWAY.has(resp.status)) {
    await waitForBackendAwake();
    resp = await fetch(apiUrl('write-pagination'), { method: 'POST', body: formData });
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
}

// Poll /health until the dyno is awake. Render free-tier cold starts take
// ~30-60s; cap the wait so a genuinely dead backend still surfaces an error.
async function waitForBackendAwake(maxMs = 90000): Promise<void> {
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

export default documentApi;
