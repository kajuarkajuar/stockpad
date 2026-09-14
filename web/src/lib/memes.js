// Meme culture — for the fun / "ปั่น" layers of the UI.
export const MEME_PHRASES = [
  "WAGMI 🚀",
  "To the moon 🌕",
  "Diamond hands 💎🙌",
  "Wen lambo? 🏎️",
  "NGMI 🤡",
  "Few understand 🧠",
  "Ape together strong 🦍",
  "HODL 💎",
  "Bullish on memes 🐂",
  "Ser, pls 🌝",
  "Inverse Cramer 📉",
  "GM ☕",
  "Have fun staying poor 😅",
  "Utility? Wen? 🤷",
  "Rugpull-proof™ 💪",
  "This is not financial advice 😉",
  "Printing tendies 🍗",
  "Buy high, sell low 🎢",
  "My coin, my rules 😤",
  "Chart go brrr 📈",
  "Vibes only ✨",
  "Certified degen 🐕",
];

export const FLOAT_EMOJIS = [
  "🚀", "🌕", "💎", "🐸", "🦍", "🤡", "🧠", "📈",
  "💰", "🐂", "🍌", "🔥", "✨", "🐕", "🌊", "🎯",
];

export const RAIN_EMOJIS = [
  "🚀", "🌕", "💎", "🐸", "🦍", "💰", "✨", "🎉", "🔥", "🍌", "🐕", "🌭",
];

export function randomMeme(rand = Math.random) {
  return MEME_PHRASES[Math.floor(rand() * MEME_PHRASES.length)];
}
