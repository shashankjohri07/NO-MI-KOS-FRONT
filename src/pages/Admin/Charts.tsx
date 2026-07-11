/**
 * Dependency-free SVG charts for the admin dashboard.
 * Bar, Line, Donut, and mini sparkline charts.
 */

interface Point {
  date: string;
  count: number;
}

const INK = '#1a1a1a';
const GOLD = '#b8962e';
const GOLD_LIGHT = '#d4b44a';
const GRID = '#e8e2d4';

function dayLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export function BarChart({ data }: { data: Point[] }) {
  const W = 520;
  const H = 180;
  const padB = 28;
  const padT = 16;
  const padL = 32;
  const max = Math.max(1, ...data.map((d) => d.count));
  const n = data.length || 1;
  const innerW = W - padL;
  const slot = innerW / n;
  const barW = Math.max(6, slot * 0.55);
  const gridLines = 4;

  return (
    <svg className="adm__svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img"
         aria-label="New users per day, last 14 days">
      {Array.from({ length: gridLines + 1 }).map((_, i) => {
        const y = padT + ((H - padB - padT) * i) / gridLines;
        const val = Math.round(max - (max * i) / gridLines);
        return (
          <g key={`g${i}`}>
            <line x1={padL} y1={y} x2={W} y2={y} stroke={GRID} strokeWidth="0.7" strokeDasharray={i === gridLines ? 'none' : '3,3'} />
            <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="8" fill="#aaa" fontFamily="var(--sans)">{val}</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const h = ((H - padB - padT) * d.count) / max;
        const x = padL + i * slot + (slot - barW) / 2;
        const y = H - padB - h;
        return (
          <g key={d.date}>
            <rect x={x} y={y} width={barW} height={h} rx={3} fill={d.count ? `url(#barGrad)` : '#f0ece2'} />
            {d.count > 0 && (
              <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize="9" fill={INK} fontWeight="600"
                    fontFamily="var(--sans)">{d.count}</text>
            )}
            {(i % 2 === 0 || i === n - 1) && (
              <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize="8" fill="#aaa"
                    fontFamily="var(--sans)">{dayLabel(d.date)}</text>
            )}
          </g>
        );
      })}
      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={INK} stopOpacity="0.9" />
          <stop offset="100%" stopColor={INK} stopOpacity="0.6" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function LineChart({ data }: { data: Point[] }) {
  const W = 520;
  const H = 180;
  const padB = 28;
  const padT = 16;
  const padL = 32;
  const padR = 8;
  const max = Math.max(1, ...data.map((d) => d.count));
  const min = Math.min(...data.map((d) => d.count), 0);
  const n = data.length;
  const innerW = W - padL - padR;
  const innerH = H - padB - padT;
  const x = (i: number) => padL + (n <= 1 ? innerW / 2 : (innerW * i) / (n - 1));
  const y = (v: number) => padT + innerH - (innerH * (v - min)) / (max - min || 1);
  const gridLines = 4;

  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d.count).toFixed(1)}`).join(' ');
  const area = `${line} L ${x(n - 1).toFixed(1)} ${(H - padB).toFixed(1)} L ${x(0).toFixed(1)} ${(H - padB).toFixed(1)} Z`;

  return (
    <svg className="adm__svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img"
         aria-label="Total users growth over the last 14 days">
      <defs>
        <linearGradient id="admFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={GOLD} stopOpacity="0.2" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {Array.from({ length: gridLines + 1 }).map((_, i) => {
        const yPos = padT + (innerH * i) / gridLines;
        const val = Math.round(max - ((max - min) * i) / gridLines);
        return (
          <g key={`g${i}`}>
            <line x1={padL} y1={yPos} x2={W - padR} y2={yPos} stroke={GRID} strokeWidth="0.7"
                  strokeDasharray={i === gridLines ? 'none' : '3,3'} />
            <text x={padL - 6} y={yPos + 3} textAnchor="end" fontSize="8" fill="#aaa" fontFamily="var(--sans)">{val}</text>
          </g>
        );
      })}
      <path d={area} fill="url(#admFill)" />
      <path d={line} fill="none" stroke={GOLD} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <g key={d.date}>
          {i === n - 1 && (
            <>
              <circle cx={x(i)} cy={y(d.count)} r="5" fill="#fff" stroke={GOLD} strokeWidth="2.5" />
              <text x={x(i) - 8} y={y(d.count) - 10} textAnchor="end" fontSize="11" fill={INK} fontWeight="700"
                    fontFamily="var(--sans)">{d.count}</text>
            </>
          )}
          {i !== n - 1 && i % 3 === 0 && (
            <circle cx={x(i)} cy={y(d.count)} r="2" fill={GOLD_LIGHT} opacity="0.6" />
          )}
          {(i % 3 === 0 || i === n - 1) && (
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="8" fill="#aaa"
                  fontFamily="var(--sans)">{dayLabel(d.date)}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

export function DonutChart({ value, max, label, color = GOLD }: {
  value: number; max: number; label: string; color?: string;
}) {
  const size = 100;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const offset = c * (1 - pct);

  return (
    <div className="adm__donut">
      <svg viewBox={`0 0 ${size} ${size}`} width="80" height="80">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f0ece2" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
                strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
        <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="central"
              fontSize="18" fontWeight="700" fill={INK} fontFamily="var(--sans)">
          {Math.round(pct * 100)}%
        </text>
      </svg>
      <span className="adm__donut-label">{label}</span>
    </div>
  );
}

export function MiniSparkline({ data, color = GOLD }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const W = 80;
  const H = 28;
  const max = Math.max(1, ...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (W * i) / (data.length - 1);
    const y = H - 2 - ((H - 4) * (v - min)) / range;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="adm__sparkline">
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.8"
                strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
