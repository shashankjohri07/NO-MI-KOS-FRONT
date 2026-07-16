import { useRef, useState, useEffect } from 'react';
import { documentApi, trackTool, type BookmarkHeading } from '../../services/documentApi';
import { friendlyError } from '../../services/friendlyError';
import { gateTool } from '../../services/billingApi';
import { countTotalPages } from '../../services/pdfInfo';
import PlanBanner from '../../components/PlanBanner';
import ToolNote from '../../components/ToolNote';
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
  /** Optional end page when the section spans a range (e.g. pp. 5–7).
   * The bookmark still jumps to `page`; the range is shown in the title. */
  pageEnd?: number;
}

const CONFIDENT = 0.6;

export default function BookmarksTool() {
  const doc = useFileList();
  const [phase, setPhase] = useState<'idle' | 'detecting' | 'review' | 'applying' | 'done' | 'error'>('idle');
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);
  const [existingToc, setExistingToc] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [totalPages, setTotalPages] = useState<number | null>(null);
  // Blob URL of the uploaded document for the side-by-side review preview.
  const [previewUrl, setPreviewUrl] = useState('');
  // Nesting levels are an advanced concept — hidden unless the user opts in.
  const [showLevels, setShowLevels] = useState(false);
  // Drag-to-reorder state: id being dragged and the row currently hovered.
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  // Row becomes draggable only while the mouse is down on its ⋮⋮ grip, so
  // selecting text in the title input never starts a drag.
  const [dragArmedId, setDragArmedId] = useState<number | null>(null);
  const nextId = useRef(0);

  useEffect(() => {
    documentApi.warmUp();
  }, []);

  // Page count (caps the Pg inputs) + preview URL for the review pane.
  useEffect(() => {
    if (doc.files.length === 0) {
      setTotalPages(null);
      setPreviewUrl('');
      return;
    }
    let cancelled = false;
    countTotalPages(doc.files).then((n) => {
      if (!cancelled) setTotalPages(n);
    });
    const url = URL.createObjectURL(doc.files[0]);
    setPreviewUrl(url);
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [doc.files]);

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
      const block = await gateTool('bookmarks');
      if (block) {
        setErrorMsg(block);
        setPhase('error');
        return;
      }
      const { blob, filename } = await documentApi.applyBookmarks(
        doc.files,
        finalRows.map(({ title, level, page, pageEnd, confidence, source }) => ({
          // A section spanning a range keeps its destination at the start
          // page (PDF bookmarks jump to ONE page) but shows the range in
          // the outline title, e.g. "Annexure A-3 (pp. 5–7)".
          title:
            pageEnd && pageEnd > page
              ? `${title.trim()} (pp. ${page}–${pageEnd})`
              : title.trim(),
          // Nesting only applies when the user opted in; otherwise the
          // PDF outline is written flat.
          level: showLevels ? level : 1,
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

  // Drop the dragged row at the hovered row's position (drag-to-reorder).
  const dropRow = (targetId: number) => {
    if (dragId === null || dragId === targetId) return;
    setRows((rs) => {
      const from = rs.findIndex((r) => r.id === dragId);
      const to = rs.findIndex((r) => r.id === targetId);
      if (from < 0 || to < 0) return rs;
      const next = [...rs];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

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

        <PlanBanner />

        <ToolNote>
          Bookmarks are the <strong>clickable outline in the PDF sidebar</strong> — they don&apos;t
          change how any page looks or prints. Headings detected with <strong>60 %+ confidence</strong>{' '}
          are auto-selected; lower-confidence ones are shown unchecked so you can include them
          manually if needed. Edit titles, reorder with ↑↓, or ✗ remove any entry — nothing is
          written until you hit <strong>Apply</strong>.
        </ToolNote>

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

            <label className="bm__levels-toggle">
              <input
                type="checkbox"
                checked={showLevels}
                onChange={(e) => setShowLevels(e.target.checked)}
              />
              Show nesting levels (indent sub-sections under chapters)
            </label>

            <div className={`bm__split ${previewUrl ? 'bm__split--with-preview' : ''}`}>
            <div className="bm__list">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className={[
                    'bm__row',
                    r.included ? '' : 'bm__row--excluded',
                    dragId === r.id ? 'bm__row--dragging' : '',
                    dragOverId === r.id && dragId !== r.id ? 'bm__row--dragover' : '',
                  ].join(' ')}
                  style={showLevels ? { paddingLeft: `${(r.level - 1) * 1.4 + 0.75}rem` } : undefined}
                  draggable={dragArmedId === r.id}
                  onDragStart={(e) => {
                    setDragId(r.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dragOverId !== r.id) setDragOverId(r.id);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    dropRow(r.id);
                    setDragId(null);
                    setDragOverId(null);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setDragOverId(null);
                    setDragArmedId(null);
                  }}
                >
                  <span
                    className="bm__row-grip"
                    title="Drag to reorder"
                    aria-hidden
                    onMouseDown={() => setDragArmedId(r.id)}
                    onMouseUp={() => setDragArmedId(null)}
                  >
                    ⋮⋮
                  </span>
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
                  {showLevels && (
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
                  )}
                  <label className="bm__row-field">
                    Pg
                    <input
                      type="number"
                      min={1}
                      max={totalPages ?? undefined}
                      value={r.page}
                      onChange={(e) => {
                        let p = Math.max(1, Number(e.target.value) || 1);
                        if (totalPages !== null) p = Math.min(p, totalPages);
                        patchRow(r.id, { page: p });
                      }}
                    />
                    –
                    <input
                      type="number"
                      min={r.page}
                      max={totalPages ?? undefined}
                      value={r.pageEnd ?? ''}
                      placeholder="to"
                      title="Optional end page — for a section spanning multiple pages"
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '') {
                          patchRow(r.id, { pageEnd: undefined });
                          return;
                        }
                        let p = Math.max(1, Number(raw) || 1);
                        if (totalPages !== null) p = Math.min(p, totalPages);
                        patchRow(r.id, { pageEnd: p });
                      }}
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

            {previewUrl && (
              <div className="bm__preview">
                <p className="bm__preview-label">
                  📄 Document preview — check headings and page numbers side-by-side
                  {totalPages !== null && ` (${totalPages} pages)`}
                </p>
                <iframe
                  src={`${previewUrl}#toolbar=0&navpanes=0`}
                  title="Document preview"
                  className="bm__preview-frame"
                />
              </div>
            )}
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
            summary={[
              `${includedCount} bookmark${includedCount === 1 ? '' : 's'} written`,
              'clickable outline in the PDF sidebar',
            ]}
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
