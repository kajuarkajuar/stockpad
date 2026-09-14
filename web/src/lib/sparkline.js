// Deterministic pseudo-random sparkline so every coin gets a stable fake chart
// until a real indexer is wired in.
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFrom(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function sparklinePoints(address, n = 48) {
  const rand = mulberry32(seedFrom(address));
  const pts = [];
  let v = 50;
  for (let i = 0; i < n; i++) {
    v += (rand() - 0.48) * 12;
    v = Math.max(8, Math.min(96, v));
    pts.push(v);
  }
  return pts;
}

// deterministic fake % move (matches the sparkline's first→last direction)
export function trendOf(address) {
  const pts = sparklinePoints(address);
  const first = pts[0];
  const last = pts[pts.length - 1];
  const pct = ((last - first) / first) * 100;
  return { pct: Math.round(pct * 10) / 10, up: pct >= 0 };
}
