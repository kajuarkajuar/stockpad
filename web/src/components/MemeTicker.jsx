import { MEME_PHRASES } from "../lib/memes";

export default function MemeTicker() {
  const line = MEME_PHRASES.join("   ·   ");
  return (
    <div className="meme-ticker" aria-hidden="true">
      <div className="meme-ticker-track">
        <span>{line}</span>
        <span>{line}</span>
      </div>
    </div>
  );
}
