import { useMemo, type Ref } from 'react';
import { parsePageSpec, formatPageSet } from './pageSpec';

interface Props {
  clientSig: File | null;
  advocateSig: File | null;
  clientInputRef: Ref<HTMLInputElement>;
  advocateInputRef: Ref<HTMLInputElement>;
  onClientChange: (f: File | null) => void;
  onAdvocateChange: (f: File | null) => void;
  /** Comma+range spec ("1, 3-5, 8") of extra MAIN pages to also sign.
   * Optional: when `onSignPagesChange` is omitted the "also sign main pages"
   * block is hidden entirely (the wizard moves it to its own Special Pages
   * step). The standalone Signatures tool still passes both and shows it. */
  signPages?: string;
  onSignPagesChange?: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  /** When provided, shows a "Skip signatures →" button. */
  onSkip?: () => void;
}

/**
 * Two PNG/JPG file pickers (client + advocate signatures) plus an
 * optional "also sign these main-document pages" text input.
 *
 * At least one signature image is required to enable the submit button.
 * Annexure pages get signatures automatically on every page (court-
 * filing convention); the extra-pages input lets the user opt MAIN
 * pages in too — typical case is the vakalatnama, prayer page, or
 * affidavit.
 */
export default function SigPickStep({
  clientSig,
  advocateSig,
  clientInputRef,
  advocateInputRef,
  onClientChange,
  onAdvocateChange,
  signPages,
  onSignPagesChange,
  onSubmit,
  onCancel,
  onSkip,
}: Props) {
  // Live-parse the spec so the user gets instant feedback ("you typed
  // garbage" / "you'll sign pages 1, 3-5"). The same parser runs again
  // server-side in Python — this is just a UX nicety, not the source
  // of truth.
  const showExtraPages = typeof onSignPagesChange === 'function';
  const preview = useMemo(() => {
    const trimmed = (signPages ?? '').trim();
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

      {showExtraPages && (
        <div className="er__sig-extra">
          <label className="er__sig-slot-label" htmlFor="er-sign-pages">
            Also sign these main-document pages (optional)
          </label>
          <input
            id="er-sign-pages"
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            className="er__sig-extra-input"
            placeholder="e.g. 1, 3-5, 8, 12-15"
            value={signPages ?? ''}
            onChange={(e) => onSignPagesChange?.(e.target.value)}
          />
          <p className="er__sig-extra-hint">
            Use the <strong>stamped page number</strong> (the digit we put
            in the top-right corner after numbering) — index pages don&apos;t
            count. Comma-separated values and ranges both work. Leave blank
            to skip; annexure pages are signed automatically regardless.
          </p>
          {preview.kind === 'ok' && (
            <p className="er__sig-extra-preview">
              ✓ Will additionally sign {preview.count}{' '}
              page{preview.count === 1 ? '' : 's'}: {preview.label}
            </p>
          )}
          {preview.kind === 'error' && (
            <p className="er__sig-extra-error">⚠ {preview.message}</p>
          )}
        </div>
      )}

      <p className="er__sig-hint">
        Upload at least one signature to continue. Both are recommended for proper annexure
        attestation.
      </p>

      {(clientSig || advocateSig) && preview.kind !== 'error' && (
        <button type="button" className="er__btn er__btn--primary" onClick={onSubmit}>
          Stamp Signatures &amp; Re-Process
        </button>
      )}
      {onSkip && (
        <button type="button" className="er__btn er__btn--outline" onClick={onSkip}>
          Skip signatures →
        </button>
      )}
      <button type="button" className="er__btn er__btn--outline" onClick={onCancel}>
        Cancel
      </button>
    </>
  );
}
