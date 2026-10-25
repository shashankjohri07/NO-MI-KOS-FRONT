import { useState } from 'react';
import '../styles/DownloadChoiceModal.css';

interface Props {
  /** Page count of the document, when known — caps the part count and is
   * shown to the user. Null when it couldn't be determined (e.g. a huge or
   * unusual PDF); splitting is still offered, just without the page hint. */
  pageCount: number | null;
  onClose: () => void;
  onDownloadFull: () => void;
  /** Called with a validated part count (2..pageCount, or 2..99 when the
   * page count is unknown). */
  onDownloadSplit: (parts: number) => void;
}

/** Asks whether to download the finished PDF as one file or split into N
 * parts — shown right before any PDF download across the app. */
export default function DownloadChoiceModal({
  pageCount,
  onClose,
  onDownloadFull,
  onDownloadSplit,
}: Props) {
  const [mode, setMode] = useState<'full' | 'split'>('full');
  const maxParts = pageCount ?? 99;
  const [parts, setParts] = useState(Math.min(2, maxParts));

  const confirm = () => {
    if (mode === 'split') {
      onDownloadSplit(Math.max(2, Math.min(parts, maxParts)));
    } else {
      onDownloadFull();
    }
  };

  return (
    <div className="dlm__overlay" onClick={onClose}>
      <div className="dlm" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className="dlm__close" onClick={onClose} aria-label="Close">×</button>

        <h2 className="dlm__title">Download</h2>
        <p className="dlm__subtitle">
          Download the whole document as one PDF, or split it into separate parts.
        </p>

        <label className="dlm__option">
          <input
            type="radio"
            name="dlm-mode"
            checked={mode === 'full'}
            onChange={() => setMode('full')}
          />
          Full document (one PDF)
        </label>

        <label className="dlm__option">
          <input
            type="radio"
            name="dlm-mode"
            checked={mode === 'split'}
            onChange={() => setMode('split')}
            disabled={maxParts < 2}
          />
          Split into parts
        </label>

        {mode === 'split' && (
          <div className="dlm__split-row">
            <label htmlFor="dlm-parts">Number of parts</label>
            <input
              id="dlm-parts"
              type="number"
              min={2}
              max={maxParts}
              value={parts}
              onChange={(e) => setParts(Number.parseInt(e.target.value, 10) || 2)}
            />
            {pageCount !== null && (
              <span className="dlm__hint">of {pageCount} page{pageCount === 1 ? '' : 's'}</span>
            )}
          </div>
        )}

        <div className="dlm__actions">
          <button className="dlm__btn dlm__btn--primary" onClick={confirm}>
            Download
          </button>
          <button className="dlm__btn dlm__btn--ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
