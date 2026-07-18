import { useEffect, useMemo, useRef, useState } from 'react';
import {
  documentApi,
  trackTool,
  type BookmarkHeading,
  type IndexRow,
} from '../../services/documentApi';
import { gateTool } from '../../services/billingApi';
import { friendlyError } from '../../services/friendlyError';
import { countTotalPages } from '../../services/pdfInfo';
import Breadcrumb, { type BreadcrumbStep } from '../../components/Breadcrumb';
import PlanBanner from '../../components/PlanBanner';
import ToolNote from '../../components/ToolNote';
import '../../styles/ErrorReport.css';
import MainFileStep from './MainFileStep';
import AnnexPickStep from './AnnexPickStep';
import SigPickStep from './SigPickStep';
import SpecialPageStep from './SpecialPageStep';
import { parsePageSpec } from './pageSpec';
import { useFileList } from './useFileList';

/**
 * Document Prep — 2-phase pipeline wizard.
 *
 * Phase 1: Pages + Annexures → merge & number on server → numbered PDF preview
 * Phase 2: Signatures + Special Pages (user sees numbered PDF to pick pages) → final stamp
 *
 * The user MUST see the numbered document before choosing which pages to sign,
 * because page numbers only exist after merging + numbering.
 */
type Step =
  | 'main'        // collect main PDFs + index end page
  | 'annex'       // collect annexure files
  | 'merging'     // Phase 1 processing (merge + number)
  | 'preview'     // show numbered PDF, ask if signatures needed
  | 'bookmarks'   // review auto-detected bookmarks on the numbered PDF
  | 'index'       // master index page — rows pre-filled from bookmarks
  | 'sigs'        // collect annexure signatures
  | 'special'     // collect special page signatures (user sees numbered PDF)
  | 'review'      // final review before Phase 2
  | 'processing'  // Phase 2 processing (stamp signatures)
  | 'done'
  | 'error';

const STEP_ORDER: Step[] = ['main', 'annex', 'merging', 'preview', 'bookmarks', 'index', 'sigs', 'special', 'review'];

function stepIndex(s: Step): number {
  const i = STEP_ORDER.indexOf(s);
  return i === -1 ? STEP_ORDER.length - 1 : i;
}

