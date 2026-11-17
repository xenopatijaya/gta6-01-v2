// Coral Bay sound: every effect is synthesised with WebAudio, so the game
// ships no audio files at all. A tiny looping bass line is the radio.
export class SoundEngine {
  constructor() {
    this.context = null;
    this.muted = false;
    this.musicTimer = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.noteIndex = 0;
  }

  ensure() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume();
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.context.destination);
    this.startMusic();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  tone(freq, seconds, type, volume, slideTo) {
    if (!this.context || this.muted) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + seconds);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + seconds);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + seconds + 0.02);
  }

  noise(seconds, volume, lowpass) {
    if (!this.context || this.muted) return;
    const now = this.context.currentTime;
    const length = Math.floor(this.context.sampleRate * seconds);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass || 1200;
    const gain = this.context.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(now);
  }

  shoot() {
    this.noise(0.16, 0.5, 2600);
    this.tone(160, 0.1, 'square', 0.2, 55);
  }

  punch() {
    this.noise(0.09, 0.35, 700);
  }

  crash() {
    this.noise(0.3, 0.5, 500);
    this.tone(70, 0.25, 'sine', 0.35, 40);
  }

  pickup() {
    this.tone(660, 0.09, 'sine', 0.25);
    setTimeout(() => this.tone(990, 0.14, 'sine', 0.25), 80);
  }

  missionDone() {
    [523, 659, 784, 1046].forEach((freq, i) => {
      setTimeout(() => this.tone(freq, 0.22, 'triangle', 0.3), i * 110);
    });
  }

  fail() {
    [392, 330, 262].forEach((freq, i) => {
      setTimeout(() => this.tone(freq, 0.25, 'sawtooth', 0.18), i * 140);
    });
  }

  horn() {
    this.tone(370, 0.28, 'square', 0.16);
    this.tone(466, 0.28, 'square', 0.12);
  }

  click() {
    this.tone(880, 0.05, 'sine', 0.18);
  }

  setEngine(running, speedRatio) {
    if (!this.context) return;
    if (!running) {
      if (this.engineOsc) {
        try { this.engineOsc.stop(); } catch (e) { /* already stopped */ }
        this.engineOsc = null;
        this.engineGain = null;
      }
      return;
    }
    if (!this.engineOsc) {
      this.engineOsc = this.context.createOscillator();
      this.engineGain = this.context.createGain();
      this.engineOsc.type = 'sawtooth';
      this.engineGain.gain.value = 0.03;
      const filter = this.context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    this.engineOsc.frequency.value = 55 + speedRatio * 140;
    this.engineGain.gain.value = this.muted ? 0 : 0.025 + speedRatio * 0.03;
  }

  setSiren(on) {
    if (!this.context) return;
    if (!on) {
      if (this.sirenOsc) {
        try { this.sirenOsc.stop(); } catch (e) { /* already stopped */ }
        this.sirenOsc = null;
        this.sirenGain = null;
      }
      return;
    }
    if (this.sirenOsc) return;
    this.sirenOsc = this.context.createOscillator();
    this.sirenGain = this.context.createGain();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 700;
    this.sirenGain.gain.value = 0.045;
    const lfo = this.context.createOscillator();
    lfo.frequency.value = 0.8;
    const lfoGain = this.context.createGain();
    lfoGain.gain.value = 320;
    lfo.connect(lfoGain);
    lfoGain.connect(this.sirenOsc.frequency);
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    lfo.start();
    this.sirenLfo = lfo;
  }

  startMusic() {
    if (this.musicTimer) return;
    // A lazy sunset groove: A minor pentatonic bass + soft pad notes.
    const bass = [110, 110, 130.81, 98, 110, 110, 146.83, 164.81];
    const pad = [220, 261.63, 329.63, 220, 196, 220, 293.66, 246.94];
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.context || document.hidden) return;
      const i = this.noteIndex % bass.length;
      this.noteIndex += 1;
      this.tone(bass[i], 0.5, 'triangle', 0.1);
      if (i % 2 === 0) this.tone(pad[i], 0.9, 'sine', 0.05);
    }, 460);
  }
}
