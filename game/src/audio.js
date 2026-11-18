// All sound is synthesized with WebAudio — no audio files. A tiny step
// sequencer plays a laid-back coastal groove (Am – F – C – G) while the
// engine, sirens, gunshots and pickups are built from oscillators and noise.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.musicOn = true;
    this._musicTimer = null;
    this._step = 0;
    this._engineOsc = null;
    this._engineGain = null;
    this._sirenOsc = null;
    this._sirenGain = null;
    this._sirenOn = false;
  }

  /** Must be called from a user gesture at least once. */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this._startMusic();
    this._startEngine();
  }

  _noiseBuffer(seconds = 0.3) {
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  _blip(freq, dur, type = 'sine', vol = 0.2, slideTo = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t); osc.stop(t + dur);
  }

  /** A gunshot: a burst of filtered noise plus a low thump. */
  gunshot() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.18);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.setValueAtTime(1800, t);
    filter.frequency.exponentialRampToValueAtTime(220, t + 0.15);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    src.connect(filter).connect(gain).connect(this.ctx.destination);
    src.start(t);
    this._blip(90, 0.12, 'sine', 0.35, 45);
  }

  /** A short punch thud. */
  punch() {
    this._blip(140, 0.09, 'triangle', 0.3, 70);
  }

  /** Cash pickup: two bright coins. */
  pickup() {
    this._blip(880, 0.09, 'sine', 0.2);
    setTimeout(() => this._blip(1320, 0.14, 'sine', 0.2), 90);
  }

  /** Mission complete jingle. */
  missionDone() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this._blip(f, 0.22, 'triangle', 0.25), i * 110));
  }

  /** Wanted-level sting. */
  wantedUp() {
    this._blip(220, 0.25, 'sawtooth', 0.16, 440);
  }

  /** Skid squeal while drifting. */
  skid() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.25);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 900; filter.Q.value = 6;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    src.connect(filter).connect(gain).connect(this.ctx.destination);
    src.start(t);
  }

  /** Continuous engine hum; call every frame with speed 0..1. */
  setEngine(speed, on) {
    if (!this.ctx || !this._engineOsc) return;
    const t = this.ctx.currentTime;
    this._engineGain.gain.setTargetAtTime(on ? 0.05 + speed * 0.06 : 0.0, t, 0.1);
    this._engineOsc.frequency.setTargetAtTime(55 + speed * 130, t, 0.1);
  }

  _startEngine() {
    this._engineOsc = this.ctx.createOscillator();
    this._engineOsc.type = 'sawtooth';
    this._engineOsc.frequency.value = 55;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 320;
    this._engineGain = this.ctx.createGain();
    this._engineGain.gain.value = 0;
    this._engineOsc.connect(filter).connect(this._engineGain).connect(this.ctx.destination);
    this._engineOsc.start();
  }

  /** Two-tone police siren, on or off. */
  setSiren(on) {
    if (!this.ctx) return;
    if (on === this._sirenOn) return;
    this._sirenOn = on;
    if (on) {
      this._sirenOsc = this.ctx.createOscillator();
      this._sirenOsc.type = 'triangle';
      this._sirenOsc.frequency.value = 720;
      this._sirenGain = this.ctx.createGain();
      this._sirenGain.gain.value = 0.045;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.9;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 240;
      lfo.connect(lfoGain).connect(this._sirenOsc.frequency);
      this._sirenOsc.connect(this._sirenGain).connect(this.ctx.destination);
      this._sirenOsc.start(); lfo.start();
      this._sirenLfo = lfo;
    } else if (this._sirenOsc) {
      try { this._sirenOsc.stop(); this._sirenLfo.stop(); } catch { /* already stopped */ }
      this._sirenOsc = null;
    }
  }

  /** The coastal groove: Am – F – C – G, bass + soft pad, one step per 240 ms. */
  _startMusic() {
    const roots = [110, 87.31, 130.81, 98]; // A2 F2 C3 G2
    const chords = [[220, 261.63, 329.63], [174.61, 220, 261.63], [261.63, 329.63, 392], [196, 246.94, 293.66]];
    this._musicTimer = setInterval(() => {
      if (!this.musicOn || !this.ctx || this.ctx.state !== 'running') return;
      const bar = Math.floor(this._step / 8) % 4;
      const beat = this._step % 8;
      if (beat === 0 || beat === 4) this._note(roots[bar], 0.5, 'triangle', 0.14);
      if (beat === 0) chords[bar].forEach((f) => this._note(f, 1.9, 'sine', 0.035));
      if (beat === 2 || beat === 6) this._note(roots[bar] * 2, 0.18, 'sine', 0.06);
      this._step++;
    }, 240);
  }

  _note(freq, dur, type, vol) {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type; osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    return this.musicOn;
  }
}
