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

/** A detected heading plus review state. */
interface ReviewRow extends BookmarkHeading {
  id: number;
  included: boolean;
  /** Optional end page when the section spans a range (e.g. pp. 5–7).
   * The bookmark still jumps to `page`; the range is shown in the title. */
  pageEnd?: number;
  /** NCLAT mode: false when the template section wasn't found in the
   * document — shown greyed until the user sets a page and ticks it. */
  found?: boolean;
  /** NCLAT mode: annexure rows nest under an "Annexures" parent. */
  isAnnex?: boolean;
}

const CONFIDENT = 0.6;

/** Standard NCLAT appeal paper-book sections, in filing order. A detected
 * heading is matched to the FIRST section whose pattern hits. */
const NCLAT_SECTIONS: { label: string; rx: RegExp }[] = [
  { label: 'Index', rx: /^index\b/i },
  { label: 'Synopsis & List of Dates', rx: /synopsis|list of dates|list of events/i },
  { label: 'Memo of Parties', rx: /memo of parties|memorandum of parties/i },
  { label: 'Appeal / Application', rx: /\b(appeal|application|petition)\b/i },
  { label: 'Impugned Order', rx: /impugned order|order under (appeal|challenge)/i },
  { label: 'Affidavit', rx: /affidavit/i },
  { label: 'Vakalatnama', rx: /vakalatnama|vakalat nama|memo of appearance/i },
  { label: 'Proof of Service / Fees', rx: /proof of service|court fee|demand draft|bharatkosh/i },
];

const ANNEX_RX = /annexure/i;

