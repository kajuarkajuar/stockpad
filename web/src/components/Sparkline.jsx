import { useMemo } from "react";
import { sparklinePoints } from "../lib/sparkline";

// Catmull-Rom → cubic bezier for a smooth, Apple-grade curve
function smoothPath(pts) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export default function Sparkline({ address, width = 140, height = 44, fill = true }) {
  const { line, area, lastX, lastY, color } = useMemo(() => {
    const pts = sparklinePoints(address, 48);
    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const range = max - min || 1;
    const step = width / (pts.length - 1);
    const xy = pts.map((v, i) => [i * step, height - 3 - ((v - min) / range) * (height - 8)]);
    const up = pts[pts.length - 1] >= pts[0];
    const color = up ? "#0fa95c" : "#f03e3e";
    const line = smoothPath(xy);
    const area = fill ? `${line} L ${width},${height} L 0,${height} Z` : "";
    return { line, area, lastX: xy[xy.length - 1][0], lastY: xy[xy.length - 1][1], color };
  }, [address, width, height, fill]);

  const gid = useMemo(() => "g" + Math.abs(seed(address)) % 100000, [address]);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${gid})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="2.6" fill={color} />
    </svg>
  );
}

function seed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
