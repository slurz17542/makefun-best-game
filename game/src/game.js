// Emberwarden — the game itself.
//
// Game owns the state machine (title, playing, paused, over), the fixed
// 60 Hz update, every collision, the score and the stats. It is the only
// module that imports the others and tells them what to do; render.js only
// draws what is here.

import { ARENA, COMBO, EMBER, ENEMIES, PICKUPS, PLAYER, SCORE, STORAGE_KEY, VIEW } from './config.js';
import { AudioEngine } from './audio.js';
import {
  burst,
  comboMultiplier,
  makeBullet,
  makeEmber,
  makeEnemy,
  makeFloatText,
  makePickup,
  makePlayer,
  updateEnemy,
  updateFloatText,
  updateParticle,
  updatePickup,
  updatePlayer,
} from './entities.js';
import { Input } from './input.js';
import { Renderer } from './render.js';
import { Rng, randomSeed } from './random.js';
import { WaveDirector } from './waves.js';

const STEP = 1 / 60;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.input = new Input(canvas);
    this.audio = new AudioEngine();
    this.renderer = new Renderer(canvas);
    this.rng = new Rng(randomSeed());
    this.state = 'title';
    this.demo = null; // 'start' | 'play' | 'boss' | 'end' when ?shot= is set
    this.score = 0;
    this.best = 0;
    try {
      this.best = Number(window.localStorage.getItem(STORAGE_KEY) || 0) || 0;
    } catch {
      this.best = 0;
    }
    this.comboChain = 0;
    this.comboTimer = 0;
    this.stats = { kills: 0, shots: 0, hits: 0, wave: 0, bestCombo: 1 };
    this.deathCause = null;
    this.hitStop = 0;
    this.time = 0;
    this.player = makePlayer();
    this.ember = makeEmber();
    this.enemies = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.particles = [];
    this.pickups = [];
    this.floatTexts = [];
    this.waves = new WaveDirector(this);
    this.ambientTimer = 0;
    this.readShotMode();
  }

  // --- setup ---------------------------------------------------------------

  // ?shot=start|play|boss|end&seed=N stages a deterministic scene for the
  // screenshots. The seeded RNG makes the same seed render the same scene.
  readShotMode() {
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    if (!shot) return;
    const seed = Number(params.get('seed') || 1) >>> 0;
    this.rng = new Rng(seed || 1);
    this.demo = shot;
    if (shot === 'start') {
      this.state = 'title';
    } else if (shot === 'play') {
      this.state = 'playing';
      this.score = 7420;
      this.best = 12480;
      this.comboChain = 6;
      this.comboTimer = COMBO.window;
      this.stats = { kills: 58, shots: 210, hits: 148, wave: 3, bestCombo: 2.1 };
      this.player.x = ARENA.width / 2 - 120;
      this.player.y = ARENA.height / 2 + 130;
      this.waves.seedBattle(3);
      this.fireDemoBullets();
    } else if (shot === 'boss') {
      this.state = 'playing';
      this.score = 18450;
      this.best = 18200;
      this.comboChain = 3;
      this.comboTimer = COMBO.window;
      this.stats = { kills: 132, shots: 480, hits: 330, wave: 5, bestCombo: 3.4 };
      this.player.hp = 62;
      this.ember.hp = 140;
      this.player.x = ARENA.width / 2 - 200;
      this.player.y = ARENA.height / 2 + 180;
      this.waves.seedBoss();
      this.fireDemoBullets();
    } else if (shot === 'end') {
      this.state = 'over';
      this.score = 12840;
      this.best = 12840;
      this.deathCause = 'ember';
      this.stats = { kills: 143, shots: 520, hits: 310, wave: 7, bestCombo: 3.2 };
      this.ember.hp = 0;
      this.waves.wave = 7;
      this.enemies.push(makeEnemy('brute', ARENA.width / 2 + 180, ARENA.height / 2 - 90));
      this.enemies.push(makeEnemy('shade', ARENA.width / 2 - 220, ARENA.height / 2 + 60));
    }
  }

  // A few player bullets already in flight, staggered along the flight
  // path toward the nearest enemy, so the play shots look alive.
  fireDemoBullets() {
    let target = null;
    let best = Infinity;
    for (const e of this.enemies) {
      const d = (e.x - this.player.x) ** 2 + (e.y - this.player.y) ** 2;
      if (d < best) {
        best = d;
        target = e;
      }
    }
    const base = target
      ? Math.atan2(target.y - this.player.y, target.x - this.player.x)
      : -Math.PI / 2;
    this.player.angle = base;
    for (let i = 0; i < 5; i++) {
      const a = base + (i - 2) * 0.12;
      const dist = 90 + i * 55;
      this.bullets.push(makeBullet(
        this.player.x + Math.cos(a) * dist,
        this.player.y + Math.sin(a) * dist,
        Math.cos(a) * PLAYER.bulletSpeed,
        Math.sin(a) * PLAYER.bulletSpeed,
        PLAYER.bulletDamage,
        true,
      ));
    }
  }

  start() {
    this.audio.unlock();
    this.reset();
    this.state = 'playing';
    this.waves.startRun();
  }

  reset() {
    this.player = makePlayer();
    this.ember = makeEmber();
    this.enemies = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.particles = [];
    this.pickups = [];
    this.floatTexts = [];
    this.score = 0;
    this.comboChain = 0;
    this.comboTimer = 0;
    this.stats = { kills: 0, shots: 0, hits: 0, wave: 0, bestCombo: 1 };
    this.deathCause = null;
    this.hitStop = 0;
    this.waves = new WaveDirector(this);
  }

  // --- loop ----------------------------------------------------------------

  run() {
    let last = performance.now();
    let acc = 0;
    const frame = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      acc += dt;
      let steps = 0;
      while (acc >= STEP && steps < 5) {
        this.update(STEP);
        acc -= STEP;
        steps += 1;
      }
      if (steps === 5) acc = 0;
      this.renderer.render(this);
      this.input.endFrame();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  update(dt) {
    this.time += dt;
    this.renderer.update(dt);
    const input = this.input;

    if (input.mute) this.audio.setMuted(!this.audio.muted);

    if (this.state === 'title') {
      this.updateAmbient(dt);
      this.renderer.follow(this.ember.x, this.ember.y);
      if (input.confirm) this.start();
      return;
    }

    if (this.state === 'over') {
      if (input.restart || input.confirm) this.start();
      return;
    }

    if (this.state === 'paused') {
      if (input.pause || input.confirm) this.state = 'playing';
      if (input.restart) this.start();
      return;
    }

    // Playing.
    if (input.pause) {
      this.state = 'paused';
      return;
    }
    if (input.restart) {
      this.start();
      return;
    }

    // Demo screenshot modes stage a frozen scene: the world holds still so
    // the composition (bullets mid-flight, combo showing, banner up) is
    // exactly what was seeded, while the renderer keeps animating.
    if (this.demo === 'play' || this.demo === 'boss') {
      this.renderer.follow(this.player.x, this.player.y);
      return;
    }

    if (this.hitStop > 0) {
      this.hitStop -= dt;
      return;
    }

    this.waves.update(dt);
    updatePlayer(this, dt);
    for (const e of this.enemies) updateEnemy(this, e, dt);
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) b.alive = false;
      if (b.x < -60 || b.x > ARENA.width + 60 || b.y < -60 || b.y > ARENA.height + 60) b.alive = false;
    }
    for (const b of this.enemyBullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) b.alive = false;
      if (b.x < 0 || b.x > ARENA.width || b.y < 0 || b.y > ARENA.height) b.alive = false;
    }
    for (const pt of this.particles) updateParticle(pt, dt);
    for (const pk of this.pickups) updatePickup(this, pk, dt);
    for (const ft of this.floatTexts) updateFloatText(ft, dt);

    this.collide();
    this.sweep();

    // Combo decay.
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.comboChain = 0;
    }

    // Camera follows the player.
    this.renderer.follow(this.player.x, this.player.y);

    // Death checks (not in demo mode, so screenshots stay staged).
    if (!this.demo) {
      if (this.player.hp <= 0 && this.player.alive) this.gameOver('player');
      else if (this.ember.hp <= 0) this.gameOver('ember');
    }
    this.stats.wave = this.waves.wave;
  }

  // Title-screen ambience: embers drift up from the flame.
  updateAmbient(dt) {
    this.ambientTimer -= dt;
    if (this.ambientTimer <= 0) {
      this.ambientTimer = 0.12;
      const a = Math.random() * Math.PI * 2;
      const r = 20 + Math.random() * 40;
      this.particles.push({
        kind: 'particle',
        x: this.ember.x + Math.cos(a) * r,
        y: this.ember.y + Math.sin(a) * r,
        vx: (Math.random() - 0.5) * 12,
        vy: -24 - Math.random() * 30,
        life: 1.6 + Math.random(),
        maxLife: 2.2,
        size: 2 + Math.random() * 2.5,
        color: Math.random() < 0.7 ? '#ffb347' : '#ffd28a',
        drag: 1,
        alive: true,
      });
    }
    for (const pt of this.particles) updateParticle(pt, dt);
    this.particles = this.particles.filter((p) => p.alive);
  }

  // --- combat ---------------------------------------------------------------

  screenToWorld(sx, sy) {
    const rect = this.canvas.getBoundingClientRect();
    const cx = (sx / rect.width) * VIEW.width;
    const cy = (sy / rect.height) * VIEW.height;
    return { x: cx + this.renderer.camera.x, y: cy + this.renderer.camera.y };
  }

  firePlayerBullets() {
    const p = this.player;
    const speed = PLAYER.bulletSpeed;
    const base = p.angle;
    const angles = p.spreadTimer > 0 ? [-0.22, -0.11, 0, 0.11, 0.22] : [0];
    for (const off of angles) {
      const a = base + off;
      this.bullets.push(makeBullet(
        p.x + Math.cos(a) * (p.radius + 8),
        p.y + Math.sin(a) * (p.radius + 8),
        Math.cos(a) * speed,
        Math.sin(a) * speed,
        PLAYER.bulletDamage,
        true,
      ));
    }
    this.stats.shots += angles.length;
    // Muzzle flash.
    burst(this.particles, p.x + Math.cos(base) * 24, p.y + Math.sin(base) * 24, 2, '#ffe9a8', 120, 0.15, 2);
  }

  bossBurst(boss) {
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + this.time;
      this.enemyBullets.push({
        kind: 'enemyBullet',
        x: boss.x,
        y: boss.y,
        vx: Math.cos(a) * 170,
        vy: Math.sin(a) * 170,
        radius: 6,
        damage: 14,
        life: 7,
        alive: true,
      });
    }
    burst(this.particles, boss.x, boss.y, 16, '#ff2d55', 200, 0.5, 3);
    this.audio.enemyDie();
  }

  spawnPortal(x, y, color) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.particles.push({
        kind: 'particle',
        x: x + Math.cos(a) * 26,
        y: y + Math.sin(a) * 26,
        vx: Math.cos(a) * -60,
        vy: Math.sin(a) * -60,
        life: 0.4,
        maxLife: 0.4,
        size: 3,
        color,
        drag: 0.9,
        alive: true,
      });
    }
  }

  spawnThrust(p, n) {
    for (let i = 0; i < n; i++) {
      const back = Math.atan2(p.vy, p.vx) + Math.PI;
      const a = back + (Math.random() - 0.5) * 0.9;
      this.particles.push({
        kind: 'particle',
        x: p.x + Math.cos(a) * 10,
        y: p.y + Math.sin(a) * 10,
        vx: Math.cos(a) * 120,
        vy: Math.sin(a) * 120,
        life: 0.35,
        maxLife: 0.35,
        size: 2.5,
        color: '#7df9ff',
        drag: 0.9,
        alive: true,
      });
    }
  }

  collide() {
    const p = this.player;
    const ember = this.ember;

    // Player bullets vs enemies.
    for (const b of this.bullets) {
      if (!b.alive) continue;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const dx = b.x - e.x;
        const dy = b.y - e.y;
        const rr = e.radius + b.radius;
        if (dx * dx + dy * dy < rr * rr) {
          b.alive = false;
          this.stats.hits += 1;
          this.damageEnemy(e, b.damage, b.x, b.y);
          break;
        }
      }
    }

    // Enemy bullets vs player and ember.
    for (const b of this.enemyBullets) {
      if (!b.alive) continue;
      if (p.alive && p.invuln <= 0) {
        const dx = b.x - p.x;
        const dy = b.y - p.y;
        const rr = p.radius + b.radius;
        if (dx * dx + dy * dy < rr * rr) {
          b.alive = false;
          this.damagePlayer(b.damage);
          continue;
        }
      }
      const ex = b.x - ember.x;
      const ey = b.y - ember.y;
      const er = ember.radius + b.radius;
      if (ex * ex + ey * ey < er * er) {
        b.alive = false;
        this.damageEmber(b.damage * 0.6);
      }
    }

    // Enemies vs player (contact) and vs ember (they burn in the flame).
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (p.alive) {
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const rr = e.radius + p.radius;
        if (dx * dx + dy * dy < rr * rr) {
          if (p.invuln <= 0) this.damagePlayer(e.damage);
          // Knock the enemy back so it does not sit on the player.
          const d = Math.hypot(dx, dy) || 1;
          e.x += (dx / d) * 26;
          e.y += (dy / d) * 26;
          this.damageEnemy(e, 8, e.x, e.y);
        }
      }
      const ex = e.x - ember.x;
      const ey = e.y - ember.y;
      const er = e.radius + ember.radius * 0.85;
      if (ex * ex + ey * ey < er * er) {
        if (e.kind === 'boss') {
          // The boss chews the flame instead of burning in it.
          this.damageEmber(e.damage * STEP);
        } else {
          this.damageEmber(e.damage * STEP * 3);
          this.damageEnemy(e, 60 * STEP, e.x, e.y);
          if (Math.random() < 0.3) {
            burst(this.particles, e.x, e.y, 2, '#ffb347', 120, 0.4, 2.5);
          }
        }
      }
    }

    // Pickups vs player.
    for (const pk of this.pickups) {
      if (!pk.alive || !p.alive) continue;
      const dx = pk.x - p.x;
      const dy = pk.y - p.y;
      const rr = PLAYER.pickupRadius + pk.radius;
      if (dx * dx + dy * dy < rr * rr) {
        pk.alive = false;
        this.applyPickup(pk.pickupKind);
      }
    }
  }

  sweep() {
    this.enemies = this.enemies.filter((e) => e.alive);
    this.bullets = this.bullets.filter((b) => b.alive);
    this.enemyBullets = this.enemyBullets.filter((b) => b.alive);
    this.particles = this.particles.filter((pt) => pt.alive);
    this.pickups = this.pickups.filter((pk) => pk.alive);
    this.floatTexts = this.floatTexts.filter((ft) => ft.alive);
  }

  damageEnemy(e, damage, hx, hy) {
    e.hp -= damage;
    e.flash = 1;
    burst(this.particles, hx, hy, 3, '#ffffff', 140, 0.25, 2);
    if (e.hp <= 0) {
      e.alive = false;
      this.killEnemy(e);
    } else {
      this.audio.enemyHit();
    }
  }

  killEnemy(e) {
    const mult = comboMultiplier(this);
    const points = Math.round(e.score * mult);
    this.addScore(points, e.x, e.y);
    this.addFloatText(e.x, e.y - 10, `+${points}`, '#ffd166', e.kind === 'boss' ? 26 : 15);
    this.stats.kills += 1;
    // Chain the combo.
    this.comboChain += 1;
    this.comboTimer = COMBO.window;
    this.stats.bestCombo = Math.max(this.stats.bestCombo, comboMultiplier(this));
    // Death burst, sized to the enemy.
    const big = e.maxHp >= 100;
    burst(this.particles, e.x, e.y, big ? 34 : 16, e.color, big ? 320 : 220, 0.7, big ? 4 : 3);
    burst(this.particles, e.x, e.y, 8, '#ffffff', 160, 0.3, 2);
    this.renderer.addShake(big ? 0.45 : 0.16);
    if (big) {
      this.hitStop = 0.045;
      this.audio.bigDie();
    } else {
      this.audio.enemyDie();
    }
    // Splitters break into motes.
    if (e.kind === 'splitter') {
      for (let i = 0; i < ENEMIES.splitter.children; i++) {
        const mote = makeEnemy('mote', e.x + (Math.random() - 0.5) * 30, e.y + (Math.random() - 0.5) * 30);
        this.enemies.push(mote);
      }
    }
    // Drops.
    if (this.rng.chance(PICKUPS.dropChance)) {
      const kind = this.rng.weighted(PICKUPS.kinds, PICKUPS.weights);
      this.pickups.push(makePickup(kind, e.x, e.y));
    }
  }

  damagePlayer(amount) {
    const p = this.player;
    if (p.shieldTimer > 0) {
      this.audio.enemyHit();
      burst(this.particles, p.x, p.y, 8, '#a78bfa', 180, 0.4, 3);
      return;
    }
    p.hp -= amount;
    p.invuln = PLAYER.invulnTime;
    this.renderer.addShake(0.35);
    burst(this.particles, p.x, p.y, 14, '#7df9ff', 240, 0.5, 3);
    this.audio.playerHurt();
    this.comboChain = 0;
    this.comboTimer = 0;
  }

  damageEmber(amount) {
    this.ember.hp -= amount;
    this.ember.pulse += 0.4;
    if (Math.random() < 0.15) this.audio.emberHurt();
  }

  applyPickup(kind) {
    const p = this.player;
    this.audio.pickup();
    if (kind === 'health') {
      // Heal whichever light is hurting more.
      if (p.hp < this.ember.hp) p.hp = Math.min(p.maxHp, p.hp + PICKUPS.healthHeal);
      else this.ember.hp = Math.min(this.ember.maxHp, this.ember.hp + PICKUPS.healthHeal);
      this.addFloatText(p.x, p.y - 24, `+${PICKUPS.healthHeal} HP`, '#4ade80', 17);
    } else if (kind === 'spread') {
      p.spreadTimer = PICKUPS.spreadTime;
      this.addFloatText(p.x, p.y - 24, 'SPREAD SHOT!', '#facc15', 17);
    } else if (kind === 'rapid') {
      p.rapidTimer = PICKUPS.rapidTime;
      this.addFloatText(p.x, p.y - 24, 'RAPID FIRE!', '#38bdf8', 17);
    } else if (kind === 'shield') {
      p.shieldTimer = PICKUPS.shieldTime;
      this.addFloatText(p.x, p.y - 24, 'SHIELD!', '#a78bfa', 17);
    } else if (kind === 'bomb') {
      // A nova that hurts every enemy on screen.
      burst(this.particles, p.x, p.y, 40, '#fb923c', 420, 0.8, 4);
      this.renderer.addShake(0.5);
      this.audio.bigDie();
      for (const e of [...this.enemies]) {
        if (e.kind !== 'boss') this.damageEnemy(e, 120, e.x, e.y);
        else this.damageEnemy(e, 60, e.x, e.y);
      }
      this.addFloatText(p.x, p.y - 24, 'NOVA!', '#fb923c', 20);
    }
    burst(this.particles, p.x, p.y, 10, '#ffffff', 160, 0.4, 2.5);
  }

  addScore(points, x, y) {
    this.score += points;
    if (x !== undefined) this.addFloatText(x, y - 18, `+${points}`, '#ffd166', 15);
  }

  addFloatText(x, y, text, color, size = 15) {
    this.floatTexts.push(makeFloatText(x, y, text, color, size));
  }

  gameOver(cause) {
    this.state = 'over';
    this.deathCause = cause;
    this.player.alive = cause !== 'player';
    if (this.score > this.best) {
      this.best = this.score;
      try {
        window.localStorage.setItem(STORAGE_KEY, String(this.best));
      } catch {
        // Storage may be unavailable; the best score just does not persist.
      }
    }
    this.audio.gameOver();
    this.renderer.addShake(0.6);
    burst(this.particles, this.ember.x, this.ember.y, 60, '#ff7a1a', 380, 1.1, 4);
    burst(this.particles, this.ember.x, this.ember.y, 30, '#ffd28a', 220, 0.9, 3);
  }
}
