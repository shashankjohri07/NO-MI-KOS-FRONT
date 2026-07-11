import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { setChainedDoc } from '../services/toolChain';
import '../styles/ResultPreview.css';

/**
 * Post-processing result panel: shows the generated PDF inline (blob URL in
 * an iframe — nothing is uploaded or stored anywhere, the document only
 * lives in the browser's memory) so the user can check the output BEFORE
 * downloading. Wrong result → Start Over without re-uploading anything.
 */
interface NextStep {
  label: string;
  to: string;
}

interface Props {
  blob: Blob;
  filename: string;
  /** Headline above the preview, e.g. "✓ Numbered PDF ready." */
  message: string;
  onReset: () => void;
  resetLabel?: string;
  /** Human name of the tool that produced this result (for hand-off notices). */
  producedBy?: string;
  /** Offer to carry this output straight into other tools — the file is
   * handed over in browser memory only, never re-uploaded or stored. */
  nextSteps?: NextStep[];
  /** What was actually done — short facts shown under the headline,
   * e.g. ["3 volumes merged", "4 annexures stamped"]. */
  summary?: string[];
}

export default function ResultPreview({
  blob,
  filename,
  message,
  onReset,
  resetLabel = 'Start Another',
  producedBy,
  nextSteps,
  summary,
}: Props) {
  const navigate = useNavigate();
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const continueTo = (step: NextStep) => {
    setChainedDoc(blob, filename, producedBy || 'previous tool');
    navigate(step.to);
  };

  const download = () => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  return (
    <section className="er__upload-section">
      <div className="rp">
        <p className="rp__title">{message}</p>
        {summary && summary.length > 0 && (
          <ul className="rp__summary">
            {[
              ...summary,
              blob.size >= 1024 * 1024
                ? `${(blob.size / 1024 / 1024).toFixed(2)} MB output`
                : `${Math.max(1, Math.round(blob.size / 1024))} KB output`,
            ].map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        )}
        <p className="rp__hint">
          Check the preview below — the file downloads only when you're happy with it.
        </p>
        <iframe className="rp__frame" src={url} title="Result preview" />
        <div className="rp__actions">
          <button type="button" className="er__btn er__btn--primary" onClick={download}>
            ⬇ Download PDF
          </button>
          <button type="button" className="er__btn er__btn--outline" onClick={onReset}>
            {resetLabel}
          </button>
        </div>
        <p className="rp__filename">{filename}</p>
        {nextSteps && nextSteps.length > 0 && (
          <div className="rp__next">
            <p className="rp__next-label">Continue with this document — no re-upload needed:</p>
            <div className="rp__next-btns">
              {nextSteps.map((s) => (
                <button
                  key={s.to}
                  type="button"
                  className="er__btn er__btn--outline"
                  onClick={() => continueTo(s)}
                >
                  {s.label} →
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
