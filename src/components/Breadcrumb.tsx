import '../styles/Breadcrumb.css';

export interface BreadcrumbStep {
  label: string;
  active: boolean;
  done: boolean;
  reachable: boolean;
}

interface Props {
  steps: BreadcrumbStep[];
  onJump: (index: number) => void;
}

export default function Breadcrumb({ steps, onJump }: Props) {
  return (
    <nav className="crumb" aria-label="Wizard progress">
      <ol className="crumb__list">
        {steps.map((s, i) => {
          const state = s.active ? 'active' : s.done ? 'done' : 'pending';
          const clickable = s.reachable && !s.active;
          return (
            <li key={s.label} className={`crumb__item crumb__item--${state}`}>
              <button
                type="button"
                className="crumb__node"
                onClick={() => clickable && onJump(i)}
                disabled={!clickable}
                aria-current={s.active ? 'step' : undefined}
              >
                <span className="crumb__num">{s.done ? '✓' : i + 1}</span>
                <span className="crumb__label">{s.label}</span>
              </button>
              {i < steps.length - 1 && <span className="crumb__sep" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
