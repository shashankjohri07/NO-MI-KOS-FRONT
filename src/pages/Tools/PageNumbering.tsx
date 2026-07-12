import { useEffect, useState } from 'react';
import { documentApi, trackTool } from '../../services/documentApi';
import { friendlyError } from '../../services/friendlyError';
import { gateTool } from '../../services/billingApi';
import { countTotalPages } from '../../services/pdfInfo';
import PlanBanner from '../../components/PlanBanner';
import ToolNote from '../../components/ToolNote';
import MainFileStep from '../ErrorReport/MainFileStep';
import ProcessingPanel from '../../components/ProcessingPanel';
import ResultPreview from '../../components/ResultPreview';
import { useChainedIntake } from '../../services/toolChain';
import { useFileList } from '../ErrorReport/useFileList';
import '../../styles/ErrorReport.css';

// No hard cap — transport-layer limits (multer/nginx) still apply.

export default function PageNumberingTool() {
  const main = useFileList();
  const [indexEndPage, setIndexEndPage] = useState('');
  const [phase, setPhase] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [totalPages, setTotalPages] = useState<number | null>(null);

  useEffect(() => {
    documentApi.warmUp();
  }, []);

  // Real page count so the index input can't exceed the document.
  useEffect(() => {
    let cancelled = false;
    if (main.files.length === 0) {
      setTotalPages(null);
      return;
    }
    countTotalPages(main.files).then((n) => {
      if (!cancelled) setTotalPages(n);
    });
    return () => { cancelled = true; };
  }, [main.files]);

  const chainedFrom = useChainedIntake(main.add);

  const safeIndexEnd = () => {
    const n = Number.parseInt(indexEndPage, 10);
    if (!Number.isFinite(n) || n < 0) return 0;
    return totalPages !== null ? Math.min(n, totalPages) : n;
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
      const block = await gateTool('page-numbering');
      if (block) {
        setErrorMsg(block);
        setPhase('error');
        return;
      }
      const { blob, filename } = await documentApi.writePagination(main.files, safeIndexEnd());
      setResult({ blob, filename });
      trackTool('page-numbering');
      setPhase('done');
    } catch (err: unknown) {
      setErrorMsg(friendlyError(err, 'Could not number this document.'));
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

        <PlanBanner />

        <ToolNote>
          Numbers are stamped <strong>top-right of every page</strong> after your chosen index
          pages. Your original file stays untouched — you always download a new copy.
        </ToolNote>

        {(phase === 'idle' || phase === 'processing') && (
          <section className="er__upload-section">
            {chainedFrom && (
              <p className="rp__chip">✓ Document carried over from {chainedFrom} — ready to go.</p>
            )}
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
              maxPages={totalPages}
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
            summary={[
              `${main.files.length} volume${main.files.length === 1 ? '' : 's'} merged`,
              safeIndexEnd() > 0
                ? `pages 1–${safeIndexEnd()} (index) left unnumbered`
                : 'numbered from page 1',
            ]}
            producedBy="Page Numbering"
            nextSteps={[
              { label: 'Add Annexures', to: '/tools/annexures' },
              { label: 'Stamp Signatures', to: '/tools/signatures' },
              { label: 'Add Bookmarks', to: '/tools/bookmarks' },
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
