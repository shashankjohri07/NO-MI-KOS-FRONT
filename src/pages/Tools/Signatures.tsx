import { useEffect, useMemo, useRef, useState } from 'react';
import { documentApi, trackTool } from '../../services/documentApi';
import { friendlyError } from '../../services/friendlyError';
import { gateTool } from '../../services/billingApi';
import PlanBanner from '../../components/PlanBanner';
import Dropzone from '../ErrorReport/Dropzone';
import FileList from '../ErrorReport/FileList';
import { useFileList } from '../ErrorReport/useFileList';
import { parsePageSpec, formatPageSet } from '../ErrorReport/pageSpec';
import ProcessingPanel from '../../components/ProcessingPanel';
import ResultPreview from '../../components/ResultPreview';
import { useChainedIntake } from '../../services/toolChain';
import '../../styles/ErrorReport.css';

export default function SignaturesTool() {
  const doc = useFileList();
  const [clientSig, setClientSig] = useState<File | null>(null);
  const [advocateSig, setAdvocateSig] = useState<File | null>(null);
  const [signPages, setSignPages] = useState('');
  const [phase, setPhase] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const clientRef = useRef<HTMLInputElement>(null);
  const advocateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    documentApi.warmUp();
  }, []);

  const chainedFrom = useChainedIntake(doc.add);

  const pagePreview = useMemo(() => {
    const trimmed = signPages.trim();
    if (!trimmed) return { kind: 'empty' as const };
    try {
      const set = parsePageSpec(trimmed);
      if (set.size === 0) return { kind: 'empty' as const };
      return { kind: 'ok' as const, label: formatPageSet(set), count: set.size };
    } catch (e) {
      return { kind: 'error' as const, message: e instanceof Error ? e.message : 'Invalid format' };
    }
  }, [signPages]);

  const reset = () => {
    doc.reset();
    setClientSig(null);
    setAdvocateSig(null);
    setSignPages('');
    setResult(null);
    setPhase('idle');
    setErrorMsg('');
    if (clientRef.current) clientRef.current.value = '';
    if (advocateRef.current) advocateRef.current.value = '';
  };

  const hasSig = !!clientSig || !!advocateSig;
  const pagesValid = signPages.trim() === '' || pagePreview.kind === 'ok';
  const canSubmit = doc.files.length > 0 && hasSig && pagesValid;

  const submit = async () => {
    if (!canSubmit) return;
    setErrorMsg('');
    setPhase('processing');
    try {
      const block = await gateTool('signatures');
      if (block) {
        setErrorMsg(block);
        setPhase('error');
        return;
      }
      const { blob, filename } = await documentApi.writePagination(
        doc.files,
        0,
        [],
        undefined,
        undefined,
        signPages.trim() || undefined,
        { client: clientSig, advocate: advocateSig },
      );
      setResult({ blob, filename });
      trackTool('signatures');
      setPhase('done');
    } catch (err: unknown) {
      setErrorMsg(friendlyError(err, 'Could not stamp the signatures.'));
      setPhase('error');
    }
  };

  return (
    <div className="er">
      <div className="er__container">
        <header className="er__header">
          <h1 className="er__title">Signatures</h1>
          <p className="er__subtitle">
            Upload your document, choose which pages to sign, and provide signature images.
          </p>
        </header>

        <PlanBanner />

        {(phase === 'idle' || phase === 'processing') && (
          <>
            <section className="er__upload-section">
              <h2 className="er__section-heading">Document</h2>
              {chainedFrom && (
                <p className="rp__chip">✓ Document carried over from {chainedFrom} — ready to go.</p>
              )}
              <Dropzone
                inputId="sig-doc-upload"
                inputRef={doc.inputRef}
                hasFiles={doc.files.length > 0}
                mainText={doc.files.length ? 'Add another volume' : 'Drop your PDF here or click to browse'}
                hintText={doc.files.length ? 'Files are merged in order' : 'Upload one or multiple PDFs — up to 100MB each'}
                onAdd={doc.add}
              />
              {doc.files.length > 0 && (
                <FileList
                  files={doc.files}
                  rowLabel={(i) => `Vol ${i + 1}`}
                  onMove={doc.move}
                  onRemove={doc.remove}
                  disabled={phase === 'processing'}
                />
              )}
            </section>

            <section className="er__upload-section">
              <h2 className="er__section-heading">Pages to sign</h2>
              <div className="er__sig-extra">
                <input
                  id="sig-pages"
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  spellCheck={false}
                  className="er__sig-extra-input"
                  placeholder="e.g. 1, 3-5, 8  — leave blank to sign all pages"
                  value={signPages}
                  onChange={(e) => setSignPages(e.target.value)}
                />
                <p className="er__sig-extra-hint">
                  Comma-separated page numbers and ranges. Leave blank to stamp every page.
                </p>
                {pagePreview.kind === 'ok' && (
                  <p className="er__sig-extra-preview">
                    ✓ Will sign {pagePreview.count} page{pagePreview.count === 1 ? '' : 's'}: {pagePreview.label}
                  </p>
                )}
                {pagePreview.kind === 'error' && (
                  <p className="er__sig-extra-error">⚠ {pagePreview.message}</p>
                )}
              </div>
            </section>

            <section className="er__upload-section">
              <h2 className="er__section-heading">Signatures</h2>
              <div className="er__sig-grid">
                <div className="er__sig-slot">
                  <label className="er__sig-slot-label" htmlFor="sig-client">
                    Client Signature (PNG / JPG)
                  </label>
                  <input
                    ref={clientRef}
                    id="sig-client"
                    type="file"
                    accept="image/png,image/jpeg"
                    className="er__sig-slot-input"
                    onChange={(e) => setClientSig(e.target.files?.[0] ?? null)}
                  />
                  {clientSig && (
                    <p className="er__sig-slot-name">✓ {clientSig.name} ({(clientSig.size / 1024).toFixed(1)} KB)</p>
                  )}
                </div>
                <div className="er__sig-slot">
                  <label className="er__sig-slot-label" htmlFor="sig-advocate">
                    Advocate Signature (PNG / JPG)
                  </label>
                  <input
                    ref={advocateRef}
                    id="sig-advocate"
                    type="file"
                    accept="image/png,image/jpeg"
                    className="er__sig-slot-input"
                    onChange={(e) => setAdvocateSig(e.target.files?.[0] ?? null)}
                  />
                  {advocateSig && (
                    <p className="er__sig-slot-name">✓ {advocateSig.name} ({(advocateSig.size / 1024).toFixed(1)} KB)</p>
                  )}
                </div>
              </div>
              <p className="er__sig-hint">Upload at least one signature to continue.</p>
            </section>

            {canSubmit && phase !== 'processing' && (
              <button type="button" className="er__btn er__btn--primary" onClick={submit}>
                Stamp Signatures
              </button>
            )}

            {phase === 'processing' && <ProcessingPanel label="Stamping signatures" />}
          </>
        )}

        {phase === 'done' && result && (
          <ResultPreview
            blob={result.blob}
            filename={result.filename}
            message="✓ PDF ready with signatures."
            onReset={reset}
            summary={[
              [clientSig && 'client', advocateSig && 'advocate'].filter(Boolean).join(' + ') +
                ' signature stamped',
              signPages.trim() ? `on pages ${signPages.trim()}` : 'on every page',
            ]}
            producedBy="Signatures"
            nextSteps={[
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
