// Emberwarden — every moving thing in the arena.
//
// Entities are plain objects kept in arrays on the Game; this module makes
// them and moves them. It knows nothing about screens or drawing — render.js
// draws whatever is here, and game.js decides what happens when things meet.

import { ARENA, COMBO, EMBER, ENEMIES, PICKUPS, PLAYER } from './config.js';

// --- factories ------------------------------------------------------------

export function makePlayer() {
  return {
    kind: 'player',
    x: ARENA.width / 2,
    y: ARENA.height / 2 + 170,
    vx: 0,
    vy: 0,
    radius: PLAYER.radius,
    hp: PLAYER.maxHp,
    maxHp: PLAYER.maxHp,
    angle: -Math.PI / 2,
    fireTimer: 0,
    dashTimer: 0,
    dashCooldown: 0,
    dashX: 0,
    dashY: 0,
    invuln: 0,
    spreadTimer: 0,
    rapidTimer: 0,
    shieldTimer: 0,
    thrust: 0,
    alive: true,
  };
}

export function makeEmber() {
  return {
    kind: 'ember',
    x: EMBER.x,
    y: EMBER.y,
    radius: EMBER.radius,
    hp: EMBER.maxHp,
    maxHp: EMBER.maxHp,
    pulse: 0,
  };
}

export function makeEnemy(kind, x, y) {
  const def = ENEMIES[kind];
  return {
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: def.radius,
    hp: def.hp,
    maxHp: def.hp,
    speed: def.speed,
    score: def.score,
    damage: def.damage,
    color: def.color,
    shootTimer: def.shootInterval ? def.shootInterval * (0.6 + Math.random() * 0.8) : 0,
    flash: 0,
    wobble: Math.random() * Math.PI * 2,
    angle: 0,
    alive: true,
  };
}

export function makeBullet(x, y, vx, vy, damage, friendly) {
  return {
    kind: 'bullet',
    x,
    y,
    vx,
    vy,
    radius: PLAYER.bulletRadius,
    damage,
    friendly,
    life: 2.5,
    alive: true,
  };
}

export function makeEnemyBullet(x, y, vx, vy, damage) {
  return {
    kind: 'enemyBullet',
    x,
    y,
    vx,
    vy,
    radius: 6,
    damage,
    life: 6,
    alive: true,
  };
}

export function makeParticle(x, y, vx, vy, life, size, color, drag = 0.92) {
  return {
    kind: 'particle',
    x,
    y,
    vx,
    vy,
    life,
    maxLife: life,
    size,
    color,
    drag,
    alive: true,
  };
}

export function makePickup(kind, x, y) {
  return {
    kind: 'pickup',
    pickupKind: kind,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: 13,
    life: PICKUPS.lifeSeconds,
    bob: Math.random() * Math.PI * 2,
    alive: true,
  };
}

export function makeFloatText(x, y, text, color, size = 15) {
  return {
    kind: 'floatText',
    x,
    y,
    text,
    color,
    size,
    life: 0.9,
    maxLife: 0.9,
    alive: true,
  };
}

// --- helpers --------------------------------------------------------------

export function distanceSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function clampToArena(e, margin = ARENA.margin) {
  e.x = Math.max(margin, Math.min(ARENA.width - margin, e.x));
  e.y = Math.max(margin, Math.min(ARENA.height - margin, e.y));
}

export function burst(particles, x, y, count, color, speed, life = 0.6, size = 3) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    particles.push(makeParticle(
      x, y,
      Math.cos(a) * s, Math.sin(a) * s,
      life * (0.5 + Math.random() * 0.7),
      size * (0.6 + Math.random() * 0.8),
      color,
    ));
  }
  if (particles.length > 600) particles.splice(0, particles.length - 600);
}

// --- updates --------------------------------------------------------------

