import { useRef, useState, useEffect } from 'react';
import { documentApi, trackTool, type BookmarkHeading } from '../../services/documentApi';
import { friendlyError } from '../../services/friendlyError';
import Dropzone from '../ErrorReport/Dropzone';
import FileList from '../ErrorReport/FileList';
import ProcessingPanel from '../../components/ProcessingPanel';
import ResultPreview from '../../components/ResultPreview';
import { useChainedIntake } from '../../services/toolChain';
import { useFileList } from '../ErrorReport/useFileList';
import '../../styles/ErrorReport.css';
import '../../styles/Bookmarks.css';

/** A detected heading plus review state. `included` starts true for
 * confident hits and false for low-confidence ones, so the default
 * "just click Apply" path already produces a clean tree. */
interface ReviewRow extends BookmarkHeading {
  id: number;
  included: boolean;
}

const CONFIDENT = 0.6;

export default function BookmarksTool() {
  const doc = useFileList();
  const [phase, setPhase] = useState<'idle' | 'detecting' | 'review' | 'applying' | 'done' | 'error'>('idle');
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);
  const [existingToc, setExistingToc] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const nextId = useRef(0);

  useEffect(() => {
    documentApi.warmUp();
  }, []);

  const chainedFrom = useChainedIntake(doc.add);

  const busy = phase === 'detecting' || phase === 'applying';

  const reset = () => {
    doc.reset();
    setRows([]);
    setResult(null);
    setExistingToc(false);
    setPhase('idle');
    setErrorMsg('');
  };

  const detect = async () => {
    if (doc.files.length === 0) return;
    setErrorMsg('');
    setPhase('detecting');
    try {
      const result = await documentApi.detectBookmarks(doc.files);
      if (!result.ok) throw new Error(result.error || 'Detection failed');
      setExistingToc(result.existing_toc);
      setRows(
        result.headings.map((h) => ({
          ...h,
          id: nextId.current++,
          included: h.confidence >= CONFIDENT,
        })),
      );
      setPhase('review');
    } catch (err: unknown) {
      setErrorMsg(friendlyError(err, 'Could not scan this document for headings.'));
      setPhase('error');
    }
  };

  const apply = async () => {
    const finalRows = rows.filter((r) => r.included && r.title.trim());
    if (finalRows.length === 0) return;
    setErrorMsg('');
    setPhase('applying');
    try {
      const { blob, filename } = await documentApi.applyBookmarks(
        doc.files,
        finalRows.map(({ title, level, page, confidence, source }) => ({
          title: title.trim(),
          level,
          page,
          confidence,
          source,
        })),
      );
      setResult({ blob, filename });
      trackTool('bookmarks');
      setPhase('done');
    } catch (err: unknown) {
      setErrorMsg(friendlyError(err, 'Could not write the bookmarks.'));
      setPhase('error');
    }
  };

  const patchRow = (id: number, patch: Partial<ReviewRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const removeRow = (id: number) => setRows((rs) => rs.filter((r) => r.id !== id));

  const addManual = () =>
    setRows((rs) => [
      ...rs,
      {
        id: nextId.current++,
        title: '',
        level: 1,
        page: 1,
        confidence: 1,
        source: 'user_created',
        included: true,
      },
    ]);

  const includedCount = rows.filter((r) => r.included && r.title.trim()).length;

  return (
    <div className="er">
      <div className="er__container">
        <header className="er__header">
          <h1 className="er__title">Bookmarks</h1>
          <p className="er__subtitle">
            Auto-detect chapters, sections and annexures in your PDF, review the outline, and
            download a copy with clickable bookmarks built in.
          </p>
        </header>

        {(phase === 'idle' || phase === 'detecting') && (
          <>
            <section className="er__upload-section">
              <h2 className="er__section-heading">Document</h2>
              {chainedFrom && (
                <p className="rp__chip">✓ Document carried over from {chainedFrom} — ready to go.</p>
              )}
              <Dropzone
                inputId="bm-doc-upload"
                inputRef={doc.inputRef}
                hasFiles={doc.files.length > 0}
                mainText={doc.files.length ? 'Add another volume' : 'Drop your PDF here or click to browse'}
                hintText={doc.files.length ? 'Files are merged in order' : 'Upload one or multiple PDFs — up to 100MB each'}
                onAdd={doc.add}
              />
              {doc.files.length > 0 && (
                <FileList
                  files={doc.files}
                  rowLabel={(i) => `Vol ${i + 1}`}
                  onMove={doc.move}
                  onRemove={doc.remove}
                  disabled={phase === 'detecting'}
                />
              )}
            </section>

            {doc.files.length > 0 && phase === 'idle' && (
              <button type="button" className="er__btn er__btn--primary" onClick={detect}>
                Detect Bookmarks
              </button>
            )}
          </>
        )}

        {phase === 'review' && (
          <section className="er__upload-section">
            <h2 className="er__section-heading">
              Review outline — {includedCount} of {rows.length} selected
            </h2>
            {existingToc && (
              <p className="bm__notice">
                ✓ This PDF already contains a table of contents — shown below as the starting
                point. Edit freely; your changes replace it.
              </p>
            )}
            {rows.length === 0 && (
              <p className="bm__notice bm__notice--warn">
                ⚠ No headings detected. This can happen with scanned documents. Add bookmarks
                manually below.
              </p>
            )}

            <div className="bm__list">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className={`bm__row ${r.included ? '' : 'bm__row--excluded'}`}
                  style={{ paddingLeft: `${(r.level - 1) * 1.4 + 0.75}rem` }}
                >
                  <input
                    type="checkbox"
                    className="bm__row-check"
                    checked={r.included}
                    onChange={(e) => patchRow(r.id, { included: e.target.checked })}
                    aria-label="Include bookmark"
                  />
                  <input
                    type="text"
                    className="bm__row-title"
                    value={r.title}
                    placeholder="Bookmark title"
                    onChange={(e) => patchRow(r.id, { title: e.target.value })}
                  />
                  <label className="bm__row-field">
                    Lv
                    <input
                      type="number"
                      min={1}
                      max={6}
                      value={r.level}
                      onChange={(e) =>
                        patchRow(r.id, { level: Math.max(1, Math.min(6, Number(e.target.value) || 1)) })
                      }
                    />
                  </label>
                  <label className="bm__row-field">
                    Pg
                    <input
                      type="number"
                      min={1}
                      value={r.page}
                      onChange={(e) => patchRow(r.id, { page: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </label>
                  {r.source !== 'user_created' && (
                    <span
                      className={`bm__row-conf ${r.confidence >= CONFIDENT ? 'bm__row-conf--hi' : 'bm__row-conf--lo'}`}
                      title="Detection confidence"
                    >
                      {Math.round(r.confidence * 100)}%
                    </span>
                  )}
                  <button
                    type="button"
                    className="bm__row-delete"
                    onClick={() => removeRow(r.id)}
                    aria-label="Delete bookmark"
                  >
                    ✗
                  </button>
                </div>
              ))}
            </div>

            <button type="button" className="er__btn er__btn--outline" onClick={addManual}>
              + Add Bookmark Manually
            </button>

            {includedCount > 0 && (
              <button type="button" className="er__btn er__btn--primary" onClick={apply}>
                Apply {includedCount} Bookmark{includedCount === 1 ? '' : 's'} &amp; Download
              </button>
            )}
            <button type="button" className="er__btn er__btn--outline" onClick={reset}>
              Start Over
            </button>
          </section>
        )}

        {busy && (
          <ProcessingPanel
            label={phase === 'detecting' ? 'Scanning document structure' : 'Writing bookmarks'}
          />
        )}

        {phase === 'done' && result && (
          <ResultPreview
            blob={result.blob}
            filename={result.filename}
            message="✓ PDF ready with bookmarks."
            onReset={reset}
            producedBy="Bookmarks"
            nextSteps={[
              { label: 'Stamp Signatures', to: '/tools/signatures' },
              { label: 'Generate Index', to: '/tools/index-generator' },
            ]}
          />
        )}

        {phase === 'error' && (
          <section className="er__upload-section">
            <div className="er__error-msg">
              <p>{errorMsg}</p>
              <button type="button" className="er__btn er__btn--outline" onClick={reset}>
                Try Again
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
