import { useMemo } from "react";
import { FLOAT_EMOJIS } from "../lib/memes";

// deterministic PRNG so the floating memes look the same on every visit
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function MemeFloat({ count = 14 }) {
  const items = useMemo(() => {
    const r = mulberry32(20260914);
    return Array.from({ length: count }, (_, i) => ({
      emoji: FLOAT_EMOJIS[i % FLOAT_EMOJIS.length],
      left: r() * 100,
      size: 22 + r() * 40,
      duration: 16 + r() * 18,
      delay: -r() * 34, // negative → already mid-flight on load
      sway: 30 + r() * 70,
      opacity: 0.08 + r() * 0.16,
    }));
  }, [count]);

  return (
    <div className="meme-float" aria-hidden="true">
      {items.map((it, i) => (
        <span
          key={i}
          className="meme-float-item"
          style={{
            left: it.left + "%",
            fontSize: it.size + "px",
            animationDuration: it.duration + "s",
            animationDelay: it.delay + "s",
            opacity: it.opacity,
            "--sway": it.sway + "px",
          }}
        >
          {it.emoji}
        </span>
      ))}
    </div>
  );
}
