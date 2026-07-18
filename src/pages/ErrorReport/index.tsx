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
  | 'contents'    // ONE list (title + pages) -> Master Index AND bookmarks
  | 'sigs'        // collect annexure signatures
  | 'special'     // collect special page signatures (user sees numbered PDF)
  | 'review'      // final review before Phase 2
  | 'processing'  // Phase 2 processing (stamp signatures)
  | 'done'
  | 'error';

const STEP_ORDER: Step[] = ['main', 'annex', 'merging', 'preview', 'contents', 'sigs', 'special', 'review'];

function stepIndex(s: Step): number {
  const i = STEP_ORDER.indexOf(s);
  return i === -1 ? STEP_ORDER.length - 1 : i;
}

export default function ErrorReport() {
  const main = useFileList();
  const annex = useFileList();

  const [clientSig, setClientSig] = useState<File | null>(null);
  const [clientSig2, setClientSig2] = useState<File | null>(null);
  const [advocateSig, setAdvocateSig] = useState<File | null>(null);
  const [signPages, setSignPages] = useState<string>('');
  const [specialClientSig, setSpecialClientSig] = useState<File | null>(null);
  const [specialClientSig2, setSpecialClientSig2] = useState<File | null>(null);
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

  // ── Contents step: ONE user-curated list (title + pages) that drives BOTH
  // the Master Index page and the clickable bookmarks. Detection on the
  // numbered PDF only pre-fills suggestions — the user's list is the source
  // of truth (detection is unreliable on scanned pages and its wording is
  // not filing language).
  interface ContentsRow {
    id: number;
    title: string;
    /** Page or range in stamped numbering, e.g. "5" or "5-7". The index
     * prints it verbatim; the bookmark jumps to the first number. */
    pages: string;
  }
  const [ctRows, setCtRows] = useState<ContentsRow[]>([]);
  const [ctLoaded, setCtLoaded] = useState(false);
  const [ctLoading, setCtLoading] = useState(false);
  const ctNextId = useRef(0);
  const [wantIndex, setWantIndex] = useState(true);
  const [wantBookmarks, setWantBookmarks] = useState(true);
  // Case details for the index page header (only used when wantIndex).
  const [idxCourt, setIdxCourt] = useState('');
  const [idxCaseLine, setIdxCaseLine] = useState('');
  const [idxPlace, setIdxPlace] = useState('');
  const [idxDate, setIdxDate] = useState('');

  // Detect headings once per numbered PDF when the step first opens —
  // suggestions only, silently empty on scanned documents.
  useEffect(() => {
    if (step !== 'contents' || !numberedBlob || ctLoaded || ctLoading) return;
    let cancelled = false;
    setCtLoading(true);
    const file = new File([numberedBlob], numberedFilename || 'document.pdf', {
      type: 'application/pdf',
    });
    // Suggestions are nice-to-have — never let a slow/cold backend hold the
    // step hostage. Past 45s we give up and let the user type rows manually.
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('detection timed out')), 45000),
    );
    Promise.race([documentApi.detectBookmarks(file), timeout])
      .then((res) => {
        if (cancelled) return;
        // Detection reports PHYSICAL pages of the numbered PDF; the rows are
        // in STAMPED numbering (physical minus the unstamped front pages).
        const skip = safeIndexEnd();
        setCtRows(
          (res.ok ? res.headings : [])
            .filter((h) => h.confidence >= 0.6 && h.page > skip)
            .map((h) => ({
              id: ctNextId.current++,
              title: h.title,
              pages: String(h.page - skip),
            })),
        );
        setCtLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setCtRows([]);
        setCtLoaded(true); // detection failed — user types rows manually
      })
      .finally(() => {
        if (!cancelled) setCtLoading(false);
      });
    return () => {
      cancelled = true;
      setCtLoading(false); // stepping away abandons the scan; re-entering retries
    };
    // ctLoaded/ctLoading are guards, NOT deps: listing them re-fires the
    // cleanup the moment setCtLoading(true) renders, cancelling the fetch
    // we just started — the step then spins forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, numberedBlob]);

  // Object URL so the numbered PDF can sit beside the rows — the user reads
  // the stamped page numbers on the right while typing pages on the left.
  const [ctPreviewUrl, setCtPreviewUrl] = useState<string>('');
  useEffect(() => {
    if (step !== 'contents' || !numberedBlob) {
      setCtPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(numberedBlob);
    setCtPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [step, numberedBlob]);

  const patchCtRow = (id: number, patch: Partial<ContentsRow>) =>
    setCtRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeCtRow = (id: number) => setCtRows((rs) => rs.filter((r) => r.id !== id));
  const addCtRow = () =>
    setCtRows((rs) => [...rs, { id: ctNextId.current++, title: '', pages: '' }]);

  /** First page number of a "5" / "5-7" pages value; null when unparseable. */
  const firstPageOf = (pages: string): number | null => {
    const m = /^\s*(\d+)/.exec(pages);
    if (!m) return null;
    const n = Number.parseInt(m[1], 10);
    return Number.isFinite(n) && n >= 1 ? n : null;
  };

  const ctFinal = ctRows.filter((r) => r.title.trim());
  const doIndex = wantIndex && ctFinal.length > 0;
  const doBookmarks = wantBookmarks && ctFinal.length > 0;

  const clientSigInputRef = useRef<HTMLInputElement>(null);
  const clientSig2InputRef = useRef<HTMLInputElement>(null);
  const advocateSigInputRef = useRef<HTMLInputElement>(null);
  const specialClientSigInputRef = useRef<HTMLInputElement>(null);
  const specialClientSig2InputRef = useRef<HTMLInputElement>(null);
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
    setClientSig2(null);
    setAdvocateSig(null);
    setSignPages('');
    setSpecialClientSig(null);
    setSpecialClientSig2(null);
    setSpecialAdvocateSig(null);
    setIndexEndPage('');
    setStep('main');
    setFurthest(0);
    setErrorMsg('');
    setMainPages(null);
    setNumberedBlob(null);
    setNumberedFilename('');
    setNumberedTotalPages(null);
    setCtRows([]);
    setCtLoaded(false);
    setWantIndex(true);
    setWantBookmarks(true);
    setIdxCourt('');
    setIdxCaseLine('');
    setIdxPlace('');
    setIdxDate('');
    if (clientSigInputRef.current) clientSigInputRef.current.value = '';
    if (clientSig2InputRef.current) clientSig2InputRef.current.value = '';
    if (advocateSigInputRef.current) advocateSigInputRef.current.value = '';
    if (specialClientSigInputRef.current) specialClientSigInputRef.current.value = '';
    if (specialClientSig2InputRef.current) specialClientSig2InputRef.current.value = '';
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
      const useSpecial = signPages.trim() && (specialClientSig || specialClientSig2 || specialAdvocateSig);
      const hasSigs = clientSig || clientSig2 || advocateSig || useSpecial;

      // 1) Base document: numbered (+ signatures if any).
      let blob: Blob;
      let filename: string;
      if (hasSigs) {
        ({ blob, filename } = await documentApi.writePagination(
          main.files,
          safeIndexEnd(),
          annex.files.length > 0 ? annex.files : [],
          clientSig || clientSig2 || advocateSig
            ? { client: clientSig, client2: clientSig2, advocate: advocateSig }
            : undefined,
          undefined,
          useSpecial ? signPages.trim() : undefined,
          useSpecial
            ? { client: specialClientSig, client2: specialClientSig2, advocate: specialAdvocateSig }
            : undefined,
        ));
      } else {
        if (!numberedBlob) throw new Error('Numbered document missing — go back to Preview.');
        blob = numberedBlob;
        filename = numberedFilename;
      }

      // 2) Master index page (prepended). Track how many pages it added.
      let indexOffset = 0;
      if (doIndex) {
        const beforeFile = new File([blob], filename, { type: 'application/pdf' });
        const before = await countTotalPages([beforeFile]);
        const rows: IndexRow[] = ctFinal.map((r) => ({
          title: r.title.trim(),
          pages: r.pages.trim(),
        }));
        ({ blob, filename } = await documentApi.generateIndex(
          {
            court: idxCourt.trim() ? idxCourt.split('\n').map((l) => l.trim()).filter(Boolean) : [],
            caseLines: idxCaseLine.trim() ? [idxCaseLine.trim()] : [],
            matters: [],
            indexTitle: 'INDEX',
            rows,
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

      // 3) Bookmarks — written last so destinations are final. Each row's
      // bookmark jumps to the FIRST page of its range, shifted by the index.
      if (doBookmarks) {
        const headings: BookmarkHeading[] = [];
        if (indexOffset > 0) {
          headings.push({ title: 'Index', level: 1, page: 1, confidence: 1, source: 'user_created' });
        }
        // Rows are in STAMPED numbering; the PDF's physical page is that
        // plus the unstamped front pages, plus whatever the index prepended.
        const skip = safeIndexEnd();
        for (const r of ctFinal) {
          const p = firstPageOf(r.pages);
          if (p === null) continue; // no parseable page — index-only row
          headings.push({
            title: r.title.trim(),
            level: 1,
            page: p + skip + indexOffset,
            confidence: 1,
            source: 'user_created',
          });
        }
        if (headings.length > 0) {
          const bmFile = new File([blob], filename, { type: 'application/pdf' });
          ({ blob, filename } = await documentApi.applyBookmarks(bmFile, headings));
        }
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
    { label: 'Contents', active: step === 'contents', done: furthest > 4 && step !== 'contents', reachable: !!numberedBlob },
    { label: 'Signatures', active: step === 'sigs', done: furthest > 5 && step !== 'sigs', reachable: !!numberedBlob },
    { label: 'Special Pages', active: step === 'special', done: furthest > 6 && step !== 'special', reachable: !!numberedBlob },
    { label: 'Review', active: step === 'review' || step === 'processing', done: step === 'done', reachable: !!numberedBlob },
  ];

  // Going back to pages/annexures invalidates everything built on the
  // numbered PDF (contents suggestions were detected on it).
  const invalidateNumbered = () => {
    setNumberedBlob(null);
    setNumberedFilename('');
    setNumberedTotalPages(null);
    setCtRows([]);
    setCtLoaded(false);
  };

  const jumpToStep = (idx: number) => {
    if (isBusy) return;
    const targets: Step[] = ['main', 'annex', 'preview', 'contents', 'sigs', 'special', 'review'];
    const target = targets[idx];
    if (!target) return;
    // Can't jump past preview without having a numbered PDF.
    if (idx >= 2 && !numberedBlob) return;
    if (idx <= 1 && numberedBlob) invalidateNumbered();
    setStep(target);
  };

  // ── Summary helpers ──
  const sigSummary = [clientSig && 'client', clientSig2 && 'client 2', advocateSig && 'advocate']
    .filter(Boolean).join(' + ');
  const specialSigSummary = [
    specialClientSig && 'client',
    specialClientSig2 && 'client 2',
    specialAdvocateSig && 'advocate',
  ].filter(Boolean).join(' + ');
  const specialActive = Boolean(
    signPages.trim() && (specialClientSig || specialClientSig2 || specialAdvocateSig),
  );
  const hasSigs = !!(clientSig || clientSig2 || advocateSig || specialActive);

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
              <button type="button" className="er__btn er__btn--primary" onClick={() => goTo('contents')}>
                Next: Contents →
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

        {/* ── Step: Contents — ONE list drives the Master Index AND bookmarks ── */}
        {step === 'contents' && (
          <section className="er__upload-section">
            <p className="er__annex-prompt-hint">
              List your document&apos;s contents once — title + page range (in stamped numbering).
              We use this ONE list for both the <strong>Master Index page</strong> (added at the
              front) and the <strong>clickable bookmarks</strong> in the PDF sidebar. We&apos;ve
              pre-filled suggestions from your document — fix the wording to your filing language,
              set ranges, add what&apos;s missing. Optional: skip if not needed.
            </p>

            <div className={ctPreviewUrl ? 'er__ct-split' : undefined}>
            <div className="er__ct-form">
            {ctLoading && (
              <div className="er__processing">
                <div className="er__spinner" />
                <p className="er__processing-text">
                  Scanning your document for suggestions… you can skip ahead any time.
                </p>
              </div>
            )}

            {!ctLoading && ctLoaded && (
              <>
                {ctRows.length === 0 && (
                  <p className="er__annex-prompt-hint">
                    No headings detected (common with scanned documents) — type the rows manually
                    below, or skip.
                  </p>
                )}
                <div className="er__bm-list">
                  {ctRows.map((r, i) => (
                    <div key={r.id} className="er__bm-row">
                      <span className="er__idx-num">{i + 1}.</span>
                      <input
                        type="text"
                        className="er__bm-title"
                        value={r.title}
                        placeholder="Particulars (e.g. Annexure A-1: Impugned order dated …)"
                        onChange={(e) => patchCtRow(r.id, { title: e.target.value })}
                      />
                      <label className="er__bm-pg">
                        Pg
                        <input
                          type="text"
                          value={r.pages}
                          placeholder="5 or 5-7"
                          onChange={(e) => patchCtRow(r.id, { pages: e.target.value })}
                        />
                      </label>
                      <button
                        type="button"
                        className="er__bm-delete"
                        onClick={() => removeCtRow(r.id)}
                        aria-label="Delete row"
                      >
                        ✗
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className="er__btn er__btn--outline" onClick={addCtRow}>
                  + Add Row
                </button>

                <div className="er__ct-outputs">
                  <label className="er__idx-toggle">
                    <input
                      type="checkbox"
                      checked={wantIndex}
                      onChange={(e) => setWantIndex(e.target.checked)}
                    />
                    Add a Master Index page at the front
                  </label>
                  <label className="er__idx-toggle">
                    <input
                      type="checkbox"
                      checked={wantBookmarks}
                      onChange={(e) => setWantBookmarks(e.target.checked)}
                    />
                    Add clickable bookmarks in the PDF sidebar
                  </label>
                </div>

                {wantIndex && ctFinal.length > 0 && (
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
                )}
              </>
            )}
            </div>

            {ctPreviewUrl && (
              <div className="er__ct-preview">
                <div className="er__preview er__ct-preview-box">
                  <iframe
                    src={`${ctPreviewUrl}#toolbar=1&navpanes=0`}
                    title="Numbered document preview"
                    className="er__preview-frame"
                  />
                </div>
              </div>
            )}
            </div>

            <div className="er__annex-prompt-actions">
              <button type="button" className="er__btn er__btn--primary" onClick={() => goTo('sigs')}>
                {ctLoading && 'Skip suggestions →'}
                {!ctLoading && (ctFinal.length > 0 && (doIndex || doBookmarks)
                  ? `Next: Signatures (${ctFinal.length} row${ctFinal.length === 1 ? '' : 's'}) →`
                  : 'Skip contents →')}
              </button>
              <button type="button" className="er__btn er__btn--outline" onClick={() => setStep('preview')}>
                ← Back to Preview
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
              clientSig2={clientSig2}
              client2InputRef={clientSig2InputRef}
              onClient2Change={setClientSig2}
              onSubmit={() => goTo('special')}
              onCancel={() => goTo('special')}
              hideSubmit
              hideCancel
            />
            <div className="er__annex-prompt-actions">
              <button type="button" className="er__btn er__btn--primary" onClick={() => goTo('special')}>
                {clientSig || clientSig2 || advocateSig ? 'Next: Special Pages →' : 'Skip signatures →'}
              </button>
              <button type="button" className="er__btn er__btn--outline" onClick={() => setStep('contents')}>
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
              clientSig2={specialClientSig2}
              client2InputRef={specialClientSig2InputRef}
              onClient2Change={setSpecialClientSig2}
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
              <li className={`er__cart-row ${!(doIndex || doBookmarks) ? 'er__cart-row--skip' : ''}`}>
                <span className="er__cart-what">☰ Contents</span>
                <span className="er__cart-detail">
                  {doIndex || doBookmarks
                    ? `${ctFinal.length} row${ctFinal.length === 1 ? '' : 's'} → ${[
                        doIndex && 'Master Index at the front',
                        doBookmarks && 'clickable bookmarks',
                      ].filter(Boolean).join(' + ')}`
                    : 'skipped'}
                </span>
                <button type="button" className="er__cart-edit" onClick={() => setStep('contents')}
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
                  {hasSigs || doIndex || doBookmarks ? 'Finish & Download' : 'Download'}
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
                {doBookmarks && `, ${ctFinal.length} bookmarks`}
                {doIndex && ', master index'}
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
