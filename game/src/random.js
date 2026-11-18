// Emberwarden — small seeded random number generator.
//
// The game is deterministic for a given seed: the same seed plays the same
// waves, so screenshot mode (?shot=...&seed=N) always renders the same scene
// and a run can be reproduced. mulberry32 is tiny, fast and good enough for
// spawning and jitter; it is not used for anything that needs real entropy.

export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A convenience wrapper with the helpers the game uses everywhere.
export class Rng {
  constructor(seed) {
    this.next = makeRng(seed);
  }

  // Float in [0, 1).
  float() {
    return this.next();
  }

  // Float in [min, max).
  range(min, max) {
    return min + this.next() * (max - min);
  }

  // Integer in [min, max] inclusive.
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  // True with probability p.
  chance(p) {
    return this.next() < p;
  }

  // One element of an array, uniformly.
  pick(array) {
    return array[Math.floor(this.next() * array.length)];
  }

  // One element of an array, weighted by a {key: weight} table.
  weighted(keys, weights) {
    let total = 0;
    for (const key of keys) total += weights[key] || 0;
    let roll = this.next() * total;
    for (const key of keys) {
      roll -= weights[key] || 0;
      if (roll <= 0) return key;
    }
    return keys[keys.length - 1];
  }

  // Angle in radians, uniform over the circle.
  angle() {
    return this.next() * Math.PI * 2;
  }
}

// A seed from the clock, for ordinary play.
export function randomSeed() {
  return (Math.random() * 0xffffffff) >>> 0;
}
