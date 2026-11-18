// Emberwarden — waves: what arrives, when, and from where.
//
// A wave is a queue of spawns released over its first seconds. Normal waves
// mix the enemy kinds unlocked so far; every fifth wave is a boss wave with
// a single boss and a trickle of motes. The queue is built from the seeded
// RNG, so a seed replays the same wave.

import { ARENA, ENEMIES, WAVES } from './config.js';
import { burst, makeEnemy, makePickup } from './entities.js';

export class WaveDirector {
  constructor(game) {
    this.game = game;
    this.wave = 0;
    this.state = 'idle'; // idle | breather | spawning | fighting | done
    this.queue = [];
    this.spawnTimer = 0;
    this.breatherTimer = 0;
    this.bannerTimer = 0;
    this.bossSpawned = false;
  }

  startRun() {
    this.wave = 0;
    this.nextWave();
  }

  isBossWave(wave) {
    return wave % WAVES.bossEvery === 0;
  }

  // The kinds this wave may use, from the unlock table.
  unlockedKinds(wave) {
    return WAVES.unlocks.filter((u) => u.wave <= wave).map((u) => u.kind);
  }

  nextWave() {
    this.wave += 1;
    const game = this.game;
    game.audio.setWave(this.wave);
    this.queue = this.buildQueue(this.wave);
    this.state = 'spawning';
    this.spawnTimer = 0;
    this.bannerTimer = 2.4;
    this.bossSpawned = false;
    if (this.isBossWave(this.wave)) {
      game.audio.bossWarn();
      game.addFloatText(ARENA.width / 2, 150, 'SOMETHING STIRS IN THE DARK', '#ff2d55', 26);
    } else {
      game.audio.waveStart();
    }
  }

  buildQueue(wave) {
    const rng = this.game.rng;
    const queue = [];
    if (this.isBossWave(wave)) {
      queue.push({ kind: 'boss', delay: 0.5 });
      // Motes trickle in while the boss fights.
      const motes = 4 + wave;
      for (let i = 0; i < motes; i++) {
        queue.push({ kind: 'mote', delay: 4 + i * 1.6 });
      }
      return queue;
    }
    const kinds = this.unlockedKinds(wave);
    const count = WAVES.baseCount + wave * WAVES.perWave;
    for (let i = 0; i < count; i++) {
      // Later waves weight the tougher kinds more.
      const roll = rng.float();
      let kind;
      if (roll < 0.45) kind = 'drifter';
      else if (roll < 0.7) kind = 'shade';
      else if (roll < 0.82 && kinds.includes('spitter')) kind = 'spitter';
      else if (roll < 0.92 && kinds.includes('splitter')) kind = 'splitter';
      else if (kinds.includes('brute')) kind = 'brute';
      else kind = rng.pick(kinds);
      queue.push({ kind, delay: 0.35 + rng.float() * 0.9 });
    }
    return queue;
  }

  // A spawn point on the arena edge, away from the ember and the player.
  spawnPoint() {
    const rng = this.game.rng;
    const side = rng.int(0, 3);
    const m = ARENA.margin + 24;
    let x;
    let y;
    if (side === 0) { x = rng.range(m, ARENA.width - m); y = m; }
    else if (side === 1) { x = rng.range(m, ARENA.width - m); y = ARENA.height - m; }
    else if (side === 2) { x = m; y = rng.range(m, ARENA.height - m); }
    else { x = ARENA.width - m; y = rng.range(m, ARENA.height - m); }
    return { x, y };
  }

  update(dt) {
    const game = this.game;
    this.bannerTimer = Math.max(0, this.bannerTimer - dt);

    if (this.state === 'breather') {
      this.breatherTimer -= dt;
      if (this.breatherTimer <= 0) this.nextWave();
      return;
    }
    if (this.state === 'spawning') {
      this.spawnTimer -= dt;
      if (this.queue.length > 0 && this.spawnTimer <= 0) {
        const next = this.queue.shift();
        this.spawnTimer = next.delay;
        const at = this.spawnPoint();
        const enemy = makeEnemy(next.kind, at.x, at.y);
        game.enemies.push(enemy);
        game.spawnPortal(at.x, at.y, enemy.color);
        if (next.kind === 'boss') this.bossSpawned = true;
      }
      if (this.queue.length === 0) this.state = 'fighting';
      return;
    }
    if (this.state === 'fighting') {
      if (game.enemies.length === 0) {
        this.waveCleared();
      }
    }
  }

  waveCleared() {
    const game = this.game;
    const bonus = 250 * this.wave;
    game.addScore(bonus, ARENA.width / 2, 200);
    game.addFloatText(ARENA.width / 2, 240, `WAVE ${this.wave} CLEARED  +${bonus}`, '#ffd166', 22);
    game.audio.waveClear();
    // The ember recovers a little after every clear.
    game.ember.hp = Math.min(game.ember.maxHp, game.ember.hp + 18);
    this.state = 'breather';
    this.breatherTimer = WAVES.breather;
    this.bannerTimer = 0;
    if (this.isBossWave(this.wave)) {
      game.addScore(500, ARENA.width / 2, 280);
      game.addFloatText(ARENA.width / 2, 280, 'BOSS VANQUISHED  +500', '#ff2d55', 22);
    }
  }

  // For the ?shot= demo modes: ring the player with a wave's worth of
  // enemies, drop two pickups nearby and freeze a burst mid-air, so the
  // screenshot reads as a fight in progress.
  seedBattle(wave) {
    const rng = this.game.rng;
    const kinds = this.unlockedKinds(wave);
    const count = Math.min(11, WAVES.baseCount + wave * WAVES.perWave);
    const px = this.game.player.x;
    const py = this.game.player.y;
    for (let i = 0; i < count; i++) {
      const kind = rng.pick(kinds);
      const angle = (i / count) * Math.PI * 2 + rng.range(-0.25, 0.25);
      const dist = rng.range(190, 380);
      const x = Math.max(60, Math.min(ARENA.width - 60, px + Math.cos(angle) * dist));
      const y = Math.max(60, Math.min(ARENA.height - 60, py + Math.sin(angle) * dist));
      this.game.enemies.push(makeEnemy(kind, x, y));
    }
    this.game.pickups.push(makePickup('spread', px + 130, py - 90));
    this.game.pickups.push(makePickup('health', px - 150, py + 70));
    const first = this.game.enemies[0];
    if (first) burst(this.game.particles, first.x, first.y, 14, first.color, 220, 5, 3);
    this.wave = wave;
    this.state = 'fighting';
    this.bannerTimer = 1.8;
  }

  seedBoss() {
    // The boss looms up and to the right of the player, in frame.
    const px = this.game.player.x;
    const py = this.game.player.y;
    const bx = Math.min(ARENA.width - 120, px + 300);
    const by = Math.max(120, py - 190);
    this.game.enemies.push(makeEnemy('boss', bx, by));
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + 0.4;
      this.game.enemies.push(makeEnemy(
        'mote',
        bx + Math.cos(angle) * 190,
        by + Math.sin(angle) * 190,
      ));
    }
    burst(this.game.particles, bx, by, 18, '#ff2d55', 240, 5, 3);
    this.wave = 5;
    this.state = 'fighting';
    this.bannerTimer = 1.8;
  }
}
