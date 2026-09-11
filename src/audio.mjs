/** Original synthesized sounds. No audio work begins before start(). */
const MASTER_LEVEL = 0.38;
const MAX_VOICES = 24;
const EVENT_GAPS = Object.freeze({
  jump: 0.11, land: 0.13, star: 0.065, transform: 0.8,
  loop: 0.7, finish: 1.2, start: 0.5, select: 0.08, turbo: 0.7, crush: 0.25,
  'buddy-sunny': 1.8, 'buddy-splash': 1.8,
});

export class GameAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.engineGain = null;
    this.engine = [];
    this.muted = false;
    this.driving = false;
    this.paused = false;
    this.voices = new Set();
    this.lastEvents = new Map();
    this.starNote = 0;
    this.speed = 1;
    this.airborne = false;
    this.transformed = false;
  }

  /** Call directly from a click, tap, or key gesture. Unsupported audio is OK. */
  async start() {
    try {
      if (!this.context || this.context.state === 'closed') {
        const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AudioContextClass) return false;
        this.context = new AudioContextClass();
        this.master = this.context.createGain();
        this.master.gain.value = this.muted || this.paused ? 0 : MASTER_LEVEL;
        this.master.connect(this.context.destination);

        this.engineGain = this.context.createGain();
        this.engineGain.gain.value = 0;
        this.engineGain.connect(this.master);
        this.engine = [this.context.createOscillator(), this.context.createOscillator()];
        this.engine[0].type = 'triangle';
        this.engine[0].frequency.value = 62;
        this.engine[1].type = 'sine';
        this.engine[1].frequency.value = 31;
        for (const oscillator of this.engine) {
          oscillator.connect(this.engineGain);
          oscillator.start();
        }
        this.lastEvents.clear();
      }
      if (this.context.state === 'suspended' && !this.paused) await this.context.resume();
      this._setMaster();
      this.update(this.speed, this.airborne, this.transformed);
      return this.context.state === 'running';
    } catch {
      // Browser audio restrictions must never stop a child from playing.
      this._setMaster();
      return false;
    }
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    this._setMaster();
    if (this.muted) this._clearVoices();
  }

  setDriving(driving) {
    this.driving = Boolean(driving);
    this.update(this.speed, this.airborne, this.transformed);
  }

  /** Adjust existing engine nodes; this method never creates audio nodes. */
  update(speed = 1, airborne = false, transformed = false) {
    this.speed = Number.isFinite(speed) ? Math.max(0, Math.min(3, speed)) : 1;
    this.airborne = Boolean(airborne);
    this.transformed = Boolean(transformed);
    if (!this.context || !this.engineGain || this.engine.length !== 2) return;
    try {
      const now = this.context.currentTime;
      const pitch = 42 + this.speed * 24 + (this.airborne ? 13 : 0);
      this.engine[0].frequency.setTargetAtTime(pitch, now, 0.08);
      this.engine[1].frequency.setTargetAtTime(pitch * (this.transformed ? 0.375 : 0.5), now, 0.1);
      const level = this.driving && !this.paused ? (this.airborne ? 0.027 : 0.047) : 0;
      this.engineGain.gain.setTargetAtTime(level, now, 0.07);
    } catch {
      // A context may close between frames on mobile browsers.
    }
  }

  play(event) {
    if (!this.context || !this.master || this.muted || this.paused || this.context.state !== 'running') return;
    if (!Object.hasOwn(EVENT_GAPS, event)) return;
    try {
      const now = this.context.currentTime;
      const previous = this.lastEvents.get(event) ?? -Infinity;
      if (now - previous < EVENT_GAPS[event]) return;
      this.lastEvents.set(event, now);
      switch (event) {
        case 'turbo':
          this._tone(110, 0, .42, .09, 'triangle', 440);
          this._tone(330, .09, .3, .06, 'sine', 880);
          break;
        case 'crush':
          this._tone(145, 0, .13, .09, 'triangle', 68);
          this._tone(659.25, .055, .17, .085);
          this._tone(987.77, .14, .23, .065);
          break;
        case 'buddy-sunny':
          this._tone(523.25, 0, .12, .035, 'sine', 659.25);
          this._tone(783.99, .13, .13, .025);
          break;
        case 'buddy-splash':
          this._tone(392, 0, .15, .035, 'sine', 523.25);
          this._tone(587.33, .17, .17, .025);
          break;
        case 'jump':
          this._tone(196, 0, 0.23, 0.12, 'sine', 523.25);
          break;
        case 'land':
          this._tone(108, 0, 0.16, 0.15, 'sine', 58);
          this._tone(220, 0.015, 0.09, 0.035);
          break;
        case 'star': {
          const note = [783.99, 880, 1046.5, 1174.66, 1318.51][this.starNote++ % 5];
          this._tone(note, 0, 0.16, 0.1);
          this._tone(note * 1.5, 0.035, 0.12, 0.035);
          break;
        }
        case 'transform':
          [261.63, 329.63, 392, 523.25, 659.25, 783.99].forEach((note, index) => {
            this._tone(note, index * 0.075, 0.23, 0.105, 'triangle');
          });
          this._tone(130.81, 0, 0.58, 0.075);
          break;
        case 'loop':
          [523.25, 659.25, 783.99, 1046.5].forEach((note, index) => {
            this._tone(note, index * 0.09, 0.25, 0.1);
          });
          break;
        case 'finish':
          [523.25, 659.25, 783.99, 659.25, 783.99, 1046.5].forEach((note, index) => {
            this._tone(note, index * 0.14, index === 5 ? 0.6 : 0.22, 0.12, 'triangle');
          });
          this._tone(261.63, 0.7, 0.6, 0.08);
          this._tone(392, 0.7, 0.6, 0.055);
          break;
        case 'start':
          [392, 523.25, 659.25].forEach((note, index) => this._tone(note, index * 0.1, 0.23, 0.11));
          break;
        case 'select':
          this._tone(659.25, 0, 0.12, 0.085);
          this._tone(880, 0.055, 0.15, 0.075);
          break;
      }
    } catch {
      // Effects are optional even when the browser interrupts its audio device.
    }
  }

  pause() {
    this.paused = true;
    this._setMaster();
    this._clearVoices();
    this.update(this.speed, this.airborne, this.transformed);
    try {
      const result = this.context?.suspend();
      if (result?.catch) result.catch(() => {});
    } catch {
      // The master gain already guarantees silence if suspension is denied.
    }
  }

  /** Resume an existing graph; creating audio still requires start(). */
  async resume() {
    this.paused = false;
    if (!this.context || this.context.state === 'closed') return false;
    try {
      if (this.context.state !== 'running') await this.context.resume();
      this._setMaster();
      this.update(this.speed, this.airborne, this.transformed);
      return this.context.state === 'running' && !this.paused;
    } catch {
      this._setMaster();
      return false;
    }
  }

  _setMaster() {
    if (!this.context || !this.master) return;
    try {
      const now = this.context.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.muted || this.paused ? 0 : MASTER_LEVEL, now);
    } catch {
      // Some browsers reject automation after the audio device has closed.
      try { this.master.gain.value = this.muted || this.paused ? 0 : MASTER_LEVEL; } catch {}
    }
  }

  _clearVoices() {
    for (const voice of this.voices) this._stopVoice(voice);
  }

  _stopVoice(voice) {
    this.voices.delete(voice);
    try { voice.oscillator.onended = null; } catch {}
    try { voice.oscillator.stop(); } catch {}
    try { voice.oscillator.disconnect(); } catch {}
    try { voice.gain.disconnect(); } catch {}
  }

  _tone(frequency, delay, duration, volume, type = 'sine', endFrequency = frequency) {
    if (this.muted || this.paused || !this.context || !this.master) return;
    while (this.voices.size >= MAX_VOICES) this._stopVoice(this.voices.values().next().value);
    let oscillator;
    let gain;
    let voice;
    try {
      const begin = this.context.currentTime + delay;
      const end = begin + duration;
      oscillator = this.context.createOscillator();
      gain = this.context.createGain();
      voice = { oscillator, gain };
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, begin);
      if (frequency !== endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, end);
      gain.gain.value = 0;
      gain.gain.setValueAtTime(0, begin);
      gain.gain.linearRampToValueAtTime(volume, begin + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(gain);
      gain.connect(this.master);
      this.voices.add(voice);
      oscillator.onended = () => {
        this.voices.delete(voice);
        try { oscillator.disconnect(); } catch {}
        try { gain.disconnect(); } catch {}
      };
      oscillator.start(begin);
      oscillator.stop(end + 0.025);
    } catch {
      if (voice) this._stopVoice(voice);
      else {
        try { oscillator?.disconnect(); } catch {}
        try { gain?.disconnect(); } catch {}
      }
    }
  }
}
