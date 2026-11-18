// Emberwarden — tuning constants and palette.
// One place for every number that shapes how the game feels, so balancing
// never means hunting through the update code.

export const VIEW = { width: 1280, height: 720 };

// The arena is a little larger than the view; the camera follows the player.
export const ARENA = { width: 1600, height: 1000, margin: 40 };

export const PALETTE = {
  background: '#0a0817',
  backgroundEdge: '#07060e',
  arenaLine: 'rgba(120, 100, 255, 0.16)',
  grid: 'rgba(120, 100, 255, 0.05)',
  emberCore: '#ffb347',
  emberGlow: '#ff7a1a',
  emberRing: '#ffd28a',
  player: '#7df9ff',
  playerCore: '#eaffff',
  playerTrail: 'rgba(125, 249, 255, 0.35)',
  bullet: '#ffe9a8',
  bulletGlow: '#ffb347',
  shade: '#b537f2',
  shadeDark: '#6d28a8',
  drifter: '#c084fc',
  spitter: '#f472b6',
  splitter: '#e879f9',
  brute: '#ef4444',
  boss: '#ff2d55',
  pickupHealth: '#4ade80',
  pickupSpread: '#facc15',
  pickupRapid: '#38bdf8',
  pickupShield: '#a78bfa',
  pickupBomb: '#fb923c',
  text: '#f3efff',
  textDim: '#a89fd6',
  textGold: '#ffd166',
  danger: '#ff4d6d',
  waveBanner: '#ffd166',
};

export const PLAYER = {
  radius: 14,
  speed: 330,            // px per second
  accel: 2600,
  friction: 0.86,        // velocity retained per 1/60s step
  maxHp: 100,
  fireInterval: 0.14,    // seconds between shots
  bulletSpeed: 720,
  bulletDamage: 12,
  bulletRadius: 5,
  dashSpeed: 900,
  dashTime: 0.16,
  dashCooldown: 1.4,
  invulnTime: 0.9,       // seconds of mercy after a hit
  pickupRadius: 26,
};

export const EMBER = {
  x: ARENA.width / 2,
  y: ARENA.height / 2,
  radius: 34,
  maxHp: 200,
  // The ember slowly heals between waves, so a good clear is rewarded.
  regenPerWave: 18,
};

export const ENEMIES = {
  drifter:  { hp: 22,  speed: 78,  radius: 15, score: 50,  damage: 10, color: PALETTE.drifter },
  shade:    { hp: 16,  speed: 118, radius: 12, score: 60,  damage: 8,  color: PALETTE.shade },
  spitter:  { hp: 30,  speed: 62,  radius: 16, score: 90,  damage: 12, color: PALETTE.spitter, shootInterval: 2.4, bulletSpeed: 210 },
  splitter: { hp: 34,  speed: 88,  radius: 18, score: 100, damage: 12, color: PALETTE.splitter, children: 2 },
  brute:    { hp: 150, speed: 46,  radius: 26, score: 200, damage: 22, color: PALETTE.brute },
  mote:     { hp: 8,   speed: 165, radius: 8,  score: 25,  damage: 5,  color: PALETTE.shadeDark },
  boss:     { hp: 1400, speed: 40, radius: 46, score: 1500, damage: 30, color: PALETTE.boss },
};

export const WAVES = {
  // How many shades arrive in a normal wave, before the wave's mix is added.
  baseCount: 6,
  perWave: 3,
  // Seconds of calm between waves.
  breather: 3.5,
  // Every 5th wave is a boss wave.
  bossEvery: 5,
  // Enemy mix unlocks as waves climb.
  unlocks: [
    { wave: 1, kind: 'drifter' },
    { wave: 1, kind: 'shade' },
    { wave: 2, kind: 'spitter' },
    { wave: 3, kind: 'splitter' },
    { wave: 4, kind: 'brute' },
    { wave: 6, kind: 'mote' },
  ],
};

export const PICKUPS = {
  dropChance: 0.14,      // chance an enemy drops something
  lifeSeconds: 9,
  kinds: ['health', 'spread', 'rapid', 'shield', 'bomb'],
  weights: { health: 0.3, spread: 0.22, rapid: 0.2, shield: 0.16, bomb: 0.12 },
  spreadTime: 10,        // seconds a spread shot lasts
  rapidTime: 10,         // seconds rapid fire lasts
  shieldTime: 12,        // seconds a shield lasts
  healthHeal: 30,        // hp restored (player or ember, whichever is lower)
};

export const COMBO = {
  window: 2.2,           // seconds between kills to keep the chain alive
  step: 0.1,             // multiplier gained per chained kill
  cap: 4.0,              // maximum multiplier
};

export const FX = {
  shakeDecay: 6.0,       // shake trauma lost per second
  hitStop: 0.045,        // freeze seconds on a brute/boss kill
  maxParticles: 600,
};

export const SCORE = {
  waveClear: 250,        // bonus per wave cleared, times the wave number
  bossBonus: 500,
};

export const STORAGE_KEY = 'emberwarden.best.v1';
