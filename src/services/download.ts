/** Triggers a browser download for one blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Triggers downloads for several blobs. Browsers silently drop rapid-fire
 * `a.click()` downloads beyond the first one or two, so each part is staged
 * a beat apart. */
export async function downloadBlobsStaggered(
  files: { blob: Blob; filename: string }[],
): Promise<void> {
  for (let i = 0; i < files.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 400));
    downloadBlob(files[i].blob, files[i].filename);
  }
}
