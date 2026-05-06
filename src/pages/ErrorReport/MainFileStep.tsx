import type { Ref } from 'react';
import Dropzone from './Dropzone';
import FileList from './FileList';

interface Props {
  files: File[];
  inputRef: Ref<HTMLInputElement>;
  onAdd: (files: File[]) => void;
  onMove: (idx: number, dir: -1 | 1) => void;
  onRemove: (idx: number) => void;
  indexEndPage: string;
  setIndexEndPage: (v: string) => void;
  onSubmit: () => void;
  isProcessing: boolean;
  maxFiles: number;
}

/**
 * The first step: pick main-volume PDFs, type the index-end-page,
 * hit "Write Page Numbers". Drives the bulk of the page; the index
 * input + submit only render outside the processing state so the
 * spinner has the area to itself when the request is in flight.
 */
export default function MainFileStep({
  files,
  inputRef,
  onAdd,
  onMove,
  onRemove,
  indexEndPage,
  setIndexEndPage,
  onSubmit,
  isProcessing,
  maxFiles,
}: Props) {
  return (
    <>
      <Dropzone
        inputId="er-main-upload"
        inputRef={inputRef}
        hasFiles={files.length > 0}
        mainText={
          files.length
            ? `Add another volume (max ${maxFiles})`
            : 'Drop your PDFs here or click to browse'
        }
        hintText={
          files.length
            ? 'Files are merged in the order listed below'
            : 'Upload one or multiple PDFs — up to 100MB each'
        }
        onAdd={onAdd}
      />

      {files.length > 0 && (
        <FileList
          files={files}
          rowLabel={(i) => `Vol ${i + 1}`}
          onMove={onMove}
          onRemove={onRemove}
          disabled={isProcessing}
        />
      )}

      {files.length > 0 && !isProcessing && (
        <div className="er__index-input">
          <label htmlFor="er-index-end" className="er__index-input-label">
            Index ends at page
            <span className="er__index-input-hint">
              {' '}
              — numbering begins on the next page (use 0 if there is no index)
            </span>
          </label>
          <input
            id="er-index-end"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            className="er__index-input-field"
            placeholder="e.g. 3"
            value={indexEndPage}
            onChange={(e) => setIndexEndPage(e.target.value)}
          />
        </div>
      )}

      {files.length > 0 && !isProcessing && (
        <button type="button" className="er__btn er__btn--primary" onClick={onSubmit}>
          Write Page Numbers
        </button>
      )}
    </>
  );
}
