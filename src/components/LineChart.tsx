/** Graphe en lignes minimal, en SVG, sans dépendance. Les points null sont ignorés. */
export interface Line { name: string; color: string; values: (number | null)[] }

export function LineChart({ labels, lines, unit, height = 220 }: { labels: string[]; lines: Line[]; unit?: string; height?: number }) {
  const W = 640, H = height, L = 46, R = 12, T = 12, B = 34;
  const all = lines.flatMap((l) => l.values).filter((v): v is number => v !== null);
  if (labels.length < 2 || !all.length) return <p className="muted">Il faut au moins deux sessions pour tracer une courbe.</p>;
  const max = niceMax(Math.max(...all));
  const x = (i: number) => L + (i * (W - L - R)) / (labels.length - 1);
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const every = Math.ceil(labels.length / 8);
  const fmt = (v: number) => (v >= 10 ? Math.round(v).toString() : v.toFixed(v < 1 ? 2 : 1)).replace('.', ',');
  return (
    <figure style={{ margin: 0 }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={lines.map((l) => l.name).join(', ')}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
            <text x={L - 6} y={y(t) + 4} textAnchor="end">{fmt(t)}</text>
          </g>
        ))}
        {labels.map((lb, i) => i % every === 0 && (
          <text key={i} x={x(i)} y={H - 12} textAnchor="middle">{lb.slice(5).split('-').reverse().join('/')}</text>
        ))}
        {lines.map((l) => {
          const pts = l.values.map((v, i) => (v === null ? null : [x(i), y(v)] as const));
          const d = pts.reduce((acc, p, i) => (p ? `${acc}${acc && pts[i - 1] ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}` : acc), '');
          return (
            <g key={l.name}>
              <path d={d} fill="none" stroke={l.color} strokeWidth={2.5} strokeLinejoin="round" />
              {pts.map((p, i) => p && <circle key={i} cx={p[0]} cy={p[1]} r={3.5} fill={l.color}><title>{`${l.name} — ${labels[i]} : ${fmt(l.values[i]!)}${unit ? ' ' + unit : ''}`}</title></circle>)}
            </g>
          );
        })}
      </svg>
      {lines.length > 1 && (
        <figcaption className="legend">{lines.map((l) => <span key={l.name}><i style={{ background: l.color }} />{l.name}</span>)}</figcaption>
      )}
    </figure>
  );
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v)!;
}
