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
  /** Optional hard cap on the number of volumes. Omit for unbounded. */
  maxFiles?: number;
  /** When true, hides the inline submit button — used when composing this
   * step into a larger form that submits everything at once. */
  hideSubmit?: boolean;
  /** When provided, shows a "Skip page numbering →" link below the submit. */
  onSkip?: () => void;
  /** Real page count of the uploaded document(s) — caps the index input so
   * the user can't type a page beyond the document. Null = unknown. */
  maxPages?: number | null;
  /** When true, the page input asks "start numbering from page N" instead
   * of "index ends at page N". The bound value is STILL the index-end page
   * (start − 1) — the parent converts. Used by the Document Prep pipeline,
   * which builds its own index so "index" wording would confuse. */
  startFromMode?: boolean;
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
  hideSubmit = false,
  onSkip,
  maxPages = null,
  startFromMode = false,
}: Props) {
  const clampIndexEnd = (v: string) => {
    if (maxPages !== null && v !== '') {
      const n = Number.parseInt(v, 10);
      if (Number.isFinite(n) && n > maxPages) {
        setIndexEndPage(String(maxPages));
        return;
      }
    }
    setIndexEndPage(v);
  };

  // startFromMode shows "start numbering from page N" but still stores the
  // index-end page (N − 1) in the shared state, so the API call is unchanged.
  const startValue =
    indexEndPage === '' ? '' : String((Number.parseInt(indexEndPage, 10) || 0) + 1);
  const onStartChange = (v: string) => {
    if (v === '') {
      setIndexEndPage('');
      return;
    }
    let n = Number.parseInt(v, 10);
    if (!Number.isFinite(n) || n < 1) n = 1;
    if (maxPages !== null && n > maxPages) n = maxPages;
    setIndexEndPage(String(n - 1));
  };
  return (
    <>
      <Dropzone
        inputId="er-main-upload"
        inputRef={inputRef}
        hasFiles={files.length > 0}
        mainText={
          files.length
            ? typeof maxFiles === 'number'
              ? `Add another volume (max ${maxFiles})`
              : 'Add another volume'
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
          {startFromMode ? (
            <>
              <label htmlFor="er-index-end" className="er__index-input-label">
                Start page numbering from page
                <span className="er__index-input-hint">
                  {' '}
                  — pages before this are left unnumbered (leave as 1 to number every page)
                  {maxPages !== null && `. Your document has ${maxPages} page${maxPages === 1 ? '' : 's'}.`}
                </span>
              </label>
              <input
                id="er-index-end"
                type="number"
                min={1}
                max={maxPages ?? undefined}
                step={1}
                inputMode="numeric"
                className="er__index-input-field"
                placeholder="1"
                value={startValue}
                onChange={(e) => onStartChange(e.target.value)}
              />
            </>
          ) : (
            <>
              <label htmlFor="er-index-end" className="er__index-input-label">
                Index ends at page
                <span className="er__index-input-hint">
                  {' '}
                  — numbering begins on the next page (use 0 if there is no index)
                  {maxPages !== null && `. Your document has ${maxPages} page${maxPages === 1 ? '' : 's'}.`}
                </span>
              </label>
              <input
                id="er-index-end"
                type="number"
                min={0}
                max={maxPages ?? undefined}
                step={1}
                inputMode="numeric"
                className="er__index-input-field"
                placeholder="e.g. 3"
                value={indexEndPage}
                onChange={(e) => clampIndexEnd(e.target.value)}
              />
            </>
          )}
        </div>
      )}

      {files.length > 0 && !isProcessing && !hideSubmit && (
        <button type="button" className="er__btn er__btn--primary" onClick={onSubmit}>
          Write Page Numbers
        </button>
      )}
      {files.length > 0 && !isProcessing && !hideSubmit && onSkip && (
        <button type="button" className="er__btn er__btn--outline" onClick={onSkip}>
          Skip page numbering →
        </button>
      )}
    </>
  );
}
