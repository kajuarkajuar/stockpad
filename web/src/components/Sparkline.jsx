import { sparklinePoints } from "../lib/sparkline";

export default function Sparkline({ address, up = true, width = 120, height = 36 }) {
  const pts = sparklinePoints(address, 48);
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const step = width / (pts.length - 1);
  const xy = pts
    .map((v, i) => `${(i * step).toFixed(1)},${(height - 4 - ((v - min) / range) * (height - 8)).toFixed(1)}`)
    .join(" ");
  const color = up ? "#00c805" : "#ff5000";
  const last = pts[pts.length - 1];
  const lastY = height - 4 - ((last - min) / range) * (height - 8);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      <polyline points={xy} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={width - 1} cy={lastY} r="1.8" fill={color} />
    </svg>
  );
}
