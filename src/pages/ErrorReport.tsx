import { useState, useRef, useEffect } from 'react';
import { documentApi, ErrorReport as ErrorReportType, ErrorResult } from '../services/documentApi';
import '../styles/ErrorReport.css';

function SeverityBadge({ severity }: { severity: string }) {
  return <span className={`er-badge er-badge--${severity}`}>{severity.toUpperCase()}</span>;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'fail':
      return <span className="er-status er-status--fail">&#10006;</span>;
    case 'warning':
      return <span className="er-status er-status--warning">&#9888;</span>;
    case 'pass':
      return <span className="er-status er-status--pass">&#10004;</span>;
    default:
      return <span className="er-status er-status--info">&#8505;</span>;
  }
}

function PageBadge({ page }: { page: number }) {
  return <span className="er-page-badge">p.{page}</span>;
}

function RuleCard({ result }: { result: ErrorResult }) {
  // Extract page numbers from page_references
  const pageRefs = result.page_references || [];
  const pages = pageRefs.map((r) => r.page_num);
  const expectedPages = result.expected_pages || '';

  return (
    <div className={`er-card er-card--${result.status}`}>
      <div className="er-card__header">
        <StatusIcon status={result.status} />
        <span className="er-card__id">{result.rule_id}</span>
        {pages.length > 0 && (
          <span className="er-card__pages">
            {pages.slice(0, 5).map((p, i) => (
              <PageBadge key={i} page={p} />
            ))}
            {pages.length > 5 && <span className="er-card__pages-more">+{pages.length - 5}</span>}
          </span>
        )}
        <SeverityBadge severity={result.severity} />
      </div>
      <p className="er-card__desc">{result.description}</p>
      <p className="er-card__detail">{result.detail}</p>

      {result.source && <p className="er-card__source">Source: {result.source}</p>}

      {expectedPages && result.status === 'fail' && (
        <div className="er-card__expected">
          <span className="er-card__expected-label">Check page(s):</span>
          <span className="er-card__expected-value">{expectedPages}</span>
        </div>
      )}

      {result.missing && result.missing.length > 0 && (
        <div className="er-card__missing">
          <span className="er-card__missing-label">Missing:</span>
          {result.missing.map((m, i) => (
            <span key={i} className="er-card__missing-tag">
              {m}
            </span>
          ))}
        </div>
      )}

      {/* Show found items with page numbers for passed rules */}
      {result.status === 'pass' && pageRefs.length > 0 && (
        <div className="er-card__found-pages">
          {pageRefs.slice(0, 4).map((ref, i) => (
            <span key={i} className="er-card__found-item">
              <PageBadge page={ref.page_num} />
              {ref.locations && ref.locations.length > 0 && (
                <span className="er-card__found-text">
                  &quot;{ref.locations[0].text?.substring(0, 40)}
                  {(ref.locations[0].text?.length || 0) > 40 ? '...' : ''}&quot;
                </span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

type Mode = 'detect' | 'write' | 'both';

export default function ErrorReport() {
  const [files, setFiles] = useState<File[]>([]);
  const [indexEndPage, setIndexEndPage] = useState<string>('');
  const [mode, setMode] = useState<Mode>('detect');
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>(
    'idle'
  );
  const [, setProgress] = useState(0);
  const [report, setReport] = useState<ErrorReportType | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'errors' | 'warnings' | 'passed' | 'info' | 'all'>(
    'errors'
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const MAX_FILES = 5;

  const [processingStep, setProcessingStep] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const PROCESSING_STEPS = [
    'Uploading document...',
    'Extracting text (Tesseract OCR for scanned pages)...',
    'Checking required documents and pagination...',
    'Generating error-marked PDF...',
    'Finalizing report...',
  ];

  useEffect(() => {
    if (status !== 'processing') {
      setProcessingStep(0);
      setElapsedSeconds(0);
      return;
    }

    // Advance steps on a schedule
    const stepTimers = [0, 3, 10, 30, 60]; // seconds when each step shows
    const stepInterval = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        const nextStep = stepTimers.findIndex((t) => t > next);
        setProcessingStep(
          nextStep === -1 ? PROCESSING_STEPS.length - 1 : Math.max(0, nextStep - 1)
        );
        return next;
      });
    }, 1000);

    return () => clearInterval(stepInterval);
  }, [status]);

  const addFiles = (incoming: File[]) => {
    const pdfs = incoming.filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (pdfs.length === 0) return;
    setFiles((prev) => [...prev, ...pdfs].slice(0, MAX_FILES));
    setReport(null);
    setStatus('idle');
    setErrorMsg('');
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveFile = (idx: number, dir: -1 | 1) => {
    setFiles((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length) addFiles(selected);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    addFiles(Array.from(e.dataTransfer.files));
  };

  const handleSubmit = async () => {
    if (files.length === 0) return;

    setStatus('uploading');
    setProgress(0);
    setErrorMsg('');

    try {
      setStatus('processing');
      const parsedIndexEnd = Number.parseInt(indexEndPage, 10);
      const safeIndexEnd =
        Number.isFinite(parsedIndexEnd) && parsedIndexEnd >= 0 ? parsedIndexEnd : 0;
      const result = await documentApi.detectErrors(files, safeIndexEnd, mode, (pct) =>
        setProgress(pct)
      );

      if (result.ok) {
        setReport(result);
        setStatus('done');
        setActiveTab(result.summary.errors_count > 0 ? 'errors' : 'passed');
      } else {
        setErrorMsg(result.error || 'Unknown error');
        setStatus('error');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to process document');
      setStatus('error');
    }
  };

  const handleDownloadAnnotated = () => {
    if (!report?.annotated_pdf) return;

    const byteString = atob(report.annotated_pdf);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ERRORS_MARKED_${report.file}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadMerged = () => {
    if (!report?.merged_pdf) return;
    const byteString = atob(report.merged_pdf);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    const blob = new Blob([ab], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'MERGED_appeal.pdf';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadNumbered = () => {
    if (!report?.paginated_pdf) return;
    const byteString = atob(report.paginated_pdf);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    const blob = new Blob([ab], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NUMBERED_${report.file}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setFiles([]);
    setIndexEndPage('');
    setMode('detect');
    setReport(null);
    setStatus('idle');
    setProgress(0);
    setErrorMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getTabItems = (): ErrorResult[] => {
    if (!report) return [];
    switch (activeTab) {
      case 'errors':
        return report.errors;
      case 'warnings':
        return report.warnings;
      case 'passed':
        return report.passed;
      case 'info':
        return report.info || [];
      case 'all':
        return report.all_results;
    }
  };

  return (
    <div className="er">
      <div className="er__container">
        <header className="er__header">
          <h1 className="er__title">Document Error Detection</h1>
          <p className="er__subtitle">
            Upload one or more appeal PDFs (in order) — volumes are merged and scanned for required
            documents and sequential top-right pagination. Tell us which page your index ends on,
            and we'll check that page (index + 1) onwards is numbered 1, 2, 3, …
          </p>
        </header>

        {/* Upload */}
        {!report && (
          <section className="er__upload-section">
            <div
              className={`er__dropzone ${files.length ? 'er__dropzone--has-file' : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                multiple
                className="er__file-input"
                onChange={handleFileChange}
                id="error-detect-upload"
              />
              <label htmlFor="error-detect-upload" className="er__dropzone-label">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="er__upload-icon"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <div className="er__dropzone-text">
                  <span className="er__dropzone-main">
                    {files.length
                      ? `Add another volume (max ${MAX_FILES})`
                      : 'Drop your PDFs here or click to browse'}
                  </span>
                  <span className="er__dropzone-hint">
                    {files.length
                      ? 'Files are merged in the order listed below'
                      : 'Upload one or multiple PDFs — up to 100MB each'}
                  </span>
                </div>
              </label>
            </div>

            {files.length > 0 && (
              <ol className="er__file-list">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="er__file-list-item">
                    <span className="er__file-list-idx">Vol {i + 1}</span>
                    <span className="er__file-list-name">{f.name}</span>
                    <span className="er__file-list-size">
                      {(f.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                    <span className="er__file-list-actions">
                      <button
                        type="button"
                        className="er__file-list-btn"
                        onClick={() => moveFile(i, -1)}
                        disabled={i === 0}
                        aria-label="Move up"
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="er__file-list-btn"
                        onClick={() => moveFile(i, 1)}
                        disabled={i === files.length - 1}
                        aria-label="Move down"
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="er__file-list-btn er__file-list-btn--remove"
                        onClick={() => removeFile(i)}
                        aria-label="Remove"
                        title="Remove"
                      >
                        ×
                      </button>
                    </span>
                  </li>
                ))}
              </ol>
            )}

            {files.length > 0 && status !== 'processing' && (
              <div className="er__index-input">
                <label htmlFor="er-index-end" className="er__index-input-label">
                  Index ends at page
                  <span className="er__index-input-hint">
                    {' '}
                    — pagination check begins on the next page (use 0 if there is no index)
                  </span>
                </label>
                <input
                  id="er-index-end"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  className="er__index-input-field"
                  placeholder="e.g. 3"
                  value={indexEndPage}
                  onChange={(e) => setIndexEndPage(e.target.value)}
                />

                <div className="er__mode-select" role="radiogroup" aria-label="Operation mode">
                  {(
                    [
                      {
                        value: 'detect',
                        label: 'Detect only',
                        hint: 'Check rules — does not modify the PDF',
                      },
                      {
                        value: 'write',
                        label: 'Write page numbers',
                        hint: 'Skip detection (faster). Stamps 1, 2, 3 …',
                      },
                      {
                        value: 'both',
                        label: 'Detect + write',
                        hint: 'Run rules and stamp numbers in one pass',
                      },
                    ] as Array<{ value: Mode; label: string; hint: string }>
                  ).map((opt) => (
                    <label
                      key={opt.value}
                      className={`er__mode-option ${mode === opt.value ? 'er__mode-option--active' : ''}`}
                      htmlFor={`er-mode-${opt.value}`}
                    >
                      <input
                        id={`er-mode-${opt.value}`}
                        type="radio"
                        name="er-mode"
                        value={opt.value}
                        checked={mode === opt.value}
                        onChange={() => setMode(opt.value)}
                        className="er__mode-option-input"
                      />
                      <div className="er__mode-option-text">
                        <span className="er__mode-option-label">{opt.label}</span>
                        <span className="er__mode-option-hint">{opt.hint}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {files.length > 0 && status !== 'processing' && (
              <button
                type="button"
                className="er__btn er__btn--primary"
                onClick={handleSubmit}
                disabled={status === 'uploading'}
              >
                {status === 'uploading'
                  ? 'Uploading...'
                  : mode === 'write'
                    ? 'Write Page Numbers'
                    : mode === 'both'
                      ? 'Detect & Number Pages'
                      : 'Detect Errors'}
              </button>
            )}

            {status === 'processing' && (
              <div className="er__processing">
                <div className="er__spinner" />
                <p className="er__processing-text">{PROCESSING_STEPS[processingStep]}</p>
                <div className="er__processing-steps">
                  {PROCESSING_STEPS.map((step, i) => (
                    <div
                      key={i}
                      className={`er__step ${i < processingStep ? 'er__step--done' : ''} ${i === processingStep ? 'er__step--active' : ''} ${i > processingStep ? 'er__step--pending' : ''}`}
                    >
                      <span className="er__step-icon">
                        {i < processingStep ? '\u2713' : i === processingStep ? '\u25CB' : '\u00B7'}
                      </span>
                      <span className="er__step-label">{step}</span>
                    </div>
                  ))}
                </div>
                <p className="er__processing-hint">
                  {elapsedSeconds < 60
                    ? `${elapsedSeconds}s elapsed`
                    : `${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s elapsed`}
                  {' \u2014 '}
                  {elapsedSeconds < 30
                    ? 'this typically takes 2-3 minutes'
                    : elapsedSeconds < 90
                      ? 'vision checks in progress, analyzing each page...'
                      : 'almost done, generating report...'}
                </p>
                <div className="er__progress">
                  <div
                    className="er__progress-bar"
                    style={{
                      width: `${Math.min(95, (processingStep / PROCESSING_STEPS.length) * 100 + 5)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="er__error-msg">
                <p>{errorMsg}</p>
                <button type="button" className="er__btn er__btn--outline" onClick={handleReset}>
                  Try Again
                </button>
              </div>
            )}
          </section>
        )}

        {/* Report */}
        {report && (
          <section className="er__report">
            {/* Summary */}
            <div className="er__summary">
              <div className="er__summary-header">
                <h2 className="er__summary-title">Analysis Report: {report.file}</h2>
                <div className="er__summary-actions">
                  {report.merged_pdf && (
                    <button
                      type="button"
                      className="er__btn er__btn--primary er__btn--sm"
                      onClick={handleDownloadMerged}
                    >
                      Download Merged PDF
                    </button>
                  )}
                  {report.annotated_pdf && report.mode !== 'write' && (
                    <button
                      type="button"
                      className="er__btn er__btn--outline er__btn--sm"
                      onClick={handleDownloadAnnotated}
                    >
                      Download Errors-Marked PDF
                    </button>
                  )}
                  {report.paginated_pdf && (
                    <button
                      type="button"
                      className="er__btn er__btn--primary er__btn--sm"
                      onClick={handleDownloadNumbered}
                    >
                      Download Numbered PDF
                    </button>
                  )}
                  <button
                    type="button"
                    className="er__btn er__btn--outline er__btn--sm"
                    onClick={handleReset}
                  >
                    New Analysis
                  </button>
                </div>
              </div>

              {report.mode === 'write' ? (
                <div className="er__write-confirm">
                  <p className="er__write-confirm-text">
                    Page numbers stamped on{' '}
                    <strong>
                      {Math.max(
                        0,
                        report.summary.total_pages - (report.summary.index_end_page ?? 0)
                      )}
                    </strong>{' '}
                    pages (skipped first {report.summary.index_end_page ?? 0} index page
                    {(report.summary.index_end_page ?? 0) === 1 ? '' : 's'}). Click{' '}
                    <strong>Download Numbered PDF</strong> above.
                  </p>
                </div>
              ) : (
                <>
                  <div className="er__stats">
                    <div className="er__stat">
                      <span className="er__stat-value er__stat-value--score">
                        {report.summary.compliance_score}%
                      </span>
                      <span className="er__stat-label">Compliance</span>
                    </div>
                    <div className="er__stat">
                      <span className="er__stat-value er__stat-value--errors">
                        {report.summary.errors_count}
                      </span>
                      <span className="er__stat-label">Errors</span>
                    </div>
                    <div className="er__stat">
                      <span className="er__stat-value er__stat-value--warnings">
                        {report.summary.warnings_count}
                      </span>
                      <span className="er__stat-label">Warnings</span>
                    </div>
                    <div className="er__stat">
                      <span className="er__stat-value er__stat-value--passed">
                        {report.summary.passed_count}
                      </span>
                      <span className="er__stat-label">Passed</span>
                    </div>
                  </div>

                  <div className="er__meta">
                    <span>
                      Document Type: <strong>{report.summary.document_type}</strong>
                    </span>
                    <span>
                      Pages: <strong>{report.summary.total_pages}</strong>
                    </span>
                    <span>
                      OCR: <strong>{report.ocr_method}</strong>
                    </span>
                    <span>
                      Rules Checked: <strong>{report.summary.total_rules_checked}</strong>
                    </span>
                  </div>
                </>
              )}
            </div>

            {report.mode !== 'write' && (
              <>
                {/* Tabs */}
                <div className="er__tabs">
                  <button
                    className={`er__tab ${activeTab === 'errors' ? 'er__tab--active er__tab--errors' : ''}`}
                    onClick={() => setActiveTab('errors')}
                  >
                    Errors ({report.summary.errors_count})
                  </button>
                  <button
                    className={`er__tab ${activeTab === 'warnings' ? 'er__tab--active er__tab--warnings' : ''}`}
                    onClick={() => setActiveTab('warnings')}
                  >
                    Warnings ({report.summary.warnings_count})
                  </button>
                  <button
                    className={`er__tab ${activeTab === 'passed' ? 'er__tab--active er__tab--passed' : ''}`}
                    onClick={() => setActiveTab('passed')}
                  >
                    Passed ({report.summary.passed_count})
                  </button>
                  {report.summary.info_count > 0 && (
                    <button
                      className={`er__tab ${activeTab === 'info' ? 'er__tab--active er__tab--info' : ''}`}
                      onClick={() => setActiveTab('info')}
                    >
                      Manual ({report.summary.info_count})
                    </button>
                  )}
                  <button
                    className={`er__tab ${activeTab === 'all' ? 'er__tab--active' : ''}`}
                    onClick={() => setActiveTab('all')}
                  >
                    All ({report.summary.total_rules_checked})
                  </button>
                </div>

                {/* Results */}
                <div className="er__results">
                  {getTabItems().length === 0 ? (
                    <p className="er__empty">No items in this category</p>
                  ) : (
                    getTabItems().map((result, idx) => <RuleCard key={idx} result={result} />)
                  )}
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
