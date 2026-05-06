interface Props {
  files: File[];
  /** Label shown in the leftmost column for each row (e.g. "Vol", "A-"). */
  rowLabel: (idx: number) => string;
  onMove: (idx: number, dir: -1 | 1) => void;
  onRemove: (idx: number) => void;
  /** When true, the ↑/↓/× buttons are disabled (e.g. while submitting). */
  disabled?: boolean;
}

/**
 * Reorderable PDF list. Used in both the main-files step (where each row
 * shows "Vol 1", "Vol 2", …) and the annexures step (where rows are
 * "A-1", "A-2", …). Identical layout — the only thing that varies is
 * the label in the first column, which the parent supplies via
 * `rowLabel`.
 */
export default function FileList({ files, rowLabel, onMove, onRemove, disabled }: Props) {
  return (
    <ol className="er__file-list">
      {files.map((f, i) => (
        <li key={`${f.name}-${i}`} className="er__file-list-item">
          <span className="er__file-list-idx">{rowLabel(i)}</span>
          <span className="er__file-list-name">{f.name}</span>
          <span className="er__file-list-size">{(f.size / 1024 / 1024).toFixed(2)} MB</span>
          <span className="er__file-list-actions">
            <button
              type="button"
              className="er__file-list-btn"
              onClick={() => onMove(i, -1)}
              disabled={i === 0 || disabled}
              aria-label="Move up"
              title="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              className="er__file-list-btn"
              onClick={() => onMove(i, 1)}
              disabled={i === files.length - 1 || disabled}
              aria-label="Move down"
              title="Move down"
            >
              ↓
            </button>
            <button
              type="button"
              className="er__file-list-btn er__file-list-btn--remove"
              onClick={() => onRemove(i)}
              disabled={disabled}
              aria-label="Remove"
              title="Remove"
            >
              ×
            </button>
          </span>
        </li>
      ))}
    </ol>
  );
}
