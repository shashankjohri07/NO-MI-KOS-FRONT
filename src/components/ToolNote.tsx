import '../styles/ToolNote.css';

/**
 * Small intuitive disclaimer strip shown under a tool's header — tells the
 * user in one line what the tool will and won't do, so there are no
 * surprises in the output.
 */
export default function ToolNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="tool-note" role="note">
      <span className="tool-note__icon">ℹ</span>
      <p className="tool-note__text">{children}</p>
    </div>
  );
}
