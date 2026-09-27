// Deterministic randomness keyed by a string. Anything derived through it is
// identical on every load, so it never needs to be written into a save.

export function hashSeed(str) {
  let h = 2166136261;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32: a fast, well-distributed 32-bit generator returning [0, 1). */
export function seededRng(key) {
  let a = typeof key === 'number' ? key >>> 0 : hashSeed(key);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
