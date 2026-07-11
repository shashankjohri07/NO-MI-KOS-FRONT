/**
 * Translate raw backend/python/network errors into messages a lawyer can
 * act on. The raw text ("Python exited 1: Traceback…") is kept as a short
 * technical suffix so support/debugging isn't blinded, but the headline
 * tells the user what actually went wrong and what to do next.
 */

interface Rule {
  match: RegExp;
  message: string;
}

const RULES: Rule[] = [
  {
    match: /password|encrypt/i,
    message:
      'This PDF is password-protected. Remove the password (open it and re-save / print to PDF) and try again.',
  },
  {
    match: /failed to open|failed to.*merge|invalid pdf|cannot open|damaged|corrupt|not a pdf|mupdf/i,
    message:
      "This file couldn't be read as a PDF — it may be corrupted or mislabeled. Re-export or re-download it and try again.",
  },
  {
    match: /413|too large|body exceeded|file size/i,
    message: 'The upload is too large for the server (500 MB limit). Split or compress the file and retry.',
  },
  {
    match: /failed to fetch|networkerror|load failed|network request failed/i,
    message: 'Could not reach the server — check your internet connection and try again.',
  },
  {
    match: /timeout|timed out/i,
    message:
      'The server took too long to respond. Very large documents can do this — try again, or split the file.',
  },
  {
    match: /python exited|process error|spawn|exited \d/i,
    message:
      'The server hit an internal error while processing this document. Try again — if it keeps failing, the file may have an unusual structure; send us feedback with the file name.',
  },
];

export function friendlyError(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  if (!raw) return fallback;

  // Messages we already wrote for humans pass through untouched.
  if (/waking up|hit try again/i.test(raw)) return raw;

  for (const rule of RULES) {
    if (rule.match.test(raw)) return rule.message;
  }
  // Unknown error: fallback headline + trimmed technical detail.
  const detail = raw.replace(/\s+/g, ' ').slice(0, 140);
  return `${fallback}${detail ? ` (${detail}${raw.length > 140 ? '…' : ''})` : ''}`;
}
