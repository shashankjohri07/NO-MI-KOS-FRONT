import { useEffect, useState } from 'react';
import { documentApi, trackTool } from '../../services/documentApi';
import MainFileStep from '../ErrorReport/MainFileStep';
import ProcessingPanel from '../../components/ProcessingPanel';
import ResultPreview from '../../components/ResultPreview';
import { useFileList } from '../ErrorReport/useFileList';
import '../../styles/ErrorReport.css';

// No hard cap — transport-layer limits (multer/nginx) still apply.

export default function PageNumberingTool() {
  const main = useFileList();
  const [indexEndPage, setIndexEndPage] = useState('');
  const [phase, setPhase] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    documentApi.warmUp();
  }, []);

  const safeIndexEnd = () => {
    const n = Number.parseInt(indexEndPage, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const reset = () => {
    main.reset();
    setIndexEndPage('');
    setResult(null);
    setPhase('idle');
    setErrorMsg('');
  };

  const submit = async () => {
    if (main.files.length === 0) return;
    setErrorMsg('');
    setPhase('processing');
    try {
      const { blob, filename } = await documentApi.writePagination(main.files, safeIndexEnd());
      setResult({ blob, filename });
      trackTool('page-numbering');
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

            {phase === 'processing' && <ProcessingPanel label="Stamping page numbers" />}
          </section>
        )}

        {phase === 'done' && result && (
          <ResultPreview
            blob={result.blob}
            filename={result.filename}
            message="✓ Numbered PDF ready."
            onReset={reset}
            resetLabel="Number Another"
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
