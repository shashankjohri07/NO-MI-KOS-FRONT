import { useEffect, useRef, useState } from 'react';
import { documentApi } from '../../services/documentApi';
import '../../styles/ErrorReport.css';
import MainFileStep from './MainFileStep';
import AnnexPickStep from './AnnexPickStep';
import SigPickStep from './SigPickStep';
import { useFileList } from './useFileList';

// Workflow states. Three optional passes — main only, +annexures, +signatures.
//   pick-main   → user selects main volumes, sets index, hits submit
//   processing  → spinner during any backend call
//   annex-ask   → main PDF ready; ask about annexures
//   pick-annex  → annexure uploader visible
//   sig-ask     → annexure PDF ready; ask about signatures
//   pick-sig    → two file pickers (client + advocate sig)
//   done        → final PDF downloaded; reset prompt
//   error       → any failure; show retry
type Step =
  | 'pick-main'
  | 'processing'
  | 'annex-ask'
  | 'pick-annex'
  | 'sig-ask'
  | 'pick-sig'
  | 'done'
  | 'error';

const MAX_FILES = 5;
const MAX_ANNEXURES = 20;

export default function ErrorReport() {
  // Two file lists driven by the shared hook.
  const main = useFileList(MAX_FILES);
  const annex = useFileList(MAX_ANNEXURES);

  const [clientSig, setClientSig] = useState<File | null>(null);
  const [advocateSig, setAdvocateSig] = useState<File | null>(null);
  const [indexEndPage, setIndexEndPage] = useState<string>('');
  const [step, setStep] = useState<Step>('pick-main');
  const [errorMsg, setErrorMsg] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Latest processed PDF held in memory until the user decides to download.
  // Lets the user keep going through optional steps (annex → sig) without
  // a fresh download triggering on each pass; download fires only when
  // they explicitly opt out, hit the manual Download button, or finish
  // the last step.
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [pendingFilename, setPendingFilename] = useState<string>('');

  const clientSigInputRef = useRef<HTMLInputElement>(null);
  const advocateSigInputRef = useRef<HTMLInputElement>(null);

  // Elapsed-seconds counter while processing.
  useEffect(() => {
    if (step !== 'processing') {
      setElapsedSeconds(0);
      return;
    }
    const t = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [step]);

  // Keep-warm: ping backend on mount so the Render free dyno wakes up
  // while the user is still selecting files. Trims ~30s off the first
  // real submit when the dyno was sleeping.
  useEffect(() => {
    documentApi.warmUp();
  }, []);

  // --- helpers ----------------------------------------------------------
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

  const handleReset = () => {
    main.reset();
    annex.reset();
    setClientSig(null);
    setAdvocateSig(null);
    setIndexEndPage('');
    setStep('pick-main');
    setErrorMsg('');
    setPendingBlob(null);
    setPendingFilename('');
    if (clientSigInputRef.current) clientSigInputRef.current.value = '';
    if (advocateSigInputRef.current) advocateSigInputRef.current.value = '';
  };

  // "I'm done — give me the file now and reset." Used by the "Nahi"
  // buttons on the annex/sig prompts.
  const downloadAndFinish = () => {
    if (pendingBlob) triggerDownload(pendingBlob, pendingFilename);
    handleReset();
  };

  // --- submits ----------------------------------------------------------
  // None of these trigger a download. They stash the resulting Blob in
  // pendingBlob and advance to the next "ask" step. The user gets the
  // file when they opt out of the remaining steps. Last step (signatures)
  // auto-triggers because there is nothing left to ask after it.
  const submitMainOnly = async () => {
    if (main.files.length === 0) return;
    setErrorMsg('');
    setStep('processing');
    try {
      const { blob, filename } = await documentApi.writePagination(main.files, safeIndexEnd());
      setPendingBlob(blob);
      setPendingFilename(filename);
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
        { client: clientSig, advocate: advocateSig }
      );
      // Last step — fire the download right away since there's nothing
      // left to ask about.
      triggerDownload(blob, filename);
      setPendingBlob(null);
      setPendingFilename('');
      setStep('done');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to process document');
      setStep('error');
    }
  };

  return (
    <div className="er">
      <div className="er__container">
        <header className="er__header">
          <h1 className="er__title">Page Numbering</h1>
          <p className="er__subtitle">
            Upload one or more PDFs in order. Volumes are merged into a single document, any
            existing top-right page numbers are wiped, and fresh sequential numbers are stamped from
            page (index + 1) onwards — continuous across all volumes. Annexures and signatures can
            be merged in optional second and third steps.
          </p>
        </header>

        {/* === STEP 1: pick main files (also covers the processing spinner state) */}
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
              maxFiles={MAX_FILES}
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

        {/* === STEP 2: ask about annexures */}
        {step === 'annex-ask' && (
          <section className="er__upload-section">
            <div className="er__annex-prompt">
              <p className="er__annex-prompt-title">
                ✓ Numbered PDF ready. Annexures bhi merge karwane hai?
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
                  onClick={downloadAndFinish}
                >
                  Nahi — download &amp; done
                </button>
              </div>
            </div>
          </section>
        )}

        {/* === STEP 3: pick annexures */}
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
              maxAnnexures={MAX_ANNEXURES}
            />
          </section>
        )}

        {/* === STEP 4: ask about signatures */}
        {step === 'sig-ask' && (
          <section className="er__upload-section">
            <div className="er__annex-prompt">
              <p className="er__annex-prompt-title">
                ✓ Annexure-merged PDF ready. Signatures bhi integrate karwane hai?
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
                  Haan, signatures upload karu
                </button>
                <button
                  type="button"
                  className="er__btn er__btn--outline"
                  onClick={downloadAndFinish}
                >
                  Nahi — download &amp; done
                </button>
              </div>
            </div>
          </section>
        )}

        {/* === STEP 5: pick signatures */}
        {step === 'pick-sig' && (
          <section className="er__upload-section">
            <SigPickStep
              clientSig={clientSig}
              advocateSig={advocateSig}
              clientInputRef={clientSigInputRef}
              advocateInputRef={advocateSigInputRef}
              onClientChange={setClientSig}
              onAdvocateChange={setAdvocateSig}
              onSubmit={submitWithSignatures}
              onCancel={handleReset}
            />
          </section>
        )}

        {/* === STEP 6: done */}
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

        {/* === ERROR */}
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
