import { useEffect, useRef, useState } from 'react';
import { documentApi, trackTool } from '../../services/documentApi';
import Dropzone from '../ErrorReport/Dropzone';
import FileList from '../ErrorReport/FileList';
import { useFileList } from '../ErrorReport/useFileList';
import '../../styles/ErrorReport.css';

export default function AnnexuresTool() {
  const main = useFileList();
  const annex = useFileList();
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

  const reset = () => {
    main.reset();
    annex.reset();
    setPhase('idle');
    setErrorMsg('');
  };

  const submit = async () => {
    if (main.files.length === 0 || annex.files.length === 0) return;
    setErrorMsg('');
    setPhase('processing');
    try {
      const { blob, filename } = await documentApi.writePagination(main.files, 0, annex.files);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      trackTool('annexures');
      setPhase('done');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to process document');
      setPhase('error');
    }
  };

  const canSubmit = main.files.length > 0 && annex.files.length > 0;

  return (
    <div className="er">
      <div className="er__container">
        <header className="er__header">
          <h1 className="er__title">Annexures</h1>
          <p className="er__subtitle">
            Upload your main document and annexure files. Each annexure gets stamped (A-1, A-2, …)
            and appended with continuous pagination.
          </p>
        </header>

        {(phase === 'idle' || phase === 'processing') && (
          <>
            <section className="er__upload-section">
              <h2 className="er__section-heading">Main document</h2>
              <Dropzone
                inputId="annex-main-upload"
                inputRef={main.inputRef}
                hasFiles={main.files.length > 0}
                mainText={main.files.length ? 'Add another volume' : 'Drop your PDFs here or click to browse'}
                hintText={main.files.length ? 'Files are merged in the order listed below' : 'Upload one or multiple PDFs — up to 100MB each'}
                onAdd={main.add}
              />
              {main.files.length > 0 && (
                <FileList
                  files={main.files}
                  rowLabel={(i) => `Vol ${i + 1}`}
                  onMove={main.move}
                  onRemove={main.remove}
                  disabled={phase === 'processing'}
                />
              )}
            </section>

            <section className="er__upload-section">
              <h2 className="er__section-heading">Annexures</h2>
              <Dropzone
                inputId="annex-annex-upload"
                inputRef={annex.inputRef}
                hasFiles={annex.files.length > 0}
                mainText={annex.files.length ? 'Add another annexure' : 'Drop annexure PDFs here'}
                hintText="File 1 → Annexure A-1, File 2 → Annexure A-2, … (in upload order)"
                onAdd={annex.add}
              />
              {annex.files.length > 0 && (
                <FileList
                  files={annex.files}
                  rowLabel={(i) => `A-${i + 1}`}
                  onMove={annex.move}
                  onRemove={annex.remove}
                  disabled={phase === 'processing'}
                />
              )}
            </section>

            {canSubmit && phase !== 'processing' && (
              <button type="button" className="er__btn er__btn--primary" onClick={submit}>
                Merge Annexures
              </button>
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
              <p className="er__annex-prompt-title">
                ✓ PDF downloaded with {annex.files.length} annexure{annex.files.length === 1 ? '' : 's'}.
              </p>
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