export default function ErrorReport() {
  const main = useFileList();
  const annex = useFileList();

  const [clientSig, setClientSig] = useState<File | null>(null);
  const [advocateSig, setAdvocateSig] = useState<File | null>(null);
  const [signPages, setSignPages] = useState<string>('');
  const [specialClientSig, setSpecialClientSig] = useState<File | null>(null);
  const [specialAdvocateSig, setSpecialAdvocateSig] = useState<File | null>(null);
  const [indexEndPage, setIndexEndPage] = useState<string>('');
  const [step, setStep] = useState<Step>('main');
  const [furthest, setFurthest] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [mainPages, setMainPages] = useState<number | null>(null);

  // Phase 1 result — the merged+numbered PDF (no signatures yet).
  const [numberedBlob, setNumberedBlob] = useState<Blob | null>(null);
  const [numberedFilename, setNumberedFilename] = useState('');
  // Total pages in the numbered PDF (main + annexure pages combined).
  const [numberedTotalPages, setNumberedTotalPages] = useState<number | null>(null);

  // ── Bookmarks step: rows detected on the NUMBERED PDF ──
  interface BmRow {
    id: number;
    title: string;
    page: number;
    included: boolean;
    confidence: number;
    source: BookmarkHeading['source'];
  }
  const [bmRows, setBmRows] = useState<BmRow[]>([]);
  const [bmLoaded, setBmLoaded] = useState(false);
  const [bmLoading, setBmLoading] = useState(false);
  const bmNextId = useRef(0);

  // ── Index step: case details + rows (pre-filled from bookmarks) ──
  const [idxWanted, setIdxWanted] = useState(false);
  const [idxCourt, setIdxCourt] = useState('');
  const [idxCaseLine, setIdxCaseLine] = useState('');
  const [idxPlace, setIdxPlace] = useState('');
  const [idxDate, setIdxDate] = useState('');
  const [idxRows, setIdxRows] = useState<IndexRow[]>([]);
  const [idxPrefilled, setIdxPrefilled] = useState(false);

  // Detect bookmarks once per numbered PDF, when the step is first opened.
  useEffect(() => {
    if (step !== 'bookmarks' || !numberedBlob || bmLoaded || bmLoading) return;
    let cancelled = false;
    setBmLoading(true);
    const file = new File([numberedBlob], numberedFilename || 'document.pdf', {
      type: 'application/pdf',
    });
    documentApi
      .detectBookmarks(file)
      .then((res) => {
        if (cancelled) return;
        setBmRows(
          (res.ok ? res.headings : []).map((h) => ({
            id: bmNextId.current++,
            title: h.title,
            page: h.page,
            included: h.confidence >= 0.6,
            confidence: h.confidence,
            source: h.source,
          })),
        );
        setBmLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setBmRows([]);
        setBmLoaded(true); // detection failed — user can still add manually
      })
      .finally(() => {
        if (!cancelled) setBmLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, numberedBlob, numberedFilename, bmLoaded, bmLoading]);

  const patchBmRow = (id: number, patch: Partial<BmRow>) =>
    setBmRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeBmRow = (id: number) => setBmRows((rs) => rs.filter((r) => r.id !== id));
  const addBmRow = () =>
    setBmRows((rs) => [
      ...rs,
      { id: bmNextId.current++, title: '', page: 1, included: true, confidence: 1, source: 'user_created' },
    ]);

  const bmSelected = bmRows.filter((r) => r.included && r.title.trim());

  // Entering the Index step pre-fills its rows from the selected bookmarks
  // (once — user edits are never clobbered).
  useEffect(() => {
    if (step !== 'index' || idxPrefilled) return;
    if (bmSelected.length > 0) {
      setIdxRows(bmSelected.map((r) => ({ title: r.title.trim(), pages: String(r.page) })));
    }
    setIdxPrefilled(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, idxPrefilled]);

  const patchIdxRow = (i: number, patch: Partial<IndexRow>) =>
    setIdxRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const removeIdxRow = (i: number) => setIdxRows((rs) => rs.filter((_, j) => j !== i));
  const addIdxRow = () => setIdxRows((rs) => [...rs, { title: '', pages: '' }]);

  const idxReady = idxWanted && idxRows.some((r) => r.title.trim());

  const clientSigInputRef = useRef<HTMLInputElement>(null);
  const advocateSigInputRef = useRef<HTMLInputElement>(null);
  const specialClientSigInputRef = useRef<HTMLInputElement>(null);
  const specialAdvocateSigInputRef = useRef<HTMLInputElement>(null);

  const isBusy = step === 'merging' || step === 'processing';

  useEffect(() => {
    if (!isBusy) {
      setElapsedSeconds(0);
      return;
    }
    const t = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [isBusy]);

  useEffect(() => {
    documentApi.warmUp();
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (main.files.length === 0) {
      setMainPages(null);
      return;
    }
    countTotalPages(main.files).then((n) => {
      if (!cancelled) setMainPages(n);
    });
    return () => { cancelled = true; };
  }, [main.files]);

  const safeIndexEnd = () => {
    const n = Number.parseInt(indexEndPage, 10);
    if (!Number.isFinite(n) || n < 0) return 0;
    return mainPages !== null ? Math.min(n, mainPages) : n;
  };

  // maxStampedPage uses the NUMBERED PDF's total pages (after merge), not just main.
  const maxStampedPage = numberedTotalPages !== null
    ? numberedTotalPages - safeIndexEnd()
    : (mainPages !== null ? mainPages - safeIndexEnd() : null);

  const signPagesCheck = useMemo(() => {
    const trimmed = signPages.trim();
    if (!trimmed) return { kind: 'empty' as const };
    try {
      const set = parsePageSpec(trimmed);
      if (set.size === 0) return { kind: 'empty' as const };
      const top = Math.max(...set);
      if (maxStampedPage !== null && top > maxStampedPage) {
        return {
          kind: 'error' as const,
          message: `Page ${top} doesn't exist — the document only has ${maxStampedPage} numbered page${maxStampedPage === 1 ? '' : 's'}.`,
        };
      }
      return { kind: 'ok' as const, count: set.size };
    } catch (e) {
      return { kind: 'error' as const, message: e instanceof Error ? e.message : 'Invalid format' };
    }
  }, [signPages, maxStampedPage]);

  const goTo = (s: Step) => {
    setStep(s);
    setFurthest((f) => Math.max(f, stepIndex(s)));
  };

  const handleReset = () => {
    main.reset();
    annex.reset();
    setClientSig(null);
    setAdvocateSig(null);
    setSignPages('');
    setSpecialClientSig(null);
    setSpecialAdvocateSig(null);
    setIndexEndPage('');
    setStep('main');
    setFurthest(0);
    setErrorMsg('');
    setMainPages(null);
    setNumberedBlob(null);
    setNumberedFilename('');
    setNumberedTotalPages(null);
    setBmRows([]);
    setBmLoaded(false);
    setIdxWanted(false);
    setIdxCourt('');
    setIdxCaseLine('');
    setIdxPlace('');
    setIdxDate('');
    setIdxRows([]);
    setIdxPrefilled(false);
    if (clientSigInputRef.current) clientSigInputRef.current.value = '';
    if (advocateSigInputRef.current) advocateSigInputRef.current.value = '';
    if (specialClientSigInputRef.current) specialClientSigInputRef.current.value = '';
    if (specialAdvocateSigInputRef.current) specialAdvocateSigInputRef.current.value = '';
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Phase 1: Merge + Number (no signatures) ──
  const mergeAndNumber = async () => {
    if (main.files.length === 0) return;
    setErrorMsg('');
    setStep('merging');
    try {
      const block = await gateTool('document-prep');
      if (block) {
        setErrorMsg(block);
        setStep('error');
        return;
      }
      const { blob, filename } = await documentApi.writePagination(
        main.files,
        safeIndexEnd(),
        annex.files.length > 0 ? annex.files : [],
      );
      setNumberedBlob(blob);
      setNumberedFilename(filename);
      // Count pages in the numbered result so special-page validation is accurate.
      const file = new File([blob], filename, { type: 'application/pdf' });
      const pages = await countTotalPages([file]);
      setNumberedTotalPages(pages);
      goTo('preview');
    } catch (err: unknown) {
      setErrorMsg(friendlyError(err, 'Failed to merge and number the document.'));
      setStep('error');
    }
  };

  // ── Phase 2: signatures → index page → bookmarks, chained in order.
  // The index page is PREPENDED, which shifts every page — so bookmarks go
  // LAST, with their page numbers offset by however many pages the index
  // added. That keeps every bookmark landing on the right page.
  const stampSignatures = async () => {
    if (main.files.length === 0) return;
    if (signPages.trim() && signPagesCheck.kind === 'error') return;
    setErrorMsg('');
    setStep('processing');
    try {
      const useSpecial = signPages.trim() && (specialClientSig || specialAdvocateSig);
      const hasSigs = clientSig || advocateSig || useSpecial;

      // 1) Base document: numbered (+ signatures if any).
      let blob: Blob;
      let filename: string;
      if (hasSigs) {
        ({ blob, filename } = await documentApi.writePagination(
          main.files,
          safeIndexEnd(),
          annex.files.length > 0 ? annex.files : [],
          clientSig || advocateSig ? { client: clientSig, advocate: advocateSig } : undefined,
          undefined,
          useSpecial ? signPages.trim() : undefined,
          useSpecial ? { client: specialClientSig, advocate: specialAdvocateSig } : undefined,
        ));
      } else {
        if (!numberedBlob) throw new Error('Numbered document missing — go back to Preview.');
        blob = numberedBlob;
        filename = numberedFilename;
      }

      // 2) Master index page (prepended). Track how many pages it added.
      let indexOffset = 0;
      if (idxReady) {
        const beforeFile = new File([blob], filename, { type: 'application/pdf' });
        const before = await countTotalPages([beforeFile]);
        ({ blob, filename } = await documentApi.generateIndex(
          {
            court: idxCourt.trim() ? idxCourt.split('\n').map((l) => l.trim()).filter(Boolean) : [],
            caseLines: idxCaseLine.trim() ? [idxCaseLine.trim()] : [],
            matters: [],
            indexTitle: 'INDEX',
            rows: idxRows.filter((r) => r.title.trim()),
            advocates: [],
            place: idxPlace.trim(),
            date: idxDate.trim(),
          },
          [beforeFile],
        ));
        const afterFile = new File([blob], filename, { type: 'application/pdf' });
        const after = await countTotalPages([afterFile]);
        // If either count fails, assume the usual single index page.
        indexOffset = before !== null && after !== null ? after - before : 1;
      }

      // 3) Bookmarks — written last so destinations are final.
      if (bmSelected.length > 0) {
        const headings: BookmarkHeading[] = bmSelected.map((r) => ({
          title: r.title.trim(),
          level: 1,
          page: r.page + indexOffset,
          confidence: r.confidence,
          source: r.source,
        }));
        if (indexOffset > 0) {
          headings.unshift({
            title: 'Index',
            level: 1,
            page: 1,
            confidence: 1,
            source: 'user_created',
          });
        }
        const bmFile = new File([blob], filename, { type: 'application/pdf' });
        ({ blob, filename } = await documentApi.applyBookmarks(bmFile, headings));
      }

      triggerDownload(blob, filename);
      trackTool('document-prep');
      setStep('done');
    } catch (err: unknown) {
      setErrorMsg(friendlyError(err, 'Failed to finish the document.'));
      setStep('error');
    }
  };

  // ── Breadcrumb ──
  const crumbs: BreadcrumbStep[] = [
    { label: 'Pages', active: step === 'main', done: furthest > 0 && step !== 'main', reachable: true },
    { label: 'Annexures', active: step === 'annex', done: furthest > 1 && step !== 'annex', reachable: main.files.length > 0 },
    { label: 'Preview', active: step === 'preview' || step === 'merging', done: furthest > 3 && step !== 'preview', reachable: !!numberedBlob },
    { label: 'Bookmarks', active: step === 'bookmarks', done: furthest > 4 && step !== 'bookmarks', reachable: !!numberedBlob },
    { label: 'Index', active: step === 'index', done: furthest > 5 && step !== 'index', reachable: !!numberedBlob },
    { label: 'Signatures', active: step === 'sigs', done: furthest > 6 && step !== 'sigs', reachable: !!numberedBlob },
    { label: 'Special Pages', active: step === 'special', done: furthest > 7 && step !== 'special', reachable: !!numberedBlob },
    { label: 'Review', active: step === 'review' || step === 'processing', done: step === 'done', reachable: !!numberedBlob },
  ];

  // Going back to pages/annexures invalidates everything built on the
  // numbered PDF (bookmarks were detected on it, index rows came from those).
  const invalidateNumbered = () => {
    setNumberedBlob(null);
    setNumberedFilename('');
    setNumberedTotalPages(null);
    setBmRows([]);
    setBmLoaded(false);
    setIdxPrefilled(false);
  };

  const jumpToStep = (idx: number) => {
    if (isBusy) return;
    const targets: Step[] = ['main', 'annex', 'preview', 'bookmarks', 'index', 'sigs', 'special', 'review'];
    const target = targets[idx];
    if (!target) return;
    // Can't jump past preview without having a numbered PDF.
    if (idx >= 2 && !numberedBlob) return;
    if (idx <= 1 && numberedBlob) invalidateNumbered();
    setStep(target);
  };

  // ── Summary helpers ──
  const sigSummary = [clientSig && 'client', advocateSig && 'advocate'].filter(Boolean).join(' + ');
  const specialSigSummary = [specialClientSig && 'client', specialAdvocateSig && 'advocate']
    .filter(Boolean).join(' + ');
  const specialActive = Boolean(signPages.trim() && (specialClientSig || specialAdvocateSig));
  const hasSigs = !!(clientSig || advocateSig || specialActive);

  // Preview URL for the numbered PDF blob.
  const [previewUrl, setPreviewUrl] = useState('');
  useEffect(() => {
    if (!numberedBlob) {
      setPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(numberedBlob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [numberedBlob]);

  return (
    <div className="er">
      <div className="er__container">
        <header className="er__header">
          <h1 className="er__title">Document Prep</h1>
          <p className="er__subtitle">
            Upload your documents, merge and number them, then add signatures where needed.
          </p>
        </header>

        <PlanBanner />

        <ToolNote>
          <strong>Step 1:</strong> Upload pages &amp; annexures → we merge and number them.{' '}
          <strong>Step 2:</strong> See the numbered PDF, then choose which pages to sign.
          Your files are processed in memory and never stored.
        </ToolNote>

        <Breadcrumb steps={crumbs} onJump={jumpToStep} />

        {/* ── Step 1: Main files ── */}
        {step === 'main' && (
          <section className="er__upload-section">
            <MainFileStep
              files={main.files}
              inputRef={main.inputRef}
              onAdd={main.add}
              onMove={main.move}
              onRemove={main.remove}
              indexEndPage={indexEndPage}
              setIndexEndPage={setIndexEndPage}
              onSubmit={() => goTo('annex')}
              isProcessing={false}
              hideSubmit
              maxPages={mainPages}
              startFromMode
            />
            {main.files.length > 0 && (
              <div className="er__annex-prompt-actions">
                <button type="button" className="er__btn er__btn--primary" onClick={() => goTo('annex')}>
                  Next: Annexures →
                </button>
              </div>
            )}
          </section>
        )}

        {/* ── Step 2: Annexures ── */}
        {step === 'annex' && (
          <section className="er__upload-section">
            <p className="er__annex-prompt-hint">
              Each annexure file becomes one annexure — <em>Annexure A-1</em>, <em>A-2</em>, … stamped
              top-centre of its first page, appended after the main document with continuous
              numbering. Optional: skip if you have none.
            </p>
            <AnnexPickStep
              files={annex.files}
              inputRef={annex.inputRef}
              onAdd={annex.add}
              onMove={annex.move}
              onRemove={annex.remove}
              onSubmit={mergeAndNumber}
              onCancel={mergeAndNumber}
              hideSubmit
              hideCancel
            />
            <div className="er__annex-prompt-actions">
              <button type="button" className="er__btn er__btn--primary" onClick={mergeAndNumber}>
                {annex.files.length > 0 ? 'Merge & Number →' : 'Skip annexures & Number →'}
              </button>
              <button type="button" className="er__btn er__btn--outline" onClick={() => setStep('main')}>
                ← Back
              </button>
            </div>
          </section>
        )}

        {/* ── Phase 1 processing: merging ── */}
        {step === 'merging' && (
          <section className="er__upload-section">
            <div className="er__processing">
              <div className="er__spinner" />
              <p className="er__processing-text">Merging and numbering your document…</p>
              <p className="er__processing-hint">
                {elapsedSeconds < 60
                  ? `${elapsedSeconds}s elapsed`
                  : `${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s elapsed`}
                {elapsedSeconds > 30 && ' — backend may be waking up, hang tight'}
              </p>
            </div>
          </section>
        )}

        {/* ── Preview: numbered PDF ── */}
        {step === 'preview' && numberedBlob && (
          <section className="er__upload-section">
            <h2 className="er__section-heading">
              Numbered document ready
              {numberedTotalPages !== null && ` — ${numberedTotalPages} pages`}
            </h2>
            <p className="er__annex-prompt-hint">
              Your document has been merged and numbered. Scroll through the preview below to see the
              stamped page numbers (top-right). You can now add signatures, or download as-is.
            </p>

            {previewUrl && (
              <div className="er__preview">
                <iframe
                  src={`${previewUrl}#toolbar=1&navpanes=0`}
                  title="Numbered document preview"
                  className="er__preview-frame"
                />
              </div>
            )}

            <div className="er__annex-prompt-actions">
              <button type="button" className="er__btn er__btn--primary" onClick={() => goTo('bookmarks')}>
                Next: Bookmarks →
              </button>
              <button
                type="button"
                className="er__btn er__btn--outline"
                onClick={() => {
                  triggerDownload(numberedBlob, numberedFilename);
                  trackTool('document-prep');
                  setStep('done');
                }}
              >
                Download as-is
              </button>
            </div>
          </section>
        )}

        {/* ── Step: Bookmarks (detected on the numbered PDF) ── */}
        {step === 'bookmarks' && (
          <section className="er__upload-section">
            <p className="er__annex-prompt-hint">
              These become the <strong>clickable outline in the PDF sidebar</strong>. We scanned
              your numbered document — untick anything you don&apos;t want, fix titles or page
              numbers, or add your own. Optional: skip if not needed.
            </p>

            {bmLoading && (
              <div className="er__processing">
                <div className="er__spinner" />
                <p className="er__processing-text">Scanning for headings…</p>
              </div>
            )}

            {!bmLoading && bmLoaded && (
              <>
                {bmRows.length === 0 && (
                  <p className="er__annex-prompt-hint">
                    No headings detected (common with scanned documents) — add bookmarks manually
                    below, or skip.
                  </p>
                )}
                <div className="er__bm-list">
                  {bmRows.map((r) => (
                    <div key={r.id} className={`er__bm-row ${r.included ? '' : 'er__bm-row--off'}`}>
                      <input
                        type="checkbox"
                        checked={r.included}
                        onChange={(e) => patchBmRow(r.id, { included: e.target.checked })}
                        aria-label="Include bookmark"
                      />
                      <input
                        type="text"
                        className="er__bm-title"
                        value={r.title}
                        placeholder="Bookmark title"
                        onChange={(e) => patchBmRow(r.id, { title: e.target.value })}
                      />
                      <label className="er__bm-pg">
                        Pg
                        <input
                          type="number"
                          min={1}
                          max={numberedTotalPages ?? undefined}
                          value={r.page}
                          onChange={(e) => {
                            let p = Math.max(1, Number(e.target.value) || 1);
                            if (numberedTotalPages !== null) p = Math.min(p, numberedTotalPages);
                            patchBmRow(r.id, { page: p });
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        className="er__bm-delete"
                        onClick={() => removeBmRow(r.id)}
                        aria-label="Delete bookmark"
                      >
                        ✗
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className="er__btn er__btn--outline" onClick={addBmRow}>
                  + Add Bookmark
                </button>
              </>
            )}

            <div className="er__annex-prompt-actions">
              <button type="button" className="er__btn er__btn--primary" onClick={() => goTo('index')} disabled={bmLoading}>
                {bmSelected.length > 0
                  ? `Next: Index (${bmSelected.length} bookmark${bmSelected.length === 1 ? '' : 's'}) →`
                  : 'Skip bookmarks →'}
              </button>
              <button type="button" className="er__btn er__btn--outline" onClick={() => setStep('preview')}>
                ← Back to Preview
              </button>
            </div>
          </section>
        )}

        {/* ── Step: Master Index (rows pre-filled from bookmarks) ── */}
        {step === 'index' && (
          <section className="er__upload-section">
            <p className="er__annex-prompt-hint">
              A court-style <strong>Master Index page</strong> added at the front of your document.
              {bmSelected.length > 0 && ' Rows are pre-filled from your bookmarks — edit freely.'}{' '}
              Optional: skip if not needed.
            </p>

            <label className="er__idx-toggle">
              <input
                type="checkbox"
                checked={idxWanted}
                onChange={(e) => setIdxWanted(e.target.checked)}
              />
              Add a Master Index page
            </label>

            {idxWanted && (
              <>
                <div className="er__idx-fields">
                  <label>
                    Court (one line per row)
                    <textarea
                      rows={2}
                      value={idxCourt}
                      placeholder={'NATIONAL COMPANY LAW APPELLATE TRIBUNAL\nNEW DELHI'}
                      onChange={(e) => setIdxCourt(e.target.value)}
                    />
                  </label>
                  <label>
                    Case number line
                    <input
                      type="text"
                      value={idxCaseLine}
                      placeholder="Company Appeal (AT) No. ___ of 2026"
                      onChange={(e) => setIdxCaseLine(e.target.value)}
                    />
                  </label>
                  <div className="er__idx-two">
                    <label>
                      Place
                      <input type="text" value={idxPlace} placeholder="New Delhi" onChange={(e) => setIdxPlace(e.target.value)} />
                    </label>
                    <label>
                      Date
                      <input type="text" value={idxDate} placeholder="17.07.2026" onChange={(e) => setIdxDate(e.target.value)} />
                    </label>
                  </div>
                </div>

                <div className="er__bm-list">
                  {idxRows.map((r, i) => (
                    <div key={i} className="er__bm-row">
                      <span className="er__idx-num">{i + 1}.</span>
                      <input
                        type="text"
                        className="er__bm-title"
                        value={r.title}
                        placeholder="Particulars"
                        onChange={(e) => patchIdxRow(i, { title: e.target.value })}
                      />
                      <label className="er__bm-pg">
                        Pg
                        <input
                          type="text"
                          value={r.pages}
                          placeholder="1-5"
                          onChange={(e) => patchIdxRow(i, { pages: e.target.value })}
                        />
                      </label>
                      <button type="button" className="er__bm-delete" onClick={() => removeIdxRow(i)} aria-label="Delete row">
                        ✗
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className="er__btn er__btn--outline" onClick={addIdxRow}>
                  + Add Row
                </button>
              </>
            )}

            <div className="er__annex-prompt-actions">
              <button type="button" className="er__btn er__btn--primary" onClick={() => goTo('sigs')}>
                {idxReady ? 'Next: Signatures →' : 'Skip index →'}
              </button>
              <button type="button" className="er__btn er__btn--outline" onClick={() => setStep('bookmarks')}>
                ← Back
              </button>
            </div>
          </section>
        )}

        {/* ── Step 3: Annexure signatures ── */}
        {step === 'sigs' && (
          <section className="er__upload-section">
            <p className="er__annex-prompt-hint">
              These signatures are stamped in the footer of <strong>every annexure page</strong> —
              client left, advocate right. Content on the page is detected automatically and never
              covered. Optional: skip if not needed.
            </p>
            <SigPickStep
              clientSig={clientSig}
              advocateSig={advocateSig}
              clientInputRef={clientSigInputRef}
              advocateInputRef={advocateSigInputRef}
              onClientChange={setClientSig}
              onAdvocateChange={setAdvocateSig}
              onSubmit={() => goTo('special')}
              onCancel={() => goTo('special')}
              hideSubmit
              hideCancel
            />
            <div className="er__annex-prompt-actions">
              <button type="button" className="er__btn er__btn--primary" onClick={() => goTo('special')}>
                {clientSig || advocateSig ? 'Next: Special Pages →' : 'Skip signatures →'}
              </button>
              <button type="button" className="er__btn er__btn--outline" onClick={() => setStep('index')}>
                ← Back
              </button>
            </div>
          </section>
        )}

        {/* ── Step 4: Special pages (user sees numbered PDF) ── */}
        {step === 'special' && (
          <section className="er__upload-section">
            <p className="er__annex-prompt-hint">
              Sign specific pages (vakalatnama, prayer page, affidavit…) with their own signature
              images. Use the <strong>stamped page numbers</strong> from the preview
              {maxStampedPage !== null ? ` (1–${maxStampedPage})` : ''}. Optional.
            </p>
            <SpecialPageStep
              previewBlob={numberedBlob}
              signPages={signPages}
              onSignPagesChange={setSignPages}
              clientSig={specialClientSig}
              advocateSig={specialAdvocateSig}
              clientInputRef={specialClientSigInputRef}
              advocateInputRef={specialAdvocateSigInputRef}
              onClientChange={setSpecialClientSig}
              onAdvocateChange={setSpecialAdvocateSig}
              onSubmit={() => goTo('review')}
              onCancel={() => goTo('review')}
              hideActions
              maxPage={maxStampedPage}
            />
            <div className="er__annex-prompt-actions">
              <button
                type="button"
                className="er__btn er__btn--primary"
                onClick={() => goTo('review')}
                disabled={Boolean(signPages.trim()) && signPagesCheck.kind === 'error'}
              >
                {specialActive ? 'Next: Review →' : 'Skip special pages →'}
              </button>
              <button type="button" className="er__btn er__btn--outline" onClick={() => setStep('sigs')}>
                ← Back
              </button>
            </div>
          </section>
        )}

        {/* ── Review + Phase 2 processing ── */}
        {(step === 'review' || step === 'processing') && (
          <section className="er__upload-section">
            <h2 className="er__section-heading">Review your order</h2>
            <ul className="er__cart">
              <li className="er__cart-row">
                <span className="er__cart-what">📄 Main document</span>
                <span className="er__cart-detail">
                  {main.files.length} volume{main.files.length === 1 ? '' : 's'}
                  {numberedTotalPages !== null && ` · ${numberedTotalPages} pages`}
                  {safeIndexEnd() > 0
                    ? ` · numbering starts from page ${safeIndexEnd() + 1}`
                    : ' · numbered from page 1'}
                </span>
                <button type="button" className="er__cart-edit" onClick={() => { invalidateNumbered(); setStep('main'); }}
                        disabled={step === 'processing'}>Edit</button>
              </li>
              <li className={`er__cart-row ${annex.files.length === 0 ? 'er__cart-row--skip' : ''}`}>
                <span className="er__cart-what">📎 Annexures</span>
                <span className="er__cart-detail">
                  {annex.files.length > 0
                    ? `${annex.files.length} file${annex.files.length === 1 ? '' : 's'} → A-1…A-${annex.files.length}`
                    : 'skipped'}
                </span>
                <button type="button" className="er__cart-edit" onClick={() => { invalidateNumbered(); setStep('annex'); }}
                        disabled={step === 'processing'}>Edit</button>
              </li>
              <li className="er__cart-row er__cart-row--done">
                <span className="er__cart-what">🔢 Merge &amp; Number</span>
                <span className="er__cart-detail">✓ done</span>
              </li>
              <li className={`er__cart-row ${bmSelected.length === 0 ? 'er__cart-row--skip' : ''}`}>
                <span className="er__cart-what">🔖 Bookmarks</span>
                <span className="er__cart-detail">
                  {bmSelected.length > 0
                    ? `${bmSelected.length} clickable bookmark${bmSelected.length === 1 ? '' : 's'} in the sidebar`
                    : 'skipped'}
                </span>
                <button type="button" className="er__cart-edit" onClick={() => setStep('bookmarks')}
                        disabled={step === 'processing'}>Edit</button>
              </li>
              <li className={`er__cart-row ${!idxReady ? 'er__cart-row--skip' : ''}`}>
                <span className="er__cart-what">☰ Master Index</span>
                <span className="er__cart-detail">
                  {idxReady
                    ? `index page with ${idxRows.filter((r) => r.title.trim()).length} row${idxRows.filter((r) => r.title.trim()).length === 1 ? '' : 's'} — added at the front`
                    : 'skipped'}
                </span>
                <button type="button" className="er__cart-edit" onClick={() => setStep('index')}
                        disabled={step === 'processing'}>Edit</button>
              </li>
              <li className={`er__cart-row ${!sigSummary ? 'er__cart-row--skip' : ''}`}>
                <span className="er__cart-what">✍️ Annexure signatures</span>
                <span className="er__cart-detail">
                  {sigSummary ? `${sigSummary} — on every annexure page` : 'skipped'}
                </span>
                <button type="button" className="er__cart-edit" onClick={() => setStep('sigs')}
                        disabled={step === 'processing'}>Edit</button>
              </li>
              <li className={`er__cart-row ${!specialActive ? 'er__cart-row--skip' : ''}`}>
                <span className="er__cart-what">📝 Special pages</span>
                <span className="er__cart-detail">
                  {specialActive
                    ? `${specialSigSummary} on pages ${signPages.trim()}`
                    : 'skipped'}
                </span>
                <button type="button" className="er__cart-edit" onClick={() => setStep('special')}
                        disabled={step === 'processing'}>Edit</button>
              </li>
            </ul>

            {signPagesCheck.kind === 'error' && specialActive && (
              <p className="er__sig-extra-error">⚠ {signPagesCheck.message}</p>
            )}

            {step === 'review' && (
              <div className="er__annex-prompt-actions">
                <button
                  type="button"
                  className="er__btn er__btn--primary"
                  onClick={stampSignatures}
                  disabled={specialActive && signPagesCheck.kind === 'error'}
                >
                  {hasSigs || bmSelected.length > 0 || idxReady ? 'Finish & Download' : 'Download'}
                </button>
                <button type="button" className="er__btn er__btn--outline" onClick={handleReset}>
                  Start Over
                </button>
              </div>
            )}

            {step === 'processing' && (
              <div className="er__processing">
                <div className="er__spinner" />
                <p className="er__processing-text">Finishing your document…</p>
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

        {step === 'done' && (
          <section className="er__upload-section">
            <div className="er__annex-prompt">
              <p className="er__annex-prompt-title">
                ✓ Final PDF downloaded — {main.files.length} volume{main.files.length === 1 ? '' : 's'}
                {annex.files.length > 0 && `, ${annex.files.length} annexure${annex.files.length === 1 ? '' : 's'}`}
                {bmSelected.length > 0 && `, ${bmSelected.length} bookmarks`}
                {idxReady && ', master index'}
                {sigSummary && ', annexure signatures'}
                {specialActive && ', special-page signatures'}.
              </p>
              <button type="button" className="er__btn er__btn--primary" onClick={handleReset}>
                Start Over
              </button>
            </div>
          </section>
        )}

        {step === 'error' && (
          <section className="er__upload-section">
            <div className="er__error-msg">
              <p>{errorMsg}</p>
              <button type="button" className="er__btn er__btn--outline" onClick={() => setStep(numberedBlob ? 'review' : 'annex')}>
                {numberedBlob ? 'Back to Review' : 'Back'}
              </button>
              <button type="button" className="er__btn er__btn--outline" onClick={handleReset}>
                Start Over
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
