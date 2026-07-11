import { useEffect, useMemo } from 'react';
import '../styles/ResultPreview.css';

/**
 * Post-processing result panel: shows the generated PDF inline (blob URL in
 * an iframe — nothing is uploaded or stored anywhere, the document only
 * lives in the browser's memory) so the user can check the output BEFORE
 * downloading. Wrong result → Start Over without re-uploading anything.
 */
interface Props {
  blob: Blob;
  filename: string;
  /** Headline above the preview, e.g. "✓ Numbered PDF ready." */
  message: string;
  onReset: () => void;
  resetLabel?: string;
}

export default function ResultPreview({ blob, filename, message, onReset, resetLabel = 'Start Another' }: Props) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

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
      </div>
    </section>
  );
}
