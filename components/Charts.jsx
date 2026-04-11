"use client";

export function DonutChart({ segments, size = 160 }) {
  const active = segments.filter((s) => s.pct > 0);
  let cum = 0;
  const r = size / 2;
  const ir = r * 0.62;
  const toXY = (pct, radius) => {
    const a = (pct / 100) * Math.PI * 2 - Math.PI / 2;
    return [r + Math.cos(a) * radius, r + Math.sin(a) * radius];
  };
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {active.map((s, i) => {
        const start = cum;
        cum += s.pct;
        const [sx, sy] = toXY(start, ir);
        const [ex, ey] = toXY(cum, ir);
        const [sx2, sy2] = toXY(start, r - 2);
        const [ex2, ey2] = toXY(cum, r - 2);
        const large = s.pct > 50 ? 1 : 0;
        const path = `M${sx},${sy} A${ir},${ir} 0 ${large} 1 ${ex},${ey} L${ex2},${ey2} A${r - 2},${r - 2} 0 ${large} 0 ${sx2},${sy2} Z`;
        return <path key={i} d={path} fill={s.color} opacity={0.85} />;
      })}
      <circle cx={r} cy={r} r={ir - 1} fill="#151B23" />
    </svg>
  );
}

export function Sparkline({ data, width = 300, height = 80, color = "#14B8A6" }) {
  if (!data?.length) return null;
  const values = data.map((d) => (typeof d === "number" ? d : d.value));
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * width},${height - ((v - min) / range) * (height - 10) - 5}`)
    .join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block", width: "100%", height }}>
      <defs>
        <linearGradient id={`sg-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${pts} ${width},${height}`} fill={`url(#sg-${color.replace("#","")})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export function StatCard({ label, value, sub, color = "#14B8A6" }) {
  return (
    <div className="card">
      <div className="text-xs text-gray-500 mb-2">{label}</div>
      <div className="text-lg font-bold font-mono">{value}</div>
      {sub && <div className="text-xs mt-1" style={{ color }}>{sub}</div>}
    </div>
  );
}
