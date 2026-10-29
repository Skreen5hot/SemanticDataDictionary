// Seeded PRNG for the OS-3 property harness (mulberry32 over a 32-bit hash of the seed string).
// Every generator takes an Rng so that a recorded seed reproduces its input exactly.
export function hash32(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
export class Rng {
  constructor(seed) { this.seed = String(seed); this.s = hash32(this.seed) || 1; }
  next() { let t = (this.s = (this.s + 0x6d2b79f5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  int(lo, hi) { return lo + Math.floor(this.next() * (hi - lo + 1)); } // inclusive
  bool(p = 0.5) { return this.next() < p; }
  pick(a) { return a[Math.floor(this.next() * a.length)]; }
  shuffle(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
  sample(a, k) { return this.shuffle(a).slice(0, Math.min(k, a.length)); }
  fork(tag) { return new Rng(`${this.seed}/${tag}`); }
}
