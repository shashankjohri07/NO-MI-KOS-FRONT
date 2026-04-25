import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://no-mi-kos-back.onrender.com/api/'

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
  summary: {
    document_type: string;
    total_pages: number;
    total_rules_checked: number;
    errors_count: number;
    warnings_count: number;
    passed_count: number;
    compliance_score: number;
    info_count: number;
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
  diff_pdf?: string;
  merged_pdf?: string;
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
    onProgress?: (percent: number) => void,
    options?: { indexStart?: number | null; indexEnd?: number | null }
  ): Promise<ErrorReport> {
    const formData = new FormData();
    const fileList = Array.isArray(files) ? files : [files];
    for (const f of fileList) {
      formData.append('document', f);
    }
    if (options?.indexStart && options.indexStart >= 1) {
      formData.append('index_start', String(options.indexStart));
    }
    if (options?.indexEnd && options.indexEnd >= 1) {
      formData.append('index_end', String(options.indexEnd));
    }

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
};

export default documentApi;
