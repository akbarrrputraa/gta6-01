// Small shared helpers: seeded random numbers, clamps and angle maths.
// Every system in Solmar Bay imports from here so the city, traffic and
// missions all agree on one deterministic seed.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick one item from an array with a seeded random function. */
export function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length)];
}

/** Integer in [min, max] from a seeded random function. */
export function randInt(rand, min, max) {
  return min + Math.floor(rand() * (max - min + 1));
}

/** Float in [min, max) from a seeded random function. */
export function randRange(rand, min, max) {
  return min + rand() * (max - min);
}

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Shortest signed angle difference, in radians. */
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Move `a` toward `b` by at most `step` radians, wrapping correctly. */
export function angleStep(a, b, step) {
  const d = angleDiff(a, b);
  if (Math.abs(d) <= step) return b;
  return a + Math.sign(d) * step;
}

/** 2D distance between two {x, z} points. */
export function dist2(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

/** Format a cash amount like $1,250. */
export function fmtCash(n) {
  return '$' + Math.floor(n).toLocaleString('en-US');
}
