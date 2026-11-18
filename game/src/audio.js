// Emberwarden — all sound is synthesised with WebAudio, no audio files.
//
// Every effect is a few oscillators and noise buffers built at run time, and
// the music is a quiet generative pad: a slow chord arpeggio over a low drone
// that shifts with the wave number. Nothing is loaded over the network, and
// the whole thing starts on the first user gesture (browsers block audio
// before one), so the title screen unlocks it on click or Enter.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.muted = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.wave = 1;
    this.noiseBuffer = null;
  }

  // Call from a user gesture (click / keypress) so the browser allows sound.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.5;
    this.sfxGain.connect(this.master);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.14;
    this.musicGain.connect(this.master);
    // Two seconds of white noise, reused by every noise-based effect.
    const length = this.ctx.sampleRate * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    this.startMusic();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.9;
  }

  setWave(wave) {
    this.wave = wave;
  }

  // --- primitives ---------------------------------------------------------

  tone({ type = 'sine', from = 440, to = null, duration = 0.15, volume = 0.3, when = 0, slide = 'exp' }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, from), t0);
    if (to !== null) {
      if (slide === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + duration);
      else osc.frequency.linearRampToValueAtTime(Math.max(1, to), t0 + duration);
    }
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  noise({ duration = 0.2, volume = 0.3, from = 1200, to = 200, when = 0, type = 'lowpass' }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(from, t0);
    if (to !== null) filter.frequency.exponentialRampToValueAtTime(Math.max(10, to), t0 + duration);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }

  // --- game effects -------------------------------------------------------

  shoot() {
    this.tone({ type: 'square', from: 880, to: 320, duration: 0.07, volume: 0.1 });
  }

  enemyHit() {
    this.tone({ type: 'triangle', from: 220, to: 140, duration: 0.06, volume: 0.14 });
  }

  enemyDie() {
    this.noise({ duration: 0.22, volume: 0.25, from: 900, to: 120 });
    this.tone({ type: 'sawtooth', from: 180, to: 40, duration: 0.2, volume: 0.16 });
  }

  bigDie() {
    this.noise({ duration: 0.5, volume: 0.4, from: 1400, to: 60 });
    this.tone({ type: 'sawtooth', from: 120, to: 28, duration: 0.45, volume: 0.3 });
    this.tone({ type: 'sine', from: 60, to: 30, duration: 0.4, volume: 0.3, when: 0.05 });
  }

  playerHurt() {
    this.tone({ type: 'sawtooth', from: 300, to: 90, duration: 0.25, volume: 0.3 });
    this.noise({ duration: 0.15, volume: 0.2, from: 600, to: 100 });
  }

  emberHurt() {
    this.tone({ type: 'sine', from: 520, to: 180, duration: 0.3, volume: 0.25 });
  }

  pickup() {
    this.tone({ type: 'sine', from: 660, to: 990, duration: 0.12, volume: 0.2 });
    this.tone({ type: 'sine', from: 990, to: 1320, duration: 0.12, volume: 0.18, when: 0.09 });
  }

  dash() {
    this.noise({ duration: 0.16, volume: 0.16, from: 3000, to: 500, type: 'bandpass' });
  }

  waveStart() {
    this.tone({ type: 'triangle', from: 392, to: 392, duration: 0.16, volume: 0.2 });
    this.tone({ type: 'triangle', from: 523, to: 523, duration: 0.2, volume: 0.2, when: 0.13 });
    this.tone({ type: 'triangle', from: 659, to: 659, duration: 0.28, volume: 0.22, when: 0.26 });
  }

  waveClear() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => this.tone({ type: 'triangle', from: f, to: f, duration: 0.18, volume: 0.18, when: i * 0.09 }));
  }

  bossWarn() {
    this.tone({ type: 'sawtooth', from: 98, to: 98, duration: 0.5, volume: 0.25 });
    this.tone({ type: 'sawtooth', from: 147, to: 147, duration: 0.5, volume: 0.2, when: 0.05 });
    this.noise({ duration: 0.5, volume: 0.15, from: 300, to: 80 });
  }

  gameOver() {
    const notes = [392, 330, 262, 196];
    notes.forEach((f, i) => this.tone({ type: 'triangle', from: f, to: f * 0.94, duration: 0.35, volume: 0.22, when: i * 0.22 }));
  }

  // --- music --------------------------------------------------------------
  //
  // A slow minor arpeggio. The root moves with the wave number so later
  // waves sound tenser, and a soft drone sits underneath. Steps run on a
  // timer so the music keeps going even when the game is paused.

  startMusic() {
    if (this.musicTimer) return;
    // A-minor-ish roots that climb as waves climb: Am, F, C, G, then Dm.
    const roots = [110, 87.31, 130.81, 98, 73.42];
    const chordTones = [1, 1.189, 1.498, 2, 2.378, 2.996];
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || this.muted) return;
      const root = roots[Math.min(this.wave - 1, roots.length - 1)] ?? 110;
      const tone = chordTones[this.musicStep % chordTones.length];
      this.musicTone(root * tone, 1.6, 0.05);
      if (this.musicStep % 6 === 0) this.musicTone(root / 2, 3.2, 0.06);
      this.musicStep += 1;
    }, 420);
  }

  musicTone(freq, duration, volume) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }
}
