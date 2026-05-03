import axios from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://no-mi-kos-back.onrender.com/api/';

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
  async writePagination(
    files: File | File[],
    indexEndPage: number,
    annexures: File[] = [],
    signatures?: { client?: File | null; advocate?: File | null }
  ): Promise<{ blob: Blob; filename: string }> {
    const formData = new FormData();
    const fileList = Array.isArray(files) ? files : [files];
    for (const f of fileList) formData.append('document', f);
    for (const f of annexures) formData.append('annex', f);
    if (signatures?.client) formData.append('clientSignature', signatures.client);
    if (signatures?.advocate) formData.append('advocateSignature', signatures.advocate);
    formData.append('indexEndPage', String(Math.max(0, Math.floor(indexEndPage || 0))));

    const resp = await fetch(apiUrl('write-pagination'), {
      method: 'POST',
      body: formData,
    });

    if (!resp.ok) {
      const text = await resp.text();
      try {
        const j = JSON.parse(text);
        throw new Error(j.error || `HTTP ${resp.status}`);
      } catch {
        throw new Error(text || `HTTP ${resp.status}`);
      }
    }

    const blob = await resp.blob();
    const cd = resp.headers.get('Content-Disposition') || '';
    const m = cd.match(/filename="([^"]+)"/);
    const filename = m
      ? m[1]
      : `${annexures.length ? 'NUMBERED_WITH_ANNEXURES_' : 'NUMBERED_'}${(fileList[0]?.name || 'document').replace(/\.pdf$/i, '')}.pdf`;
    return { blob, filename };
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

export default documentApi;
