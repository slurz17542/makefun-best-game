// Emberwarden — everything the player sees.
//
// One canvas, one camera that follows the player, and a neon palette on a
// dark field. Drawing is split into small functions, one per layer, so the
// game loop reads like a shot list: floor, ember, pickups, enemies, player,
// bullets, particles, floating text, HUD, banners, then the screens.

import { ARENA, PALETTE, VIEW } from './config.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camera = { x: 0, y: 0 };
    this.shake = 0;
    this.time = 0;
  }

  addShake(amount) {
    this.shake = Math.min(1, this.shake + amount);
  }

  update(dt) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 1.8);
  }

  // Keep the player centred, clamped so the view never leaves the arena.
  follow(x, y) {
    const cx = x - VIEW.width / 2;
    const cy = y - VIEW.height / 2;
    this.camera.x = Math.max(0, Math.min(ARENA.width - VIEW.width, cx));
    this.camera.y = Math.max(0, Math.min(ARENA.height - VIEW.height, cy));
  }

  render(game) {
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, VIEW.width, VIEW.height);
    // Screen shake: a random offset that shrinks with the trauma value.
    if (this.shake > 0) {
      const s = this.shake * this.shake * 14;
      ctx.translate((Math.random() * 2 - 1) * s, (Math.random() * 2 - 1) * s);
    }
    this.drawFloor(game);
    ctx.save();
    ctx.translate(-this.camera.x, -this.camera.y);
    this.drawEmber(game);
    this.drawPickups(game);
    this.drawEnemies(game);
    this.drawPlayer(game);
    this.drawBullets(game);
    this.drawParticles(game);
    this.drawFloatTexts(game);
    ctx.restore();
    this.drawHud(game);
    this.drawBanners(game);
    if (game.state === 'title') this.drawTitle(game);
    if (game.state === 'paused') this.drawPaused(game);
    if (game.state === 'over') this.drawGameOver(game);
    ctx.restore();
  }

  // --- floor ---------------------------------------------------------------

  drawFloor(game) {
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.background;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    // A faint grid that scrolls with the camera, so motion reads.
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    const step = 80;
    const ox = -this.camera.x % step;
    const oy = -this.camera.y % step;
    ctx.beginPath();
    for (let x = ox; x <= VIEW.width; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, VIEW.height);
    }
    for (let y = oy; y <= VIEW.height; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(VIEW.width, y);
    }
    ctx.stroke();
    // The arena border, drawn in world space.
    ctx.save();
    ctx.translate(-this.camera.x, -this.camera.y);
    ctx.strokeStyle = PALETTE.arenaLine;
    ctx.lineWidth = 3;
    ctx.strokeRect(ARENA.margin, ARENA.margin, ARENA.width - ARENA.margin * 2, ARENA.height - ARENA.margin * 2);
    // Soft vignette glow around the ember's home.
    const g = ctx.createRadialGradient(
      game.ember.x, game.ember.y, 10,
      game.ember.x, game.ember.y, 320,
    );
    g.addColorStop(0, 'rgba(255, 150, 40, 0.10)');
    g.addColorStop(1, 'rgba(255, 150, 40, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(game.ember.x - 320, game.ember.y - 320, 640, 640);
    ctx.restore();
  }

  // --- entities ------------------------------------------------------------

  drawEmber(game) {
    const ctx = this.ctx;
    const e = game.ember;
    const pulse = 1 + Math.sin(this.time * 2.4 + e.pulse) * 0.06;
    const r = e.radius * pulse;
    // Outer glow.
    const g = ctx.createRadialGradient(e.x, e.y, r * 0.2, e.x, e.y, r * 3.2);
    g.addColorStop(0, 'rgba(255, 170, 60, 0.55)');
    g.addColorStop(0.5, 'rgba(255, 110, 30, 0.18)');
    g.addColorStop(1, 'rgba(255, 110, 30, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * 3.2, 0, Math.PI * 2);
    ctx.fill();
    // The flame body: layered teardrops.
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = PALETTE.emberGlow;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.25);
    ctx.bezierCurveTo(r * 0.9, -r * 0.4, r * 0.75, r * 0.7, 0, r * 0.95);
    ctx.bezierCurveTo(-r * 0.75, r * 0.7, -r * 0.9, -r * 0.4, 0, -r * 1.25);
    ctx.fill();
    ctx.fillStyle = PALETTE.emberCore;
    ctx.beginPath();
    ctx.arc(0, r * 0.15, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff6d8';
    ctx.beginPath();
    ctx.arc(0, r * 0.2, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // A ring showing the ember's health.
    ctx.strokeStyle = 'rgba(255, 210, 138, 0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r + 12, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * e.hp) / e.maxHp);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 210, 138, 0.15)';
    ctx.beginPath();
    ctx.arc(e.x, e.y, r + 12, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawPickups(game) {
    const ctx = this.ctx;
    for (const pk of game.pickups) {
      const bob = Math.sin(pk.bob) * 3;
      const blink = pk.life < 3 ? (Math.sin(this.time * 12) > 0 ? 1 : 0.35) : 1;
      ctx.save();
      ctx.globalAlpha = blink;
      ctx.translate(pk.x, pk.y + bob);
      const colors = {
        health: PALETTE.pickupHealth,
        spread: PALETTE.pickupSpread,
        rapid: PALETTE.pickupRapid,
        shield: PALETTE.pickupShield,
        bomb: PALETTE.pickupBomb,
      };
      const color = colors[pk.pickupKind] || '#ffffff';
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0a0817';
      ctx.font = 'bold 15px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const glyphs = { health: '+', spread: '✦', rapid: '»', shield: '◈', bomb: '✸' };
      ctx.fillText(glyphs[pk.pickupKind] || '?', 0, 1);
      ctx.restore();
    }
  }

  drawEnemies(game) {
    const ctx = this.ctx;
    for (const e of game.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      // Hit flash: white for a moment after damage.
      const flash = e.flash > 0;
      const body = flash ? '#ffffff' : e.color;
      // Health bar for anything hurt or big.
      if (e.hp < e.maxHp && e.maxHp > 40) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(-e.radius, -e.radius - 12, e.radius * 2, 5);
        ctx.fillStyle = '#ff5d7a';
        ctx.fillRect(-e.radius, -e.radius - 12, e.radius * 2 * (e.hp / e.maxHp), 5);
      }
      if (e.kind === 'boss') {
        this.drawBossBody(ctx, e, body);
      } else if (e.kind === 'spitter') {
        this.drawSpiky(ctx, e.radius, body, 8);
      } else if (e.kind === 'splitter') {
        this.drawSpiky(ctx, e.radius, body, 6);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.arc(0, 0, e.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.kind === 'brute') {
        this.drawSpiky(ctx, e.radius, body, 5);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, e.radius * 0.62, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Drifter, shade, mote: a soft orb with a dark core.
        const g = ctx.createRadialGradient(0, 0, 1, 0, 0, e.radius);
        g.addColorStop(0, body);
        g.addColorStop(1, 'rgba(40, 10, 60, 0.9)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(10, 4, 20, 0.85)';
        ctx.beginPath();
        ctx.arc(0, 0, e.radius * 0.42, 0, Math.PI * 2);
        ctx.fill();
      }
      // Eyes that track the player.
      const p = game.player;
      const ex = Math.cos(Math.atan2(p.y - e.y, p.x - e.x)) * e.radius * 0.3;
      const ey = Math.sin(Math.atan2(p.y - e.y, p.x - e.x)) * e.radius * 0.3;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex - e.radius * 0.22, ey, 2.4, 0, Math.PI * 2);
      ctx.arc(ex + e.radius * 0.22, ey, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawSpiky(ctx, radius, color, points) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? radius : radius * 0.68;
      const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  drawBossBody(ctx, e, body) {
    // A crowned horror: layered rings and horns.
    ctx.rotate(Math.sin(this.time * 1.3) * 0.08);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a0010';
    ctx.beginPath();
    ctx.arc(0, 0, e.radius * 0.68, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = body;
    ctx.lineWidth = 4;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * e.radius * 0.8, Math.sin(a) * e.radius * 0.8);
      ctx.lineTo(Math.cos(a) * e.radius * 1.25, Math.sin(a) * e.radius * 1.25);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(-e.radius * 0.25, -e.radius * 0.1, 5, 0, Math.PI * 2);
    ctx.arc(e.radius * 0.25, -e.radius * 0.1, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  drawPlayer(game) {
    const ctx = this.ctx;
    const p = game.player;
    if (!p.alive) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    // Invulnerability blink.
    if (p.invuln > 0 && Math.floor(this.time * 14) % 2 === 0) ctx.globalAlpha = 0.45;
    // Trail glow.
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, p.radius * 2.6);
    g.addColorStop(0, 'rgba(125, 249, 255, 0.5)');
    g.addColorStop(1, 'rgba(125, 249, 255, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius * 2.6, 0, Math.PI * 2);
    ctx.fill();
    // Shield ring.
    if (p.shieldTimer > 0) {
      ctx.strokeStyle = 'rgba(167, 139, 250, 0.8)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 9 + Math.sin(this.time * 5) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    // The wisp: a dart pointing at the aim.
    ctx.rotate(p.angle);
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.moveTo(p.radius + 6, 0);
    ctx.lineTo(-p.radius * 0.7, p.radius * 0.75);
    ctx.lineTo(-p.radius * 0.35, 0);
    ctx.lineTo(-p.radius * 0.7, -p.radius * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.playerCore;
    ctx.beginPath();
    ctx.arc(2, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Dash cooldown arc under the player.
    if (p.dashCooldown > 0) {
      ctx.strokeStyle = 'rgba(125, 249, 255, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - p.dashCooldown / 1.4));
      ctx.stroke();
    }
  }

  drawBullets(game) {
    const ctx = this.ctx;
    for (const b of game.bullets) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(Math.atan2(b.vy, b.vx));
      ctx.fillStyle = PALETTE.bullet;
      ctx.shadowColor = PALETTE.bulletGlow;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (const b of game.enemyBullets) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.fillStyle = '#ff5d8f';
      ctx.shadowColor = '#ff2d55';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd7e2';
      ctx.beginPath();
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawParticles(game) {
    const ctx = this.ctx;
    for (const pt of game.particles) {
      const a = Math.max(0, pt.life / pt.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * (0.5 + a * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawFloatTexts(game) {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const ft of game.floatTexts) {
      const a = Math.max(0, ft.life / ft.maxLife);
      ctx.globalAlpha = a;
      ctx.font = `bold ${ft.size}px "Segoe UI", sans-serif`;
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;
  }

  // --- HUD -----------------------------------------------------------------

  drawHud(game) {
    if (game.state === 'title') return;
    const ctx = this.ctx;
    ctx.textBaseline = 'middle';
    // Top-left: score, combo, wave.
    ctx.textAlign = 'left';
    ctx.font = 'bold 30px "Segoe UI", sans-serif';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`SCORE ${game.score.toLocaleString('en-US')}`, 24, 34);
    if (game.comboChain >= 2) {
      ctx.font = 'bold 19px "Segoe UI", sans-serif';
      ctx.fillStyle = PALETTE.textGold;
      ctx.fillText(`COMBO x${(1 + Math.min(game.comboChain, 30) * 0.1).toFixed(1)}  ·  ${game.comboChain} chain`, 24, 66);
    }
    ctx.font = 'bold 19px "Segoe UI", sans-serif';
    ctx.fillStyle = PALETTE.textDim;
    ctx.fillText(`WAVE ${game.waves.wave}   ·   BEST ${game.best.toLocaleString('en-US')}`, 24, 94);
    // Top-right: ember and player health bars.
    this.drawBar(980, 26, 276, 16, game.ember.hp / game.ember.maxHp, '#ff9a3c', 'EMBER');
    this.drawBar(980, 56, 276, 16, game.player.hp / game.player.maxHp, '#7df9ff', 'WARDEN');
    // Active power-ups, bottom-left.
    const p = game.player;
    const active = [];
    if (p.spreadTimer > 0) active.push(['SPREAD', p.spreadTimer, '#facc15']);
    if (p.rapidTimer > 0) active.push(['RAPID', p.rapidTimer, '#38bdf8']);
    if (p.shieldTimer > 0) active.push(['SHIELD', p.shieldTimer, '#a78bfa']);
    ctx.font = 'bold 15px "Segoe UI", sans-serif';
    active.forEach(([name, t, color], i) => {
      ctx.fillStyle = color;
      ctx.fillText(`${name} ${t.toFixed(0)}s`, 24, 668 - i * 22);
    });
    // Boss health bar, top centre.
    const boss = game.enemies.find((e) => e.kind === 'boss');
    if (boss) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 17px "Segoe UI", sans-serif';
      ctx.fillStyle = '#ff2d55';
      ctx.fillText('DREADMAW, THE HOLLOW KING', VIEW.width / 2, 26);
      this.drawBar(VIEW.width / 2 - 220, 40, 440, 12, Math.max(0, boss.hp / boss.maxHp), '#ff2d55', null);
    }
    // Controls hint, bottom-right, fading after the first wave.
    if (game.waves.wave <= 1 && game.state === 'playing') {
      ctx.textAlign = 'right';
      ctx.font = '15px "Segoe UI", sans-serif';
      ctx.fillStyle = 'rgba(168, 159, 214, 0.75)';
      ctx.fillText('WASD move · mouse aim · hold click to fire · SHIFT dash · P pause · M mute', VIEW.width - 24, 692);
    }
  }

  drawBar(x, y, w, h, frac, color, label) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w, h);
    if (label) {
      ctx.textAlign = 'left';
      ctx.font = 'bold 12px "Segoe UI", sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(label, x + 6, y + h / 2 + 0.5);
    }
  }

  drawBanners(game) {
    const ctx = this.ctx;
    if (game.waves.bannerTimer > 0 && game.state === 'playing') {
      const t = game.waves.bannerTimer;
      const a = t > 2 ? (2.4 - t) / 0.4 : Math.min(1, t / 0.5);
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, a));
      ctx.textAlign = 'center';
      ctx.font = 'bold 46px "Segoe UI", sans-serif';
      ctx.fillStyle = PALETTE.waveBanner;
      ctx.shadowColor = 'rgba(255, 209, 102, 0.6)';
      ctx.shadowBlur = 24;
      const label = game.waves.isBossWave(game.waves.wave) ? `WAVE ${game.waves.wave} — BOSS` : `WAVE ${game.waves.wave}`;
      ctx.fillText(label, VIEW.width / 2, 150);
      ctx.font = '19px "Segoe UI", sans-serif';
      ctx.fillStyle = PALETTE.textDim;
      ctx.shadowBlur = 0;
      ctx.fillText(game.waves.isBossWave(game.waves.wave) ? 'The Hollow King comes for the ember.' : 'The dark is coming. Hold the light.', VIEW.width / 2, 192);
      ctx.restore();
    }
    if (game.waves.state === 'breather' && game.state === 'playing') {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = 'bold 24px "Segoe UI", sans-serif';
      ctx.fillStyle = PALETTE.textDim;
      ctx.fillText(`Next wave in ${Math.ceil(game.waves.breatherTimer)}…`, VIEW.width / 2, 150);
      ctx.restore();
    }
  }

  // --- screens --------------------------------------------------------------

  drawTitle(game) {
    const ctx = this.ctx;
    // Dim the arena behind the title.
    ctx.fillStyle = 'rgba(7, 6, 14, 0.62)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    const bob = Math.sin(this.time * 1.6) * 6;
    ctx.font = 'bold 84px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.shadowColor = 'rgba(255, 150, 40, 0.8)';
    ctx.shadowBlur = 36;
    ctx.fillText('EMBERWARDEN', VIEW.width / 2, 218 + bob);
    ctx.shadowBlur = 0;
    ctx.font = '22px "Segoe UI", sans-serif';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText('The last ember must not die.', VIEW.width / 2, 272 + bob);
    ctx.font = '17px "Segoe UI", sans-serif';
    ctx.fillStyle = PALETTE.textDim;
    ctx.fillText('Shades crawl out of the dark to swallow its light. You are its warden.', VIEW.width / 2, 306 + bob);
    ctx.fillText('Shoot them down. Spend nothing. Let nothing touch the flame.', VIEW.width / 2, 332 + bob);
    // How to play, in a neat card.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.beginPath();
    ctx.roundRect(VIEW.width / 2 - 300, 372, 600, 132, 12);
    ctx.fill();
    ctx.stroke();
    ctx.font = 'bold 17px "Segoe UI", sans-serif';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText('HOW TO PLAY', VIEW.width / 2, 398);
    ctx.font = '16px "Segoe UI", sans-serif';
    ctx.fillStyle = PALETTE.textDim;
    ctx.fillText('WASD / arrows — move        Mouse — aim        Hold click — fire', VIEW.width / 2, 430);
    ctx.fillText('SHIFT — dash through danger        P — pause        M — mute', VIEW.width / 2, 458);
    ctx.fillText('Guard the ember. Chain kills for combo. Every 5th wave, a boss.', VIEW.width / 2, 486);
    // Start prompt, pulsing.
    const pulse = 0.65 + Math.sin(this.time * 3.2) * 0.35;
    ctx.globalAlpha = pulse;
    ctx.font = 'bold 26px "Segoe UI", sans-serif';
    ctx.fillStyle = '#7df9ff';
    ctx.fillText('CLICK OR PRESS ENTER TO BEGIN', VIEW.width / 2, 566);
    ctx.globalAlpha = 1;
    if (game.best > 0) {
      ctx.font = '17px "Segoe UI", sans-serif';
      ctx.fillStyle = PALETTE.textGold;
      ctx.fillText(`Best score: ${game.best.toLocaleString('en-US')}`, VIEW.width / 2, 606);
    }
  }

  drawPaused(game) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(7, 6, 14, 0.66)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.font = 'bold 56px "Segoe UI", sans-serif';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText('PAUSED', VIEW.width / 2, 320);
    ctx.font = '19px "Segoe UI", sans-serif';
    ctx.fillStyle = PALETTE.textDim;
    ctx.fillText('P or Esc to resume · R to restart · M to mute', VIEW.width / 2, 366);
  }

  drawGameOver(game) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(20, 4, 8, 0.72)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.font = 'bold 64px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ff4d6d';
    ctx.shadowColor = 'rgba(255, 45, 85, 0.6)';
    ctx.shadowBlur = 30;
    ctx.fillText('THE EMBER DIES', VIEW.width / 2, 210);
    ctx.shadowBlur = 0;
    ctx.font = '20px "Segoe UI", sans-serif';
    ctx.fillStyle = PALETTE.text;
    const cause = game.deathCause === 'player' ? 'The warden has fallen.' : 'The dark swallowed the last light.';
    ctx.fillText(cause, VIEW.width / 2, 254);
    // Stats card.
    const stats = game.stats;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.beginPath();
    ctx.roundRect(VIEW.width / 2 - 260, 292, 520, 196, 12);
    ctx.fill();
    ctx.stroke();
    ctx.font = 'bold 40px "Segoe UI", sans-serif';
    ctx.fillStyle = PALETTE.textGold;
    ctx.fillText(game.score.toLocaleString('en-US'), VIEW.width / 2, 340);
    ctx.font = '15px "Segoe UI", sans-serif';
    ctx.fillStyle = PALETTE.textDim;
    ctx.fillText('FINAL SCORE', VIEW.width / 2, 368);
    ctx.font = '18px "Segoe UI", sans-serif';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`Wave ${stats.wave}   ·   ${stats.kills} shades banished   ·   ${stats.shots} shots`, VIEW.width / 2, 412);
    const acc = stats.shots > 0 ? Math.round((stats.hits / stats.shots) * 100) : 0;
    ctx.fillText(`Accuracy ${acc}%   ·   Best combo x${stats.bestCombo.toFixed(1)}`, VIEW.width / 2, 442);
    if (game.score >= game.best && game.score > 0) {
      ctx.font = 'bold 19px "Segoe UI", sans-serif';
      ctx.fillStyle = '#4ade80';
      ctx.fillText('★ NEW BEST SCORE ★', VIEW.width / 2, 472);
    }
    const pulse = 0.65 + Math.sin(this.time * 3.2) * 0.35;
    ctx.globalAlpha = pulse;
    ctx.font = 'bold 24px "Segoe UI", sans-serif';
    ctx.fillStyle = '#7df9ff';
    ctx.fillText('PRESS R OR CLICK TO TRY AGAIN', VIEW.width / 2, 552);
    ctx.globalAlpha = 1;
  }
}
