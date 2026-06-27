import type { Ref } from 'react';
import Dropzone from './Dropzone';
import FileList from './FileList';

interface Props {
  files: File[];
  inputRef: Ref<HTMLInputElement>;
  onAdd: (files: File[]) => void;
  onMove: (idx: number, dir: -1 | 1) => void;
  onRemove: (idx: number) => void;
  onSubmit: () => void;
  onCancel: () => void;
  /** Optional hard cap on the number of annexures. Omit for unbounded. */
  maxAnnexures?: number;
  hideSubmit?: boolean;
  hideCancel?: boolean;
  /** When provided, shows a "Skip annexures →" button. */
  onSkip?: () => void;
}

/**
 * Annexure file picker. Each uploaded file becomes one annexure:
 * file 1 → "Annexure A-1", file 2 → "Annexure A-2", etc., per the
 * agreed convention. Layout mirrors the main-files step but the row
 * labels read "A-N" instead of "Vol N".
 */
export default function AnnexPickStep({
  files,
  inputRef,
  onAdd,
  onMove,
  onRemove,
  onSubmit,
  onCancel,
  maxAnnexures,
  hideSubmit = false,
  hideCancel = false,
  onSkip,
}: Props) {
  return (
    <>
      <Dropzone
        inputId="er-annex-upload"
        inputRef={inputRef}
        hasFiles={files.length > 0}
        mainText={
          files.length
            ? typeof maxAnnexures === 'number'
              ? `Add another annexure (max ${maxAnnexures})`
              : 'Add another annexure'
            : 'Drop annexure PDFs here'
        }
        hintText="File 1 → Annexure A-1, File 2 → Annexure A-2, … (in upload order)"
        onAdd={onAdd}
      />

      {files.length > 0 && (
        <FileList
          files={files}
          rowLabel={(i) => `A-${i + 1}`}
          onMove={onMove}
          onRemove={onRemove}
        />
      )}

      {files.length > 0 && !hideSubmit && (
        <button type="button" className="er__btn er__btn--primary" onClick={onSubmit}>
          Merge Annexures &amp; Re-Number
        </button>
      )}
      {onSkip && (
        <button type="button" className="er__btn er__btn--outline" onClick={onSkip}>
          Skip annexures →
        </button>
      )}
      {!hideCancel && (
        <button type="button" className="er__btn er__btn--outline" onClick={onCancel}>
          Cancel
        </button>
      )}
    </>
  );
}
