import { useRef, useState } from 'react';

/**
 * Reorderable PDF file list state. Used by both the main-file picker and
 * the annexure-file picker — same UI affordances (drag-drop, ↑/↓/×
 * buttons, MIME filtering), so the logic is hoisted into a single hook
 * to avoid drift.
 *
 * `maxFiles` is optional — pass a number to enforce a hard cap, omit to
 * allow an unbounded list. Court filings have no statutory ceiling, so
 * the default is uncapped.
 */
export function useFileList(maxFiles?: number) {
  const [files, setFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (incoming: File[]) => {
    const pdfs = incoming.filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (pdfs.length === 0) return;
    setFiles((prev) => {
      const merged = [...prev, ...pdfs];
      return typeof maxFiles === 'number' ? merged.slice(0, maxFiles) : merged;
    });
  };

  const remove = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const move = (idx: number, dir: -1 | 1) => {
    setFiles((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const reset = () => {
    setFiles([]);
    if (inputRef.current) inputRef.current.value = '';
  };

  return { files, setFiles, inputRef, add, remove, move, reset };
}
