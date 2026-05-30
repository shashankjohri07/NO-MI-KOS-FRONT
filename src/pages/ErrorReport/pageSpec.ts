/**
 * Mirror of server/page_spec.py — kept deliberately in lock-step so the
 * live UI preview and the server's actual parse can't drift.
 *
 *   "1, 3-5, 8"   → {1, 3, 4, 5, 8}
 *   "10-12, 12"   → {10, 11, 12}        (deduped)
 *   "5-3"         → {3, 4, 5}            (reversed range tolerated)
 *   ""            → empty set
 *
 * Throws PageSpecError on malformed input (garbage tokens, dangling
 * dashes). Zero / negative bare numbers are silently dropped.
 */

export class PageSpecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PageSpecError';
  }
}

export function parsePageSpec(spec: string | null | undefined): Set<number> {
  if (spec == null) return new Set();
  const text = spec.trim();
  if (!text) return new Set();

  const out = new Set<number>();
  const tokens = text.split(',').map((t) => t.trim());
  for (const tok of tokens) {
    if (!tok) continue; // "1,,2" — tolerate stray commas
    if (tok.includes('-')) {
      const parts = tok.split('-');
      if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) {
        throw new PageSpecError(
          `Bad range "${tok}". Use "a-b" with both ends, e.g. "3-5".`
        );
      }
      const lo0 = Number(parts[0].trim());
      const hi0 = Number(parts[1].trim());
      if (!Number.isInteger(lo0) || !Number.isInteger(hi0)) {
        throw new PageSpecError(
          `Range "${tok}" contains non-numeric values.`
        );
      }
      const [lo, hi] = lo0 > hi0 ? [hi0, lo0] : [lo0, hi0];
      for (let n = lo; n <= hi; n++) {
        if (n > 0) out.add(n);
      }
    } else {
      const n = Number(tok);
      if (!Number.isInteger(n)) {
        throw new PageSpecError(
          `"${tok}" is not a number. Use comma-separated pages and ranges, e.g. "1, 3-5, 8".`
        );
      }
      if (n > 0) out.add(n);
    }
  }
  return out;
}

/**
 * Render a sorted page set into a compact "1, 3-5, 8" string with
 * consecutive runs collapsed into ranges. Inverse of parsePageSpec.
 */
export function formatPageSet(pages: Set<number>): string {
  if (pages.size === 0) return '';
  const sorted = [...pages].sort((a, b) => a - b);
  const chunks: string[] = [];
  let runStart = sorted[0];
  let runEnd = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const n = sorted[i];
    if (n === runEnd + 1) {
      runEnd = n;
    } else {
      chunks.push(runStart === runEnd ? String(runStart) : `${runStart}-${runEnd}`);
      runStart = n;
      runEnd = n;
    }
  }
  chunks.push(runStart === runEnd ? String(runStart) : `${runStart}-${runEnd}`);
  return chunks.join(', ');
}
