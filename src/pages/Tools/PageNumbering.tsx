import { useEffect, useRef, useState } from 'react';
import { documentApi } from '../../services/documentApi';
import MainFileStep from '../ErrorReport/MainFileStep';
import { useFileList } from '../ErrorReport/useFileList';
import '../../styles/ErrorReport.css';

// No hard cap — transport-layer limits (multer/nginx) still apply.

export default function PageNumberingTool() {
  const main = useFileList();
  const [indexEndPage, setIndexEndPage] = useState('');
  const [phase, setPhase] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const elapsedRef = useRef<number | null>(null);

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
    setIndexEndPage('');
    setPhase('idle');
    setErrorMsg('');
  };

  const submit = async () => {
    if (main.files.length === 0) return;
    setErrorMsg('');
    setPhase('processing');
    try {
      const { blob, filename } = await documentApi.writePagination(main.files, safeIndexEnd());
      triggerDownload(blob, filename);
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
          <h1 className="er__title">Page Numbering</h1>
          <p className="er__subtitle">
            Upload one or more PDFs in order. Volumes are merged into a single document and
            sequential page numbers are stamped from page (index + 1) onwards.
          </p>
        </header>

        {(phase === 'idle' || phase === 'processing') && (
          <section className="er__upload-section">
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
            />

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
          </section>
        )}

        {phase === 'done' && (
          <section className="er__upload-section">
            <div className="er__annex-prompt">
              <p className="er__annex-prompt-title">✓ Numbered PDF downloaded.</p>
              <button type="button" className="er__btn er__btn--primary" onClick={reset}>
                Number Another
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
