import type { Ref } from 'react';

interface Props {
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
 * Two PNG/JPG file pickers (client + advocate signatures). At least one
 * is required to enable the submit button — both are optional but
 * recommended; the backend skips whichever side is missing.
 */
export default function SigPickStep({
  clientSig,
  advocateSig,
  clientInputRef,
  advocateInputRef,
  onClientChange,
  onAdvocateChange,
  onSubmit,
  onCancel,
}: Props) {
  return (
    <>
      <div className="er__sig-grid">
        <div className="er__sig-slot">
          <label className="er__sig-slot-label" htmlFor="er-client-sig">
            Client Signature (PNG / JPG)
          </label>
          <input
            ref={clientInputRef}
            id="er-client-sig"
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
          <label className="er__sig-slot-label" htmlFor="er-advocate-sig">
            Advocate Signature (PNG / JPG)
          </label>
          <input
            ref={advocateInputRef}
            id="er-advocate-sig"
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
        Upload at least one signature to continue. Both are recommended for proper annexure
        attestation.
      </p>

      {(clientSig || advocateSig) && (
        <button type="button" className="er__btn er__btn--primary" onClick={onSubmit}>
          Stamp Signatures &amp; Re-Process
        </button>
      )}
      <button type="button" className="er__btn er__btn--outline" onClick={onCancel}>
        Cancel
      </button>
    </>
  );
}
