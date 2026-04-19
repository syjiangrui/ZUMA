// ---------------------------------------------------------------------------
// Procedural Audio — all sound effects synthesized via Web Audio API.
// No external audio files needed. AudioContext is lazily created on first user
// interaction to satisfy mobile browser autoplay policies.
// ---------------------------------------------------------------------------
export class SfxEngine {
  constructor() {
    this.ctx = null;    // AudioContext, created on first unlock
    this.muted = true;  // default muted — player opts in via HUD button
  }

  // Must be called from a user gesture (pointerdown / keydown) at least once.
  unlock() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Some browsers suspend the context until a resume inside a gesture.
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  // --- Individual sound effects ------------------------------------------

  // Crisp airy pop — frog spits the ball
  playShoot() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Bright tonal pop
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(480, t);
    o.frequency.exponentialRampToValueAtTime(160, t + 0.09);
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + 0.1);
    // Short breathy noise layer for "puff" texture
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.07, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2000;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.12, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    src.connect(hp).connect(ng).connect(this.ctx.destination);
    src.start(t);
  }

  // Stone-on-stone click — ball inserts into chain
  playHit() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Short noise burst through a bandpass filter
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.06, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1800;
    bp.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    src.connect(bp).connect(g).connect(this.ctx.destination);
    src.start(t);
  }

  // Crisp stone-shatter chime — balls eliminated. Combo shifts pitch up.
  playMatch(comboLevel = 1) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const baseFreq = 880 + (comboLevel - 1) * 150;
    // Primary tone — short bright ping
    const o1 = this.ctx.createOscillator();
    const g1 = this.ctx.createGain();
    o1.type = "sine";
    o1.frequency.setValueAtTime(baseFreq, t);
    g1.gain.setValueAtTime(0.18, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o1.connect(g1).connect(this.ctx.destination);
    o1.start(t);
    o1.stop(t + 0.15);
    // Harmonic overtone — adds sparkle
    const o2 = this.ctx.createOscillator();
    const g2 = this.ctx.createGain();
    o2.type = "sine";
    o2.frequency.setValueAtTime(baseFreq * 1.5, t);
    g2.gain.setValueAtTime(0.08, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o2.connect(g2).connect(this.ctx.destination);
    o2.start(t);
    o2.stop(t + 0.1);
    // Tiny noise crackle for "stone breaking" texture
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.04, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 3000;
    bp.Q.value = 0.8;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.1, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    src.connect(bp).connect(ng).connect(this.ctx.destination);
    src.start(t);
  }

  // Ascending arpeggio — victory fanfare
  playWin() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      const start = t + i * 0.12;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.18, start + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
      o.connect(g).connect(this.ctx.destination);
      o.start(start);
      o.stop(start + 0.4);
    });
  }

  // Low rumble — defeat
  playLose() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Low oscillator
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.5);
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + 0.5);
    // Noise layer
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.4, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 300;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.15, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    src.connect(lp).connect(ng).connect(this.ctx.destination);
    src.start(t);
  }
}