// The player: acceleration movement, dash, firing, timers.
export function updatePlayer(game, dt) {
  const p = game.player;
  if (!p.alive) return;
  const input = game.input;
  const move = input.moveVector();

  if (p.dashTimer > 0) {
    p.dashTimer -= dt;
    p.vx = p.dashX * PLAYER.dashSpeed;
    p.vy = p.dashY * PLAYER.dashSpeed;
    game.spawnThrust(p, 2);
  } else {
    p.vx += move.x * PLAYER.accel * dt;
    p.vy += move.y * PLAYER.accel * dt;
    const f = Math.pow(PLAYER.friction, dt * 60);
    p.vx *= f;
    p.vy *= f;
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > PLAYER.speed) {
      p.vx = (p.vx / speed) * PLAYER.speed;
      p.vy = (p.vy / speed) * PLAYER.speed;
    }
    p.thrust = Math.min(1, speed / PLAYER.speed);
    if (p.thrust > 0.2) game.spawnThrust(p, 1);
  }
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  clampToArena(p, ARENA.margin + p.radius);

  // Aim at the mouse (in world coordinates).
  const aim = game.screenToWorld(input.mouseX, input.mouseY);
  p.angle = Math.atan2(aim.y - p.y, aim.x - p.x);

  // Dash on Shift, in the movement direction (or the aim direction).
  p.dashCooldown = Math.max(0, p.dashCooldown - dt);
  if (input.dash && p.dashCooldown <= 0 && p.dashTimer <= 0) {
    let dx = move.x;
    let dy = move.y;
    if (dx === 0 && dy === 0) {
      dx = Math.cos(p.angle);
      dy = Math.sin(p.angle);
    }
    const len = Math.hypot(dx, dy);
    p.dashX = dx / len;
    p.dashY = dy / len;
    p.dashTimer = PLAYER.dashTime;
    p.dashCooldown = PLAYER.dashCooldown;
    p.invuln = Math.max(p.invuln, 0.25);
    game.audio.dash();
    burst(game.particles, p.x, p.y, 14, '#7df9ff', 260, 0.4, 3);
  }

  // Fire while the mouse (or Space) is held.
  p.fireTimer -= dt;
  const interval = p.rapidTimer > 0 ? PLAYER.fireInterval * 0.55 : PLAYER.fireInterval;
  if (input.firing && p.fireTimer <= 0) {
    p.fireTimer = interval;
    game.firePlayerBullets();
    game.audio.shoot();
  }

  p.invuln = Math.max(0, p.invuln - dt);
  p.spreadTimer = Math.max(0, p.spreadTimer - dt);
  p.rapidTimer = Math.max(0, p.rapidTimer - dt);
  p.shieldTimer = Math.max(0, p.shieldTimer - dt);
}

// One enemy: steer toward its target, shoot if it is a spitter, wobble.
export function updateEnemy(game, e, dt) {
  const p = game.player;
  const ember = game.ember;
  e.flash = Math.max(0, e.flash - dt * 6);
  e.wobble += dt * 3;

  let tx = p.x;
  let ty = p.y;
  if (e.kind === 'shade' || e.kind === 'brute') {
    // Shades and brutes hunt the ember; the rest hunt the player.
    tx = ember.x;
    ty = ember.y;
  }
  const dx = tx - e.x;
  const dy = ty - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  const wobble = e.kind === 'drifter' ? Math.sin(e.wobble) * 0.5 : 0;
  const ax = dx / dist + -dy / dist * wobble * 0.4;
  const ay = dy / dist + dx / dist * wobble * 0.4;
  const alen = Math.hypot(ax, ay) || 1;
  e.vx = (ax / alen) * e.speed;
  e.vy = (ay / alen) * e.speed;
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  e.angle = Math.atan2(e.vy, e.vx);

  // Spitters keep their distance and fire at the player.
  if (e.kind === 'spitter') {
    e.shootTimer -= dt;
    if (e.shootTimer <= 0 && dist < 560 && p.alive) {
      e.shootTimer = ENEMIES.spitter.shootInterval * (0.85 + Math.random() * 0.3);
      const bs = ENEMIES.spitter.bulletSpeed;
      game.enemyBullets.push(makeEnemyBullet(
        e.x, e.y,
        (dx / dist) * bs, (dy / dist) * bs,
        e.damage,
      ));
      burst(game.particles, e.x, e.y, 4, '#f472b6', 90, 0.3, 2);
    }
  }

  // The boss strafes and fires radial bursts.
  if (e.kind === 'boss') {
    e.shootTimer -= dt;
    if (e.shootTimer <= 0) {
      e.shootTimer = 1.6;
      game.bossBurst(e);
    }
  }
}

// Bullets fly straight and die off-arena or on impact (handled by game.js).
export function updateBullet(b, dt) {
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.life -= dt;
  if (b.life <= 0) b.alive = false;
  if (b.x < -60 || b.x > ARENA.width + 60 || b.y < -60 || b.y > ARENA.height + 60) b.alive = false;
}

export function updateParticle(pt, dt) {
  pt.x += pt.vx * dt;
  pt.y += pt.vy * dt;
  const drag = Math.pow(pt.drag, dt * 60);
  pt.vx *= drag;
  pt.vy *= drag;
  pt.life -= dt;
  if (pt.life <= 0) pt.alive = false;
}

export function updatePickup(game, pk, dt) {
  pk.bob += dt * 4;
  pk.life -= dt;
  if (pk.life <= 0) pk.alive = false;
  // Magnet: close pickups drift toward the player.
  const p = game.player;
  if (p.alive) {
    const dx = p.x - pk.x;
    const dy = p.y - pk.y;
    const d = Math.hypot(dx, dy);
    if (d < 130) {
      const pull = (1 - d / 130) * 420;
      pk.x += (dx / (d || 1)) * pull * dt;
      pk.y += (dy / (d || 1)) * pull * dt;
    }
  }
}

export function updateFloatText(ft, dt) {
  ft.y -= 42 * dt;
  ft.life -= dt;
  if (ft.life <= 0) ft.alive = false;
}

// Combo multiplier: each kill inside the window raises it a step.
export function comboMultiplier(game) {
  return 1 + Math.min(game.comboChain, 30) * COMBO.step;
}
