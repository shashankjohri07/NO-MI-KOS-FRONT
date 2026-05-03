import { useState, useRef, useEffect } from 'react';
import { documentApi } from '../services/documentApi';
import '../styles/ErrorReport.css';

// Workflow states. The user paginates main files first; the annexure step is
// an opt-in second pass that re-runs everything (main + annex) end-to-end.
//   pick-main   → user selects main volumes, sets index, hits submit
//   processing  → spinner during a backend call (either pass)
//   annex-ask   → main PDF downloaded; ask "annexures bhi merge karwane hai?"
//   pick-annex  → annexure uploader visible
//   done        → final PDF (with annexures) downloaded; reset prompt
//   error       → any failure; show retry
type Step = 'pick-main' | 'processing' | 'annex-ask' | 'pick-annex' | 'done' | 'error';

export default function ErrorReport() {
  const [mainFiles, setMainFiles] = useState<File[]>([]);
  const [annexFiles, setAnnexFiles] = useState<File[]>([]);
  const [indexEndPage, setIndexEndPage] = useState<string>('');
  const [step, setStep] = useState<Step>('pick-main');
  const [errorMsg, setErrorMsg] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const mainInputRef = useRef<HTMLInputElement>(null);
  const annexInputRef = useRef<HTMLInputElement>(null);
  const MAX_FILES = 5;
  const MAX_ANNEXURES = 20;

  // Elapsed-seconds counter while processing.
  useEffect(() => {
    if (step !== 'processing') {
      setElapsedSeconds(0);
      return;
    }
    const t = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [step]);

  // Keep-warm: ping backend on mount so the Render free dyno wakes up while
  // the user is still selecting files.
  useEffect(() => {
    documentApi.warmUp();
  }, []);

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const safeIndexEnd = () => {
    const n = Number.parseInt(indexEndPage, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  // --- file pickers --------------------------------------------------------
  const addMainFiles = (incoming: File[]) => {
    const pdfs = incoming.filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (pdfs.length === 0) return;
    setMainFiles((prev) => [...prev, ...pdfs].slice(0, MAX_FILES));
    setStep('pick-main');
    setErrorMsg('');
  };
  const removeMainFile = (idx: number) =>
    setMainFiles((prev) => prev.filter((_, i) => i !== idx));
  const moveMainFile = (idx: number, dir: -1 | 1) =>
    setMainFiles((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });

  const addAnnexFiles = (incoming: File[]) => {
    const pdfs = incoming.filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (pdfs.length === 0) return;
    setAnnexFiles((prev) => [...prev, ...pdfs].slice(0, MAX_ANNEXURES));
  };
  const removeAnnexFile = (idx: number) =>
    setAnnexFiles((prev) => prev.filter((_, i) => i !== idx));
  const moveAnnexFile = (idx: number, dir: -1 | 1) =>
    setAnnexFiles((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });

  // --- submits -------------------------------------------------------------
  const submitMainOnly = async () => {
    if (mainFiles.length === 0) return;
    setErrorMsg('');
    setStep('processing');
    try {
      const { blob, filename } = await documentApi.writePagination(mainFiles, safeIndexEnd());
      triggerDownload(blob, filename);
      setStep('annex-ask');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to process document');
      setStep('error');
    }
  };

  const submitWithAnnexures = async () => {
    if (mainFiles.length === 0 || annexFiles.length === 0) return;
    setErrorMsg('');
    setStep('processing');
    try {
      const { blob, filename } = await documentApi.writePagination(
        mainFiles,
        safeIndexEnd(),
        annexFiles
      );
      triggerDownload(blob, filename);
      setStep('done');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to process document');
      setStep('error');
    }
  };

  const handleReset = () => {
    setMainFiles([]);
    setAnnexFiles([]);
    setIndexEndPage('');
    setStep('pick-main');
    setErrorMsg('');
    if (mainInputRef.current) mainInputRef.current.value = '';
    if (annexInputRef.current) annexInputRef.current.value = '';
  };

  return (
    <div className="er">
      <div className="er__container">
        <header className="er__header">
          <h1 className="er__title">Page Numbering</h1>
          <p className="er__subtitle">
            Upload one or more PDFs in order. Volumes are merged into a single document, any
            existing top-right page numbers are wiped, and fresh sequential numbers are stamped from
            page (index + 1) onwards — continuous across all volumes. Annexures can be merged in a
            second optional step.
          </p>
        </header>

        {/* === STEP 1: pick main files ================================= */}
        {(step === 'pick-main' || step === 'processing') && (
          <section className="er__upload-section">
            <div
              className={`er__dropzone ${mainFiles.length ? 'er__dropzone--has-file' : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                addMainFiles(Array.from(e.dataTransfer.files));
              }}
            >
              <input
                ref={mainInputRef}
                type="file"
                accept=".pdf"
                multiple
                className="er__file-input"
                onChange={(e) => {
                  const sel = Array.from(e.target.files || []);
                  if (sel.length) addMainFiles(sel);
                }}
                id="er-main-upload"
              />
              <label htmlFor="er-main-upload" className="er__dropzone-label">
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
                    {mainFiles.length
                      ? `Add another volume (max ${MAX_FILES})`
                      : 'Drop your PDFs here or click to browse'}
                  </span>
                  <span className="er__dropzone-hint">
                    {mainFiles.length
                      ? 'Files are merged in the order listed below'
                      : 'Upload one or multiple PDFs — up to 100MB each'}
                  </span>
                </div>
              </label>
            </div>

            {mainFiles.length > 0 && (
              <ol className="er__file-list">
                {mainFiles.map((f, i) => (
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
                        onClick={() => moveMainFile(i, -1)}
                        disabled={i === 0 || step === 'processing'}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="er__file-list-btn"
                        onClick={() => moveMainFile(i, 1)}
                        disabled={i === mainFiles.length - 1 || step === 'processing'}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="er__file-list-btn er__file-list-btn--remove"
                        onClick={() => removeMainFile(i)}
                        disabled={step === 'processing'}
                      >
                        ×
                      </button>
                    </span>
                  </li>
                ))}
              </ol>
            )}

            {mainFiles.length > 0 && step === 'pick-main' && (
              <div className="er__index-input">
                <label htmlFor="er-index-end" className="er__index-input-label">
                  Index ends at page
                  <span className="er__index-input-hint">
                    {' '}
                    — numbering begins on the next page (use 0 if there is no index)
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
              </div>
            )}

            {mainFiles.length > 0 && step === 'pick-main' && (
              <button
                type="button"
                className="er__btn er__btn--primary"
                onClick={submitMainOnly}
              >
                Write Page Numbers
              </button>
            )}

            {step === 'processing' && (
              <div className="er__processing">
                <div className="er__spinner" />
                <p className="er__processing-text">Processing…</p>
                <p className="er__processing-hint">
                  {elapsedSeconds < 60
                    ? `${elapsedSeconds}s elapsed`
                    : `${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s elapsed`}
                  {elapsedSeconds > 30 && ' — backend may be waking up, hang tight'}
                </p>
              </div>
            )}
          </section>
        )}

        {/* === STEP 2: ask about annexures ============================= */}
        {step === 'annex-ask' && (
          <section className="er__upload-section">
            <div className="er__annex-prompt">
              <p className="er__annex-prompt-title">
                ✓ Numbered PDF downloaded. Annexures bhi merge karwane hai?
              </p>
              <p className="er__annex-prompt-hint">
                Each annexure file you upload becomes one annexure: <em>Annexure A-1</em>,{' '}
                <em>Annexure A-2</em>, etc., stamped on its first page. They will be appended to
                the current document and pagination continues across them.
              </p>
              <div className="er__annex-prompt-actions">
                <button
                  type="button"
                  className="er__btn er__btn--primary"
                  onClick={() => setStep('pick-annex')}
                >
                  Haan, annexures upload karu
                </button>
                <button
                  type="button"
                  className="er__btn er__btn--outline"
                  onClick={handleReset}
                >
                  Nahi, done
                </button>
              </div>
            </div>
          </section>
        )}

        {/* === STEP 3: pick annexures ================================== */}
        {step === 'pick-annex' && (
          <section className="er__upload-section">
            <div
              className={`er__dropzone ${annexFiles.length ? 'er__dropzone--has-file' : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                addAnnexFiles(Array.from(e.dataTransfer.files));
              }}
            >
              <input
                ref={annexInputRef}
                type="file"
                accept=".pdf"
                multiple
                className="er__file-input"
                onChange={(e) => {
                  const sel = Array.from(e.target.files || []);
                  if (sel.length) addAnnexFiles(sel);
                }}
                id="er-annex-upload"
              />
              <label htmlFor="er-annex-upload" className="er__dropzone-label">
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
                    {annexFiles.length
                      ? `Add another annexure (max ${MAX_ANNEXURES})`
                      : 'Drop annexure PDFs here'}
                  </span>
                  <span className="er__dropzone-hint">
                    File 1 → Annexure A-1, File 2 → Annexure A-2, … (in upload order)
                  </span>
                </div>
              </label>
            </div>

            {annexFiles.length > 0 && (
              <ol className="er__file-list">
                {annexFiles.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="er__file-list-item">
                    <span className="er__file-list-idx">A-{i + 1}</span>
                    <span className="er__file-list-name">{f.name}</span>
                    <span className="er__file-list-size">
                      {(f.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                    <span className="er__file-list-actions">
                      <button
                        type="button"
                        className="er__file-list-btn"
                        onClick={() => moveAnnexFile(i, -1)}
                        disabled={i === 0}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="er__file-list-btn"
                        onClick={() => moveAnnexFile(i, 1)}
                        disabled={i === annexFiles.length - 1}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="er__file-list-btn er__file-list-btn--remove"
                        onClick={() => removeAnnexFile(i)}
                      >
                        ×
                      </button>
                    </span>
                  </li>
                ))}
              </ol>
            )}

            {annexFiles.length > 0 && (
              <button
                type="button"
                className="er__btn er__btn--primary"
                onClick={submitWithAnnexures}
              >
                Merge Annexures & Re-Number
              </button>
            )}
            <button type="button" className="er__btn er__btn--outline" onClick={handleReset}>
              Cancel
            </button>
          </section>
        )}

        {/* === STEP 4: done ============================================ */}
        {step === 'done' && (
          <section className="er__upload-section">
            <div className="er__annex-prompt">
              <p className="er__annex-prompt-title">
                ✓ Final PDF downloaded with {annexFiles.length} annexure
                {annexFiles.length === 1 ? '' : 's'}.
              </p>
              <button
                type="button"
                className="er__btn er__btn--primary"
                onClick={handleReset}
              >
                Start Over
              </button>
            </div>
          </section>
        )}

        {/* === ERROR =================================================== */}
        {step === 'error' && (
          <section className="er__upload-section">
            <div className="er__error-msg">
              <p>{errorMsg}</p>
              <button type="button" className="er__btn er__btn--outline" onClick={handleReset}>
                Try Again
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
