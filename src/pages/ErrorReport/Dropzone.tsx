import type { Ref } from 'react';

interface Props {
  inputId: string;
  inputRef: Ref<HTMLInputElement>;
  hasFiles: boolean;
  mainText: string;
  hintText: string;
  onAdd: (files: File[]) => void;
}

/**
 * The drag-drop / click-to-browse PDF picker. Identical markup is used
 * for the main-files step and the annexure step; only the labels and
 * input ID differ, which the parent passes in.
 */
export default function Dropzone({ inputId, inputRef, hasFiles, mainText, hintText, onAdd }: Props) {
  return (
    <div
      className={`er__dropzone ${hasFiles ? 'er__dropzone--has-file' : ''}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onAdd(Array.from(e.dataTransfer.files));
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
          if (sel.length) onAdd(sel);
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
          <span className="er__dropzone-main">{mainText}</span>
          <span className="er__dropzone-hint">{hintText}</span>
        </div>
      </label>
    </div>
  );
}
