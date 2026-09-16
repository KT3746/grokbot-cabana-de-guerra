/**
 * Som procedural com Web Audio — sem arquivos externos.
 * Respeita autoplay: só toca depois do primeiro toque/clique.
 */
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.unlocked = false;
    this.muted = localStorage.getItem("nnc-muted") === "1";
    this._musicNodes = [];
    this._musicTimer = 0;
    this._night = false;
    this._pad = null;
  }

  unlock() {
    if (this.unlocked) {
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.85;
    this.master.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.22;
    this.musicGain.connect(this.master);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.7;
    this.sfxGain.connect(this.master);

    this.unlocked = true;
    this._startPad();
  }

  setMuted(m) {
    this.muted = m;
    localStorage.setItem("nnc-muted", m ? "1" : "0");
    if (this.master) this.master.gain.value = m ? 0 : 0.85;
    if (this.ctx && this.ctx.state === "suspended" && !m) this.ctx.resume();
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setNight(night) {
    this._night = night;
    if (this._pad) {
      const t = this.ctx.currentTime;
      this._pad.gain.gain.cancelScheduledValues(t);
      this._pad.gain.gain.linearRampToValueAtTime(night ? 0.07 : 0.045, t + 1.2);
      this._pad.osc.frequency.linearRampToValueAtTime(night ? 55 : 82, t + 1.4);
      this._pad.osc2.frequency.linearRampToValueAtTime(night ? 82 : 123, t + 1.4);
    }
  }

  update(dt) {
    if (!this.unlocked || this.muted || !this.ctx) return;
    this._musicTimer -= dt;
    if (this._musicTimer <= 0) {
      this._plink();
      this._musicTimer = this._night ? 1.6 + Math.random() * 1.4 : 1.1 + Math.random() * 1.8;
    }
  }

  _startPad() {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc2.type = "sine";
    osc.frequency.value = 82;
    osc2.frequency.value = 123.5;
    g.gain.value = 0.045;
    osc.connect(g);
    osc2.connect(g);
    g.connect(this.musicGain);
    osc.start();
    osc2.start();
    this._pad = { osc, osc2, gain: g };
  }

  _plink() {
    const ctx = this.ctx;
    const night = this._night;
    const scale = night ? [110, 130.8, 146.8, 164.8] : [196, 220, 261.6, 293.7, 329.6];
    const f = scale[(Math.random() * scale.length) | 0];
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = night ? "triangle" : "sine";
    osc.frequency.value = f;
    g.gain.value = night ? 0.045 : 0.06;
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
    osc.connect(g);
    g.connect(this.musicGain);
    osc.start();
    osc.stop(ctx.currentTime + 0.72);
  }

  _env(node, t, a, d, vol) {
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(vol, t + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  tone(freq, type, dur, vol = 0.12, slide = 0) {
    if (!this.unlocked || this.muted || !this.ctx) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), ctx.currentTime + dur);
    this._env(g, ctx.currentTime, 0.012, dur, vol);
    o.connect(g);
    g.connect(this.sfxGain);
    o.start();
    o.stop(ctx.currentTime + dur + 0.04);
  }

  noise(dur, vol = 0.1, filterFreq = 1200) {
    if (!this.unlocked || this.muted) return;
    const ctx = this.ctx;
    const n = Math.max(1, (ctx.sampleRate * dur) | 0);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = filterFreq;
    const g = ctx.createGain();
    this._env(g, ctx.currentTime, 0.005, dur, vol);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxGain);
    src.start();
  }

  chop() {
    this.noise(0.08, 0.16, 900);
    this.tone(140, "triangle", 0.09, 0.08, -40);
  }
  mine() {
    this.noise(0.07, 0.14, 2400);
    this.tone(320, "square", 0.06, 0.05, -80);
  }
  swing() {
    this.noise(0.05, 0.08, 1800);
    this.tone(180, "square", 0.06, 0.05);
  }
  shoot() {
    this.tone(520, "square", 0.07, 0.06, -280);
    this.noise(0.04, 0.06, 2000);
  }
  hit() {
    this.tone(90, "sawtooth", 0.1, 0.09, -30);
    this.noise(0.06, 0.1, 700);
  }
  hurt() {
    this.tone(220, "sawtooth", 0.16, 0.1, -120);
  }
  cabin() {
    this.noise(0.18, 0.2, 400);
    this.tone(70, "sine", 0.22, 0.12, -20);
  }
  groan() {
    this.tone(70 + Math.random() * 30, "sawtooth", 0.35, 0.05, -15);
  }
  craft() {
    this.tone(330, "sine", 0.08, 0.08);
    setTimeout(() => this.tone(440, "sine", 0.1, 0.08), 70);
  }
  harvest() {
    this.tone(523, "sine", 0.09, 0.07);
    this.tone(784, "sine", 0.12, 0.05);
  }
  place() {
    this.tone(160, "triangle", 0.08, 0.07);
    this.noise(0.05, 0.06, 600);
  }
  eat() {
    this.tone(300, "sine", 0.08, 0.06);
    this.tone(200, "sine", 0.1, 0.04);
  }
  ui() {
    this.tone(660, "sine", 0.05, 0.05);
  }
  dusk() {
    this.tone(196, "triangle", 0.25, 0.08, -40);
    setTimeout(() => this.tone(146, "triangle", 0.35, 0.07), 180);
  }
  dawn() {
    this.tone(261, "sine", 0.2, 0.07);
    setTimeout(() => this.tone(329, "sine", 0.2, 0.07), 120);
    setTimeout(() => this.tone(392, "sine", 0.3, 0.07), 240);
  }
  gameover() {
    this.tone(180, "sawtooth", 0.4, 0.1, -80);
    setTimeout(() => this.tone(110, "triangle", 0.6, 0.08), 200);
  }
  trap() {
    this.noise(0.1, 0.14, 1600);
    this.tone(140, "square", 0.08, 0.07);
  }
}