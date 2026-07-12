/**
 * Client-side PDF page counting so inputs like "index ends at page" or
 * "pages to sign" can be capped at the document's REAL page count — no more
 * typing page 100 into a 72-page filing.
 *
 * pdf-lib parses locally (nothing uploads anywhere). Failures return null:
 * validation simply stays uncapped for that file, never blocking the user.
 */

import { PDFDocument } from 'pdf-lib';

const cache = new WeakMap<File, Promise<number | null>>();

/** Page count of one PDF file, or null if it can't be parsed. Cached per File. */
export function countPdfPages(file: File): Promise<number | null> {
  let p = cache.get(file);
  if (!p) {
    p = (async () => {
      try {
        const bytes = await file.arrayBuffer();
        const doc = await PDFDocument.load(bytes, {
          ignoreEncryption: true,
          updateMetadata: false,
        });
        return doc.getPageCount();
      } catch {
        return null;
      }
    })();
    cache.set(file, p);
  }
  return p;
}

/** Total pages across all files, or null if ANY file couldn't be parsed
 * (a partial total would produce a wrong cap — worse than no cap). */
export async function countTotalPages(files: File[]): Promise<number | null> {
  if (files.length === 0) return null;
  const counts = await Promise.all(files.map(countPdfPages));
  let total = 0;
  for (const c of counts) {
    if (c === null) return null;
    total += c;
  }
  return total;
}
