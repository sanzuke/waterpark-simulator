/** Tiny synthesized sound effects (no audio files). Starts after the first user gesture. */
class SfxEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  muted = false;

  unlock() {
    if (this.ctx) { void this.ctx.resume(); return; }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  private noise(dur: number, freq: number, q: number, vol: number, type: BiquadFilterType = "bandpass") {
    if (!this.ctx || !this.master || !this.noiseBuf || this.muted) return;
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); const t = this.ctx.currentTime;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master); src.start(t, Math.random() * 0.5, dur);
  }

  private tone(freq: number, dur: number, vol: number, to = freq, type: OscillatorType = "sine", delay = 0) {
    if (!this.ctx || !this.master || this.muted) return;
    const o = this.ctx.createOscillator(); o.type = type;
    const g = this.ctx.createGain(); const t = this.ctx.currentTime + delay;
    o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur);
  }

  splash(strength = 1) { this.noise(0.5 + strength * 0.3, 900, 0.6, 0.35 * Math.min(1.4, strength)); }
  whoosh() { this.noise(1.6, 700, 0.8, 0.25); }
  bucket() { this.noise(1.8, 500, 0.5, 0.55); }
  coin() { this.tone(988, 0.1, 0.2, 988, "square"); this.tone(1319, 0.25, 0.2, 1319, "square", 0.08); }
  buy() { this.tone(660, 0.1, 0.2, 660, "triangle"); this.tone(880, 0.18, 0.2, 880, "triangle", 0.1); }
  click() { this.tone(520, 0.06, 0.15, 520, "triangle"); }
  no() { this.tone(300, 0.2, 0.18, 220, "triangle"); }
  crunch() { this.noise(0.06, 2500, 1, 0.25, "highpass"); }
  gulp() { this.tone(220, 0.12, 0.2, 140); }
  jump() { this.tone(330, 0.16, 0.12, 560); }
}

export const Sfx = new SfxEngine();
