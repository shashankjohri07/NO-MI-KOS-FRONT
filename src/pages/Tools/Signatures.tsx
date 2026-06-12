import { useEffect, useRef, useState } from 'react';
import { documentApi, trackTool } from '../../services/documentApi';
import MainFileStep from '../ErrorReport/MainFileStep';
import AnnexPickStep from '../ErrorReport/AnnexPickStep';
import SigPickStep from '../ErrorReport/SigPickStep';
import { useFileList } from '../ErrorReport/useFileList';
import '../../styles/ErrorReport.css';

// No hard caps — transport-layer limits (multer/nginx) still apply.

export default function SignaturesTool() {
  const main = useFileList();
  const annex = useFileList();
  const [clientSig, setClientSig] = useState<File | null>(null);
  const [advocateSig, setAdvocateSig] = useState<File | null>(null);
  const [signPages, setSignPages] = useState<string>('');
  const [indexEndPage, setIndexEndPage] = useState('');
  const [phase, setPhase] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const elapsedRef = useRef<number | null>(null);
  const clientSigInputRef = useRef<HTMLInputElement>(null);
  const advocateSigInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    documentApi.warmUp();
  }, []);

  useEffect(() => {
    if (phase !== 'processing') {
      setElapsedSeconds(0);
      if (elapsedRef.current) window.clearInterval(elapsedRef.current);
      return;
    }
    elapsedRef.current = window.setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => {
      if (elapsedRef.current) window.clearInterval(elapsedRef.current);
    };
  }, [phase]);

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

  const reset = () => {
    main.reset();
    annex.reset();
    setClientSig(null);
    setAdvocateSig(null);
    setSignPages('');
    setIndexEndPage('');
    setPhase('idle');
    setErrorMsg('');
    if (clientSigInputRef.current) clientSigInputRef.current.value = '';
    if (advocateSigInputRef.current) advocateSigInputRef.current.value = '';
  };

  const submit = async () => {
    if (main.files.length === 0 || annex.files.length === 0) return;
    if (!clientSig && !advocateSig) return;
    setErrorMsg('');
    setPhase('processing');
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
      trackTool('signatures');
      setPhase('done');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to process document');
      setPhase('error');
    }
  };

  return (
    <div className="er">
      <div className="er__container">
        <header className="er__header">
          <h1 className="er__title">Signatures</h1>
          <p className="er__subtitle">
            Upload main document, annexures, and signature images. The complete pipeline runs in
            one shot: number → merge annexures → stamp client/advocate signatures on every
            annexure page.
          </p>
        </header>

        {(phase === 'idle' || phase === 'processing') && (
          <>
            <section className="er__upload-section">
              <h2 className="er__section-heading">Main document</h2>
              <MainFileStep
                files={main.files}
                inputRef={main.inputRef}
                onAdd={main.add}
                onMove={main.move}
                onRemove={main.remove}
                indexEndPage={indexEndPage}
                setIndexEndPage={setIndexEndPage}
                onSubmit={submit}
                isProcessing={phase === 'processing'}
                hideSubmit
              />
            </section>

            {main.files.length > 0 && (
              <section className="er__upload-section">
                <h2 className="er__section-heading">Annexures</h2>
                <AnnexPickStep
                  files={annex.files}
                  inputRef={annex.inputRef}
                  onAdd={annex.add}
                  onMove={annex.move}
                  onRemove={annex.remove}
                  onSubmit={submit}
                  onCancel={reset}
                  hideSubmit
                  hideCancel
                />
              </section>
            )}

            {main.files.length > 0 && annex.files.length > 0 && (
              <section className="er__upload-section">
                <h2 className="er__section-heading">Signatures</h2>
                <SigPickStep
                  clientSig={clientSig}
                  advocateSig={advocateSig}
                  clientInputRef={clientSigInputRef}
                  advocateInputRef={advocateSigInputRef}
                  onClientChange={setClientSig}
                  onAdvocateChange={setAdvocateSig}
                  signPages={signPages}
                  onSignPagesChange={setSignPages}
                  onSubmit={submit}
                  onCancel={reset}
                />
              </section>
            )}

            {phase === 'processing' && (
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
          </>
        )}

        {phase === 'done' && (
          <section className="er__upload-section">
            <div className="er__annex-prompt">
              <p className="er__annex-prompt-title">✓ Final PDF downloaded with signatures.</p>
              <button type="button" className="er__btn er__btn--primary" onClick={reset}>
                Start Another
              </button>
            </div>
          </section>
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
