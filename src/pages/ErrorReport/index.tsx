import { useEffect, useMemo, useRef, useState } from 'react';
import { documentApi, trackTool } from '../../services/documentApi';
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
 * Document Prep — cart-style wizard. Every step only COLLECTS input
 * (nothing processes in between); the Review step shows the full order
 * and one click runs a single processing pass and downloads the result.
 * Skipping a step simply moves forward — earlier inputs are never lost.
 */
type Step = 'main' | 'annex' | 'sigs' | 'special' | 'review' | 'processing' | 'done' | 'error';

const STEP_ORDER: Step[] = ['main', 'annex', 'sigs', 'special', 'review'];

function stepIndex(s: Step): number {
  const i = STEP_ORDER.indexOf(s);
  return i === -1 ? STEP_ORDER.length - 1 : i; // processing/done/error → review slot
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
  // Real page count of the main volumes (null until parsed / unparseable).
  const [mainPages, setMainPages] = useState<number | null>(null);

  const clientSigInputRef = useRef<HTMLInputElement>(null);
  const advocateSigInputRef = useRef<HTMLInputElement>(null);
  const specialClientSigInputRef = useRef<HTMLInputElement>(null);
  const specialAdvocateSigInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step !== 'processing') {
      setElapsedSeconds(0);
      return;
    }
    const t = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [step]);

  useEffect(() => {
    documentApi.warmUp();
  }, []);

  // Count the main document's real pages whenever the file list changes so
  // page inputs can be capped at the actual document length.
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
    // Never beyond the document itself.
    return mainPages !== null ? Math.min(n, mainPages) : n;
  };

  // Highest stamped page number that can exist = real pages minus the
  // unnumbered index pages. Used to validate the special-pages spec.
  const maxStampedPage = mainPages !== null ? mainPages - safeIndexEnd() : null;

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

  const next = () => {
    const i = stepIndex(step);
    if (i < STEP_ORDER.length - 1) goTo(STEP_ORDER[i + 1]);
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

  // The single processing pass — everything the user queued, in one request.
  const processAll = async () => {
    if (main.files.length === 0) return;
    if (signPages.trim() && signPagesCheck.kind === 'error') return;
    setErrorMsg('');
    setStep('processing');
    try {
      const block = await gateTool('document-prep');
      if (block) {
        setErrorMsg(block);
        setStep('error');
        return;
      }
      const useSpecial = signPages.trim() && (specialClientSig || specialAdvocateSig);
      const { blob, filename } = await documentApi.writePagination(
        main.files,
        safeIndexEnd(),
        annex.files.length > 0 ? annex.files : [],
        clientSig || advocateSig ? { client: clientSig, advocate: advocateSig } : undefined,
        undefined,
        useSpecial ? signPages.trim() : undefined,
        useSpecial ? { client: specialClientSig, advocate: specialAdvocateSig } : undefined,
      );
      triggerDownload(blob, filename);
      trackTool('document-prep');
      setStep('done');
    } catch (err: unknown) {
      setErrorMsg(friendlyError(err, 'Failed to process document'));
      setStep('error');
    }
  };

  const current = stepIndex(step);
  const crumbs: BreadcrumbStep[] = [
    { label: 'Pages', active: step === 'main', done: furthest > 0 && step !== 'main', reachable: true },
    { label: 'Annexures', active: step === 'annex', done: furthest > 1 && step !== 'annex', reachable: main.files.length > 0 },
    { label: 'Signatures', active: step === 'sigs', done: furthest > 2 && step !== 'sigs', reachable: main.files.length > 0 },
    { label: 'Special Pages', active: step === 'special', done: furthest > 3 && step !== 'special', reachable: main.files.length > 0 },
    { label: 'Review', active: current === 4, done: step === 'done', reachable: main.files.length > 0 },
  ];

  const jumpToStep = (i: number) => {
    if (step === 'processing') return;
    if (i === 0) setStep('main');
    else if (main.files.length > 0) setStep(STEP_ORDER[i]);
  };

  // ── Review summary rows ──
  const sigSummary = [clientSig && 'client', advocateSig && 'advocate'].filter(Boolean).join(' + ');
  const specialSigSummary = [specialClientSig && 'client', specialAdvocateSig && 'advocate']
    .filter(Boolean).join(' + ');
  const specialActive = Boolean(signPages.trim() && (specialClientSig || specialAdvocateSig));

  return (
    <div className="er">
      <div className="er__container">
        <header className="er__header">
          <h1 className="er__title">Document Prep</h1>
          <p className="er__subtitle">
            Queue everything your filing needs — page numbers, annexures, signatures, special
            pages — then process it all in one go at the Review step.
          </p>
        </header>

        <PlanBanner />

        <ToolNote>
          Nothing is processed until you hit <strong>Process &amp; Download</strong> on the Review
          step — you can move between steps freely, skip what you don&apos;t need, and change your
          inputs any time before that. Your files are processed in memory and never stored.
        </ToolNote>

        <Breadcrumb steps={crumbs} onJump={jumpToStep} />

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
              onSubmit={next}
              isProcessing={false}
              hideSubmit
              maxPages={mainPages}
            />
            {main.files.length > 0 && (
              <div className="er__annex-prompt-actions">
                <button type="button" className="er__btn er__btn--primary" onClick={next}>
                  Next: Annexures →
                </button>
                <button type="button" className="er__btn er__btn--outline" onClick={() => goTo('review')}>
                  Skip to Review →
                </button>
              </div>
            )}
          </section>
        )}

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
              onSubmit={next}
              onCancel={next}
              hideSubmit
              hideCancel
            />
            <div className="er__annex-prompt-actions">
              <button type="button" className="er__btn er__btn--primary" onClick={next}>
                {annex.files.length > 0 ? 'Next: Signatures →' : 'Skip annexures →'}
              </button>
            </div>
          </section>
        )}

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
              onSubmit={next}
              onCancel={next}
              hideSubmit
              hideCancel
            />
            <div className="er__annex-prompt-actions">
              <button type="button" className="er__btn er__btn--primary" onClick={next}>
                {clientSig || advocateSig ? 'Next: Special Pages →' : 'Skip signatures →'}
              </button>
            </div>
          </section>
        )}

        {step === 'special' && (
          <section className="er__upload-section">
            <p className="er__annex-prompt-hint">
              Sign specific MAIN-document pages (vakalatnama, prayer page, affidavit…) with their
              own signature images. Page numbers refer to the <strong>stamped numbers</strong> the
              document will get{maxStampedPage !== null ? ` (1–${maxStampedPage})` : ''}. Optional.
            </p>
            <SpecialPageStep
              previewBlob={null}
              signPages={signPages}
              onSignPagesChange={setSignPages}
              clientSig={specialClientSig}
              advocateSig={specialAdvocateSig}
              clientInputRef={specialClientSigInputRef}
              advocateInputRef={specialAdvocateSigInputRef}
              onClientChange={setSpecialClientSig}
              onAdvocateChange={setSpecialAdvocateSig}
              onSubmit={next}
              onCancel={next}
              hideActions
              maxPage={maxStampedPage}
            />
            <div className="er__annex-prompt-actions">
              <button
                type="button"
                className="er__btn er__btn--primary"
                onClick={next}
                disabled={Boolean(signPages.trim()) && signPagesCheck.kind === 'error'}
              >
                {specialActive ? 'Next: Review →' : 'Skip special pages →'}
              </button>
            </div>
          </section>
        )}

        {(step === 'review' || step === 'processing') && (
          <section className="er__upload-section">
            <h2 className="er__section-heading">Review your order</h2>
            <ul className="er__cart">
              <li className="er__cart-row">
                <span className="er__cart-what">📄 Main document</span>
                <span className="er__cart-detail">
                  {main.files.length} volume{main.files.length === 1 ? '' : 's'}
                  {mainPages !== null && ` · ${mainPages} pages`}
                  {safeIndexEnd() > 0
                    ? ` · numbering starts after index page ${safeIndexEnd()}`
                    : ' · numbered from page 1'}
                </span>
                <button type="button" className="er__cart-edit" onClick={() => setStep('main')}
                        disabled={step === 'processing'}>Edit</button>
              </li>
              <li className={`er__cart-row ${annex.files.length === 0 ? 'er__cart-row--skip' : ''}`}>
                <span className="er__cart-what">📎 Annexures</span>
                <span className="er__cart-detail">
                  {annex.files.length > 0
                    ? `${annex.files.length} file${annex.files.length === 1 ? '' : 's'} → A-1…A-${annex.files.length}`
                    : 'skipped'}
                </span>
                <button type="button" className="er__cart-edit" onClick={() => setStep('annex')}
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
                  onClick={processAll}
                  disabled={main.files.length === 0 || (specialActive && signPagesCheck.kind === 'error')}
                >
                  Process &amp; Download
                </button>
                <button type="button" className="er__btn er__btn--outline" onClick={handleReset}>
                  Start Over
                </button>
              </div>
            )}

            {step === 'processing' && (
              <div className="er__processing">
                <div className="er__spinner" />
                <p className="er__processing-text">Processing your filing…</p>
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
              <button type="button" className="er__btn er__btn--outline" onClick={() => setStep('review')}>
                Back to Review
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
