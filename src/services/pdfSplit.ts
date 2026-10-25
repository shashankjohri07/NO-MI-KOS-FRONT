/**
 * Client-side PDF splitting — pdf-lib parses and re-saves locally, nothing
 * uploads anywhere (same approach as pdfInfo.ts's page counting).
 */

import { PDFDocument } from 'pdf-lib';

export interface PdfPart {
  blob: Blob;
  filename: string;
}

/** Splits `blob` into `parts` pieces of roughly-equal page count (pages are
 * kept in order, so part 1 is the front of the document, etc). `parts` is
 * clamped to [1, page count]; 1 returns the original blob unchanged. */
export async function splitPdfIntoParts(
  blob: Blob,
  filename: string,
  parts: number,
): Promise<PdfPart[]> {
  const bytes = await blob.arrayBuffer();
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const pageCount = src.getPageCount();
  const n = Math.max(1, Math.min(Math.floor(parts) || 1, pageCount));
  if (n <= 1) return [{ blob, filename }];

  const base = filename.replace(/\.pdf$/i, '');
  const perPart = Math.ceil(pageCount / n);
  const results: PdfPart[] = [];

  for (let i = 0; i < n; i++) {
    const start = i * perPart;
    if (start >= pageCount) break;
    const end = Math.min(start + perPart, pageCount);
    const out = await PDFDocument.create();
    const indices = Array.from({ length: end - start }, (_, k) => start + k);
    const copied = await out.copyPages(src, indices);
    for (const p of copied) out.addPage(p);
    const outBytes = await out.save();
    results.push({
      blob: new Blob([outBytes], { type: 'application/pdf' }),
      filename: `${base}_part${i + 1}of${n}.pdf`,
    });
  }
  return results;
}
