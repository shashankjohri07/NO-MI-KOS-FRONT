import { useEffect, useMemo, useState, type Ref } from 'react';
import { parsePageSpec, formatPageSet } from './pageSpec';

interface Props {
  /** The current (numbered + annexure-merged) PDF, shown as a live preview so
   * the user can read the stamped page numbers and decide which to sign. */
  previewBlob: Blob | null;
  /** Comma+range spec ("1, 3-5, 8") of the MAIN pages to sign. Required here
   * — this whole step exists to collect it plus its own signature images. */
  signPages: string;
  onSignPagesChange: (v: string) => void;
  /** Signature images dedicated to these special pages — independent of the
   * every-annexure-page signatures collected in the Signatures step. The user
   * picks "client / advocate / both" simply by which slot(s) they fill. */
  clientSig: File | null;
  advocateSig: File | null;
  clientInputRef: Ref<HTMLInputElement>;
  advocateInputRef: Ref<HTMLInputElement>;
  onClientChange: (f: File | null) => void;
  onAdvocateChange: (f: File | null) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

/**
 * Step 4 of the wizard — "Special Pages".
 *
 * Lets the user opt specific MAIN-document pages (vakalatnama, prayer page,
 * affidavit, etc.) into signing, with their OWN signature images that are
 * separate from the annexure signatures. Which signature(s) get stamped is
 * decided by which slot the user fills: client only, advocate only, or both.
 *
 * Submit is enabled only when the page spec is valid AND non-empty AND at
 * least one signature image is chosen.
 */
export default function SpecialPageStep({
  previewBlob,
  signPages,
  onSignPagesChange,
  clientSig,
  advocateSig,
  clientInputRef,
  advocateInputRef,
  onClientChange,
  onAdvocateChange,
  onSubmit,
  onCancel,
}: Props) {
  // Object URL for the embedded PDF preview; created from the current blob and
  // revoked when it changes / the step unmounts to avoid leaking memory.
  const [previewUrl, setPreviewUrl] = useState<string>('');
  useEffect(() => {
    if (!previewBlob) {
      setPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(previewBlob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [previewBlob]);

  const preview = useMemo(() => {
    const trimmed = signPages.trim();
    if (!trimmed) return { kind: 'empty' as const };
    try {
      const set = parsePageSpec(trimmed);
      if (set.size === 0) return { kind: 'empty' as const };
      return { kind: 'ok' as const, label: formatPageSet(set), count: set.size };
    } catch (e) {
      return {
        kind: 'error' as const,
        message: e instanceof Error ? e.message : 'Invalid format',
      };
    }
  }, [signPages]);

  const hasSig = !!clientSig || !!advocateSig;
  const canSubmit = preview.kind === 'ok' && hasSig;

  return (
    <>
      {previewUrl && (
        <div className="er__preview">
          <p className="er__preview-label">
            📄 Document preview — scroll to read the stamped page numbers (top-right of each page),
            then enter the ones you want to sign below.
          </p>
          <iframe
            src={`${previewUrl}#toolbar=1&navpanes=0`}
            title="Document preview"
            className="er__preview-frame"
          />
        </div>
      )}

      <div className="er__sig-extra">
        <label className="er__sig-slot-label" htmlFor="er-special-pages">
          Which pages to sign
        </label>
        <input
          id="er-special-pages"
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          className="er__sig-extra-input"
          placeholder="e.g. 1, 3-5, 8, 12-15"
          value={signPages}
          onChange={(e) => onSignPagesChange(e.target.value)}
        />
        <p className="er__sig-extra-hint">
          Use the <strong>stamped page number</strong> (the digit in the
          top-right corner after numbering) — index pages don&apos;t count.
          Comma-separated values and ranges both work.
        </p>
        {preview.kind === 'ok' && (
          <p className="er__sig-extra-preview">
            ✓ Will sign {preview.count} page{preview.count === 1 ? '' : 's'}: {preview.label}
          </p>
        )}
        {preview.kind === 'error' && (
          <p className="er__sig-extra-error">⚠ {preview.message}</p>
        )}
      </div>

      <div className="er__sig-grid">
        <div className="er__sig-slot">
          <label className="er__sig-slot-label" htmlFor="er-special-client-sig">
            Client Signature — left (PNG / JPG)
          </label>
          <input
            ref={clientInputRef}
            id="er-special-client-sig"
            type="file"
            accept="image/png,image/jpeg"
            className="er__sig-slot-input"
            onChange={(e) => onClientChange(e.target.files?.[0] ?? null)}
          />
          {clientSig && (
            <p className="er__sig-slot-name">
              ✓ {clientSig.name} ({(clientSig.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        <div className="er__sig-slot">
          <label className="er__sig-slot-label" htmlFor="er-special-advocate-sig">
            Advocate Signature — right (PNG / JPG)
          </label>
          <input
            ref={advocateInputRef}
            id="er-special-advocate-sig"
            type="file"
            accept="image/png,image/jpeg"
            className="er__sig-slot-input"
            onChange={(e) => onAdvocateChange(e.target.files?.[0] ?? null)}
          />
          {advocateSig && (
            <p className="er__sig-slot-name">
              ✓ {advocateSig.name} ({(advocateSig.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>
      </div>

      <p className="er__sig-hint">
        Fill at least one signature slot — only the side(s) you upload get stamped on the listed
        pages. These images are independent of the annexure signatures.
      </p>

      {canSubmit && (
        <button type="button" className="er__btn er__btn--primary" onClick={onSubmit}>
          Stamp Special Pages &amp; Finish
        </button>
      )}
      <button type="button" className="er__btn er__btn--outline" onClick={onCancel}>
        Cancel
      </button>
    </>
  );
}
