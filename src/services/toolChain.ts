import { useEffect, useState } from 'react';

/**
 * In-memory hand-off of a generated PDF from one tool to the next.
 *
 * Deliberately NOT persisted anywhere — no server upload, no IndexedDB,
 * no localStorage. The document lives in a module-level variable (browser
 * RAM only) and survives client-side route changes, which is exactly the
 * lifetime a "continue to the next tool" hand-off needs. A page refresh
 * drops it, and that's fine — the user still has the original files.
 */

export interface ChainedDoc {
  file: File;
  /** Human label of the tool that produced it, e.g. "Page Numbering". */
  from: string;
}

let current: ChainedDoc | null = null;

export function setChainedDoc(blob: Blob, filename: string, from: string): void {
  current = {
    file: new File([blob], filename, { type: 'application/pdf' }),
    from,
  };
}

/** Read-and-clear: the receiving tool consumes the hand-off exactly once. */
export function takeChainedDoc(): ChainedDoc | null {
  const c = current;
  current = null;
  return c;
}

/**
 * Receiving-side hook: on mount, consume a pending hand-off into the tool's
 * file list. Returns the source tool's name so the page can show a
 * "document carried over from X" notice, or null when there was none.
 */
export function useChainedIntake(add: (files: File[]) => void): string | null {
  const [from, setFrom] = useState<string | null>(null);
  useEffect(() => {
    const c = takeChainedDoc();
    if (c) {
      add([c.file]);
      setFrom(c.from);
    }
    // mount-only by design: the hand-off is a one-shot intake
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return from;
}
