import { useState, type Ref } from 'react';

interface Props {
  inputId: string;
  inputRef: Ref<HTMLInputElement>;
  hasFiles: boolean;
  mainText: string;
  hintText: string;
  onAdd: (files: File[]) => void;
}

const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

// Above this we warn (uploads may crawl or hit server limits) but don't block —
// the hard cap lives server-side (multer 500MB).
const WARN_MB = 100;

/**
 * The drag-drop / click-to-browse PDF picker. Identical markup is used
 * for the main-files step and the annexure step; only the labels and
 * input ID differ, which the parent passes in.
 *
 * Selection feedback: highlights while a file is dragged over it, names
 * the files it skipped (non-PDF) and warns about very large ones —
 * previously both were silently ignored, which read as "the site is
 * broken".
 */
export default function Dropzone({ inputId, inputRef, hasFiles, mainText, hintText, onAdd }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'warn'; text: string } | null>(null);

  const handleFiles = (incoming: File[]) => {
    if (incoming.length === 0) return;
    const pdfs = incoming.filter(isPdf);
    const skipped = incoming.filter((f) => !isPdf(f));
    const oversized = pdfs.filter((f) => f.size > WARN_MB * 1024 * 1024);

    if (skipped.length > 0) {
      setNotice({
        kind: 'warn',
        text: `${skipped.map((f) => f.name).join(', ')} skipped — only PDF files are supported here.`,
      });
    } else if (oversized.length > 0) {
      const f = oversized[0];
      setNotice({
        kind: 'warn',
        text: `${f.name} is ${(f.size / 1024 / 1024).toFixed(0)} MB — very large files upload slowly and may hit server limits. Consider compressing it first.`,
      });
    } else {
      const totalMB = pdfs.reduce((a, f) => a + f.size, 0) / 1024 / 1024;
      setNotice({
        kind: 'ok',
        text: `✓ ${pdfs.length} file${pdfs.length === 1 ? '' : 's'} added (${totalMB.toFixed(1)} MB).`,
      });
    }
    if (pdfs.length) onAdd(pdfs);
  };

  return (
    <>
      <div
        className={`er__dropzone ${hasFiles ? 'er__dropzone--has-file' : ''} ${dragOver ? 'er__dropzone--drag' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(Array.from(e.dataTransfer.files));
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          multiple
          className="er__file-input"
          onChange={(e) => {
            const sel = Array.from(e.target.files || []);
            if (sel.length) handleFiles(sel);
          }}
          id={inputId}
        />
        <label htmlFor={inputId} className="er__dropzone-label">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="er__upload-icon"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <div className="er__dropzone-text">
            <span className="er__dropzone-main">{dragOver ? 'Drop to add' : mainText}</span>
            <span className="er__dropzone-hint">{hintText}</span>
          </div>
        </label>
      </div>
      {notice && (
        <p className={`er__dz-notice er__dz-notice--${notice.kind}`}>{notice.text}</p>
      )}
    </>
  );
}
