import { useEffect, useRef, useState } from 'react';
import { documentApi } from '../../services/documentApi';
import Breadcrumb, { type BreadcrumbStep } from '../../components/Breadcrumb';
import '../../styles/ErrorReport.css';
import MainFileStep from './MainFileStep';
import AnnexPickStep from './AnnexPickStep';
import SigPickStep from './SigPickStep';
import { useFileList } from './useFileList';

// Workflow states. Three optional passes — main only, +annexures, +signatures.
type Step =
  | 'pick-main'
  | 'processing'
  | 'annex-ask'
  | 'pick-annex'
  | 'sig-ask'
  | 'pick-sig'
  | 'done'
  | 'error';

// No hard cap on main volumes or annexures — court filings vary
// widely in size, and the multer/nginx limits already gate the upload
// at the transport layer.

// Which logical step (1/2/3) each internal state belongs to.
function stepIndex(s: Step): 1 | 2 | 3 | 4 {
  switch (s) {
    case 'pick-main':
    case 'processing':
    case 'error':
      return 1;
    case 'annex-ask':
    case 'pick-annex':
      return 2;
    case 'sig-ask':
    case 'pick-sig':
      return 3;
    case 'done':
      return 4;
  }
}

export default function ErrorReport() {
  const main = useFileList();
  const annex = useFileList();

  const [clientSig, setClientSig] = useState<File | null>(null);
  const [advocateSig, setAdvocateSig] = useState<File | null>(null);
  // Optional comma+range spec ("1, 3-5, 8") of additional MAIN pages to
  // also sign. Empty string = use the default behaviour (annexures only).
  const [signPages, setSignPages] = useState<string>('');
  const [indexEndPage, setIndexEndPage] = useState<string>('');
  const [step, setStep] = useState<Step>('pick-main');
  const [errorMsg, setErrorMsg] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  // Highest step the user has progressed past. Used by the breadcrumb to mark
  // earlier nodes as "done" even after the user navigates back via the crumb.
  const [furthestStep, setFurthestStep] = useState<1 | 2 | 3 | 4>(1);

  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [pendingFilename, setPendingFilename] = useState<string>('');

  const clientSigInputRef = useRef<HTMLInputElement>(null);
  const advocateSigInputRef = useRef<HTMLInputElement>(null);

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

  const bumpFurthest = (to: 2 | 3 | 4) => {
    setFurthestStep((curr) => (to > curr ? to : curr));
  };

  const handleReset = () => {
    main.reset();
    annex.reset();
    setClientSig(null);
    setAdvocateSig(null);
    setSignPages('');
    setIndexEndPage('');
    setStep('pick-main');
    setErrorMsg('');
    setPendingBlob(null);
    setPendingFilename('');
    setFurthestStep(1);
    if (clientSigInputRef.current) clientSigInputRef.current.value = '';
    if (advocateSigInputRef.current) advocateSigInputRef.current.value = '';
  };

  const downloadAndFinish = () => {
    if (pendingBlob) triggerDownload(pendingBlob, pendingFilename);
    handleReset();
  };

  const jumpToStep = (i: number) => {
    if (i === 0) setStep('pick-main');
    else if (i === 1) setStep('pick-annex');
    else if (i === 2) setStep('pick-sig');
  };

  const submitMainOnly = async () => {
    if (main.files.length === 0) return;
    setErrorMsg('');
    setStep('processing');
    try {
      const { blob, filename } = await documentApi.writePagination(main.files, safeIndexEnd());
      setPendingBlob(blob);
      setPendingFilename(filename);
      bumpFurthest(2);
      setStep('annex-ask');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to process document');
      setStep('error');
    }
  };

  const submitWithAnnexures = async () => {
    if (main.files.length === 0 || annex.files.length === 0) return;
    setErrorMsg('');
    setStep('processing');
    try {
      const { blob, filename } = await documentApi.writePagination(
        main.files,
        safeIndexEnd(),
        annex.files
      );
      setPendingBlob(blob);
      setPendingFilename(filename);
      bumpFurthest(3);
      setStep('sig-ask');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to process document');
      setStep('error');
    }
  };

  const submitWithSignatures = async () => {
    if (main.files.length === 0 || annex.files.length === 0) return;
    if (!clientSig && !advocateSig) return;
    setErrorMsg('');
    setStep('processing');
    try {
      const { blob, filename } = await documentApi.writePagination(
        main.files,
        safeIndexEnd(),
        annex.files,
        { client: clientSig, advocate: advocateSig },
        undefined,
        signPages
      );
      triggerDownload(blob, filename);
      setPendingBlob(null);
      setPendingFilename('');
      bumpFurthest(4);
      setStep('done');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to process document');
      setStep('error');
    }
  };

  const current = stepIndex(step);
  const crumbs: BreadcrumbStep[] = [
    {
      label: 'Page Numbering',
      active: current === 1,
      done: furthestStep > 1 && current !== 1,
      reachable: true,
    },
    {
      label: 'Annexures',
      active: current === 2,
      done: furthestStep > 2 && current !== 2,
      reachable: main.files.length > 0,
    },
    {
      label: 'Signatures',
      active: current === 3,
      done: furthestStep > 3 && current !== 3,
      reachable: main.files.length > 0 && annex.files.length > 0,
    },
  ];

  return (
    <div className="er">
      <div className="er__container">
        <header className="er__header">
          <h1 className="er__title">Document Prep</h1>
          <p className="er__subtitle">
            Three-stage filing prep: number pages, merge annexures, stamp signatures. Skip what you
            don&apos;t need — the breadcrumb above lets you jump between stages.
          </p>
        </header>

        <Breadcrumb steps={crumbs} onJump={jumpToStep} />

        {(step === 'pick-main' || step === 'processing') && (
          <section className="er__upload-section">
            <MainFileStep
              files={main.files}
              inputRef={main.inputRef}
              onAdd={main.add}
              onMove={main.move}
              onRemove={main.remove}
              indexEndPage={indexEndPage}
              setIndexEndPage={setIndexEndPage}
              onSubmit={submitMainOnly}
              isProcessing={step === 'processing'}
            />

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

        {step === 'annex-ask' && (
          <section className="er__upload-section">
            <div className="er__annex-prompt">
              <p className="er__annex-prompt-title">
                ✓ Numbered PDF is ready. Would you like to merge annexures as well?
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
                  Yes, upload annexures
                </button>
                <button
                  type="button"
                  className="er__btn er__btn--outline"
                  onClick={downloadAndFinish}
                >
                  No — download &amp; done
                </button>
              </div>
            </div>
          </section>
        )}

        {step === 'pick-annex' && (
          <section className="er__upload-section">
            <AnnexPickStep
              files={annex.files}
              inputRef={annex.inputRef}
              onAdd={annex.add}
              onMove={annex.move}
              onRemove={annex.remove}
              onSubmit={submitWithAnnexures}
              onCancel={handleReset}
            />
          </section>
        )}

        {step === 'sig-ask' && (
          <section className="er__upload-section">
            <div className="er__annex-prompt">
              <p className="er__annex-prompt-title">
                ✓ Annexure-merged PDF is ready. Would you like to integrate signatures as well?
              </p>
              <p className="er__annex-prompt-hint">
                If yes, upload PNG/JPG files of the client and advocate signatures. They&apos;ll
                be stamped in the footer of every annexure page — client on the left, advocate on
                the right. Existing text on the page is detected; signatures are nudged up
                automatically so nothing visible gets covered.
              </p>
              <div className="er__annex-prompt-actions">
                <button
                  type="button"
                  className="er__btn er__btn--primary"
                  onClick={() => setStep('pick-sig')}
                >
                  Yes, upload signatures
                </button>
                <button
                  type="button"
                  className="er__btn er__btn--outline"
                  onClick={downloadAndFinish}
                >
                  No — download &amp; done
                </button>
              </div>
            </div>
          </section>
        )}

        {step === 'pick-sig' && (
          <section className="er__upload-section">
            <SigPickStep
              clientSig={clientSig}
              advocateSig={advocateSig}
              clientInputRef={clientSigInputRef}
              advocateInputRef={advocateSigInputRef}
              onClientChange={setClientSig}
              onAdvocateChange={setAdvocateSig}
              signPages={signPages}
              onSignPagesChange={setSignPages}
              onSubmit={submitWithSignatures}
              onCancel={handleReset}
            />
          </section>
        )}

        {step === 'done' && (
          <section className="er__upload-section">
            <div className="er__annex-prompt">
              <p className="er__annex-prompt-title">
                ✓ Final PDF downloaded with {annex.files.length} annexure
                {annex.files.length === 1 ? '' : 's'}
                {clientSig || advocateSig ? ' + signatures' : ''}.
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
