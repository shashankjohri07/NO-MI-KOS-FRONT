import { useEffect, useState } from 'react';

/**
 * Staged processing indicator. Replaces the bare spinner + elapsed counter:
 * the user sees WHAT is happening, not just that time is passing.
 *
 * Stages come from two sources:
 *  - a real signal: documentApi dispatches 'nomikos:backend-waking' when a
 *    gateway error told it the Render dyno is cold-starting;
 *  - elapsed-time heuristics for the phases we cannot observe from the
 *    browser (upload finished → python working).
 */
interface Props {
  /** Tool-specific verb for the main stage, e.g. "Stamping page numbers". */
  label?: string;
}

const BACKEND_WAKING_EVENT = 'nomikos:backend-waking';

/** documentApi calls this when it detects a cold-starting backend. */
export function signalBackendWaking(): void {
  window.dispatchEvent(new Event(BACKEND_WAKING_EVENT));
}

export default function ProcessingPanel({ label = 'Processing your document' }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [waking, setWaking] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    const onWaking = () => setWaking(true);
    window.addEventListener(BACKEND_WAKING_EVENT, onWaking);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(BACKEND_WAKING_EVENT, onWaking);
    };
  }, []);

  const stage = waking
    ? {
        text: 'Waking the processing server…',
        hint: 'The free-tier server sleeps when idle — this one-time wait can take up to a minute. Your file is safe and will process automatically.',
      }
    : elapsed < 4
      ? { text: 'Uploading your document…', hint: 'Large files take longer on slow connections.' }
      : elapsed < 25
        ? { text: `${label}…`, hint: 'Usually done in a few seconds.' }
        : elapsed < 75
          ? {
              text: `${label}…`,
              hint: 'Taking longer than usual — the server may be waking from sleep. Hang tight, nothing is lost.',
            }
          : {
              text: `${label}…`,
              hint: 'Still working. Very large or scanned documents can take a few minutes.',
            };

  const clock =
    elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;

  return (
    <div className="er__processing">
      <div className="er__spinner" />
      <p className="er__processing-text">{stage.text}</p>
      <p className="er__processing-hint">
        {clock} elapsed — {stage.hint}
      </p>
    </div>
  );
}