export default function BookmarksTool() {
  const doc = useFileList();
  const [phase, setPhase] = useState<'idle' | 'detecting' | 'review' | 'applying' | 'done' | 'error'>('idle');
  // Free-form rows (everything detection found, as-is).
  const [rows, setRows] = useState<ReviewRow[]>([]);
  // NCLAT checklist rows (template sections + annexures).
  const [tplRows, setTplRows] = useState<ReviewRow[]>([]);
  // NCLAT paper-book checklist is the default; free-form is the fallback.
  const [mode, setMode] = useState<'nclat' | 'free'>('nclat');
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);
  const [existingToc, setExistingToc] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [totalPages, setTotalPages] = useState<number | null>(null);
  // Blob URL of the uploaded document for the side-by-side review preview.
  const [previewUrl, setPreviewUrl] = useState('');
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
    setTplRows([]);
    setResult(null);
    setExistingToc(false);
    setPhase('idle');
    setErrorMsg('');
  };

  /** Build the NCLAT checklist from detected headings: each template
   * section gets the earliest matching heading's page; annexures are
   * collected separately and kept in page order. */
  const buildTplRows = (headings: BookmarkHeading[]): ReviewRow[] => {
    const sorted = [...headings].sort((a, b) => a.page - b.page);
    const used = new Set<BookmarkHeading>();

    const sectionRows: ReviewRow[] = NCLAT_SECTIONS.map((s) => {
      const hit = sorted.find((h) => !used.has(h) && !ANNEX_RX.test(h.title) && s.rx.test(h.title));
      if (hit) used.add(hit);
      return {
        id: nextId.current++,
        title: s.label,
        level: 1,
        page: hit ? hit.page : 1,
        confidence: hit ? hit.confidence : 1,
        source: hit ? hit.source : 'user_created',
        included: !!hit,
        found: !!hit,
      };
    });

    const annexRows: ReviewRow[] = sorted
      .filter((h) => ANNEX_RX.test(h.title))
      .map((h) => ({
        ...h,
        id: nextId.current++,
        included: true,
        found: true,
        isAnnex: true,
      }));

    return [...sectionRows, ...annexRows];
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
      setTplRows(buildTplRows(result.headings));
      setPhase('review');
    } catch (err: unknown) {
      setErrorMsg(friendlyError(err, 'Could not scan this document for headings.'));
      setPhase('error');
    }
  };

  // ── Active list plumbing: every row action works on whichever mode is on ──
  const activeRows = mode === 'nclat' ? tplRows : rows;
  const setActiveRows = mode === 'nclat' ? setTplRows : setRows;

  const patchRow = (id: number, patch: Partial<ReviewRow>) =>
    setActiveRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const removeRow = (id: number) => setActiveRows((rs) => rs.filter((r) => r.id !== id));

  // Drop the dragged row at the hovered row's position (drag-to-reorder).
  const dropRow = (targetId: number) => {
    if (dragId === null || dragId === targetId) return;
    setActiveRows((rs) => {
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
    setActiveRows((rs) => [
      ...rs,
      {
        id: nextId.current++,
        title: '',
        level: 1,
        page: 1,
        confidence: 1,
        source: 'user_created',
        included: true,
        found: true,
      },
    ]);

  const includedCount = activeRows.filter((r) => r.included && r.title.trim()).length;

  const apply = async () => {
    const finalRows = activeRows.filter((r) => r.included && r.title.trim());
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

      const rangeTitle = (r: ReviewRow) =>
        r.pageEnd && r.pageEnd > r.page
          ? `${r.title.trim()} (pp. ${r.page}–${r.pageEnd})`
          : r.title.trim();

      let headings: BookmarkHeading[];
      if (mode === 'nclat') {
        // NCLAT paper-book: main sections flat; annexures nested under a
        // synthesized "Annexures" parent at the first annexure's page.
        headings = [];
        let annexParentAdded = false;
        for (const r of finalRows) {
          if (r.isAnnex) {
            if (!annexParentAdded) {
              headings.push({
                title: 'Annexures',
                level: 1,
                page: r.page,
                confidence: 1,
                source: 'user_created',
              });
              annexParentAdded = true;
            }
            headings.push({ title: rangeTitle(r), level: 2, page: r.page, confidence: r.confidence, source: r.source });
          } else {
            headings.push({ title: rangeTitle(r), level: 1, page: r.page, confidence: r.confidence, source: r.source });
          }
        }
      } else {
        // Free-form: flat outline, on-screen order.
        headings = finalRows.map((r) => ({
          title: rangeTitle(r),
          level: 1,
          page: r.page,
          confidence: r.confidence,
          source: r.source,
        }));
      }

      const { blob, filename } = await documentApi.applyBookmarks(doc.files, headings);
      setResult({ blob, filename });
      trackTool('bookmarks');
      setPhase('done');
    } catch (err: unknown) {
      setErrorMsg(friendlyError(err, 'Could not write the bookmarks.'));
      setPhase('error');
    }
  };

  /** One bookmark row: grip · checkbox · title · Pg–range · ✗ */
  const renderRow = (r: ReviewRow) => (
    <div
      key={r.id}
      className={[
        'bm__row',
        r.included ? '' : 'bm__row--excluded',
        dragId === r.id ? 'bm__row--dragging' : '',
        dragOverId === r.id && dragId !== r.id ? 'bm__row--dragover' : '',
        r.isAnnex ? 'bm__row--annex' : '',
      ].join(' ')}
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
      {r.found === false && <span className="bm__row-hint">not found — set page &amp; tick</span>}
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
      <button
        type="button"
        className="bm__row-delete"
        onClick={() => removeRow(r.id)}
        aria-label="Delete bookmark"
      >
        ✗
      </button>
    </div>
  );

  // Free-form grouping: confident hits up top, uncertain ones tucked away.
  const freeMain = rows.filter((r) => r.confidence >= CONFIDENT || r.source === 'user_created');
  const freeUnsure = rows.filter((r) => r.confidence < CONFIDENT && r.source !== 'user_created');

  return (
    <div className="er">
      <div className="er__container">
        <header className="er__header">
          <h1 className="er__title">Bookmarks</h1>
          <p className="er__subtitle">
            Auto-detect the sections of your paper-book, confirm the page numbers, and download a
            copy with clickable bookmarks built in.
          </p>
        </header>

        <PlanBanner />

        <ToolNote>
          Bookmarks are the <strong>clickable outline in the PDF sidebar</strong> — they don&apos;t
          change how any page looks or prints. We pre-fill the standard{' '}
          <strong>NCLAT paper-book sections</strong> found in your document; just confirm the page
          numbers and hit <strong>Apply</strong>. Drag ⋮⋮ to reorder, ✗ to remove — nothing is
          written until you apply.
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
            <div className="bm__mode">
              <button
                type="button"
                className={`bm__mode-btn ${mode === 'nclat' ? 'bm__mode-btn--active' : ''}`}
                onClick={() => setMode('nclat')}
              >
                NCLAT Paper-book
              </button>
              <button
                type="button"
                className={`bm__mode-btn ${mode === 'free' ? 'bm__mode-btn--active' : ''}`}
                onClick={() => setMode('free')}
              >
                Other document
              </button>
            </div>

            <h2 className="er__section-heading">
              {mode === 'nclat'
                ? `Confirm sections — ${includedCount} selected`
                : `Review outline — ${includedCount} of ${rows.length} selected`}
            </h2>

            {mode === 'nclat' && (
              <p className="bm__notice">
                Standard NCLAT sections are pre-filled from your document. Fix any page number,
                tick a greyed section to include it, and annexures will be grouped under
                &ldquo;Annexures&rdquo; in the sidebar automatically.
              </p>
            )}
            {mode === 'free' && existingToc && (
              <p className="bm__notice">
                ✓ This PDF already contains a table of contents — shown below as the starting
                point. Edit freely; your changes replace it.
              </p>
            )}
            {mode === 'free' && rows.length === 0 && (
              <p className="bm__notice bm__notice--warn">
                ⚠ No headings detected. This can happen with scanned documents. Add bookmarks
                manually below.
              </p>
            )}

            <div className={`bm__split ${previewUrl ? 'bm__split--with-preview' : ''}`}>
            <div>
              {mode === 'nclat' ? (
                <div className="bm__list">{tplRows.map(renderRow)}</div>
              ) : (
                <>
                  <div className="bm__list">{freeMain.map(renderRow)}</div>
                  {freeUnsure.length > 0 && (
                    <details className="bm__unsure">
                      <summary>Not sure about these — {freeUnsure.length} more found</summary>
                      <div className="bm__list">{freeUnsure.map(renderRow)}</div>
                    </details>
                  )}
                </>
              )}
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
