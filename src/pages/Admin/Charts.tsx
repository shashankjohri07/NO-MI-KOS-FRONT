/**
 * Tiny dependency-free SVG charts for the admin dashboard. Kept inline (no
 * chart library) to match the codebase's lean-dependency philosophy.
 */

interface Point {
  date: string; // YYYY-MM-DD
  count: number;
}

const INK = '#1a1a1a';
const GOLD = '#b8962e';

function dayLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export function BarChart({ data }: { data: Point[] }) {
  const W = 520;
  const H = 160;
  const padB = 22;
  const padT = 10;
  const max = Math.max(1, ...data.map((d) => d.count));
  const n = data.length || 1;
  const slot = W / n;
  const barW = Math.max(4, slot * 0.6);

  return (
    <svg className="adm__svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img"
         aria-label="New users per day, last 14 days">
      {data.map((d, i) => {
        const h = ((H - padB - padT) * d.count) / max;
        const x = i * slot + (slot - barW) / 2;
        const y = H - padB - h;
        return (
          <g key={d.date}>
            <rect x={x} y={y} width={barW} height={h} rx={2} fill={INK} opacity={d.count ? 0.85 : 0.12} />
            {d.count > 0 && (
              <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize="9" fill={INK}>{d.count}</text>
            )}
            {(i % 2 === 0 || i === n - 1) && (
              <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize="8" fill="#999">
                {dayLabel(d.date)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function LineChart({ data }: { data: Point[] }) {
  const W = 520;
  const H = 160;
  const padB = 22;
  const padT = 10;
  const padX = 6;
  const max = Math.max(1, ...data.map((d) => d.count));
  const min = Math.min(...data.map((d) => d.count), 0);
  const n = data.length;
  const innerW = W - padX * 2;
  const innerH = H - padB - padT;
  const x = (i: number) => padX + (n <= 1 ? innerW / 2 : (innerW * i) / (n - 1));
  const y = (v: number) => padT + innerH - (innerH * (v - min)) / (max - min || 1);

  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d.count).toFixed(1)}`).join(' ');
  const area = `${line} L ${x(n - 1).toFixed(1)} ${(H - padB).toFixed(1)} L ${x(0).toFixed(1)} ${(H - padB).toFixed(1)} Z`;

  return (
    <svg className="adm__svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img"
         aria-label="Total users growth over the last 14 days">
      <defs>
        <linearGradient id="admFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={GOLD} stopOpacity="0.25" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#admFill)" />
      <path d={line} fill="none" stroke={GOLD} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) =>
        i === n - 1 ? (
          <g key={d.date}>
            <circle cx={x(i)} cy={y(d.count)} r="3.5" fill={GOLD} />
            <text x={x(i)} y={y(d.count) - 7} textAnchor="end" fontSize="10" fill={INK} fontWeight="bold">
              {d.count}
            </text>
          </g>
        ) : null,
      )}
      {data.map((d, i) =>
        i % 2 === 0 || i === n - 1 ? (
          <text key={`l${d.date}`} x={x(i)} y={H - 6} textAnchor="middle" fontSize="8" fill="#999">
            {dayLabel(d.date)}
          </text>
        ) : null,
      )}
    </svg>
  );
}
