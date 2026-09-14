import { useEffect, useMemo, useState } from "react";
import { RAIN_EMOJIS } from "../lib/memes";

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Shows a burst of falling emojis whenever `trigger` changes (e.g. coin created).
export default function EmojiRain({ trigger }) {
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    if (!trigger) return;
    setBurst((b) => b + 1);
  }, [trigger]);

  if (!burst) return null;
  return <Rain key={burst} />;
}

function Rain() {
  const [alive, setAlive] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setAlive(false), 4200);
    return () => clearTimeout(t);
  }, []);

  const items = useMemo(() => {
    const r = mulberry32((Math.random() * 1e9) >>> 0);
    return Array.from({ length: 46 }, () => ({
      e: RAIN_EMOJIS[Math.floor(r() * RAIN_EMOJIS.length)],
      left: r() * 100,
      dur: 2.2 + r() * 2.2,
      delay: r() * 0.9,
      size: 18 + r() * 28,
    }));
  }, []);

  if (!alive) return null;

  return (
    <div className="emoji-rain" aria-hidden="true">
      {items.map((it, i) => (
        <span
          key={i}
          style={{
            left: it.left + "%",
            fontSize: it.size + "px",
            animationDuration: it.dur + "s",
            animationDelay: it.delay + "s",
          }}
        >
          {it.e}
        </span>
      ))}
    </div>
  );
}
