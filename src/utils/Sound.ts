export const Sound = {
  ctx: null as AudioContext | null,

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  },

  playTone(freq: number, duration: number, type: OscillatorType = 'sine') {
    if (!this.ctx) this.init();
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  },

  beep() {
    this.playTone(800, 0.1);
  },

  doubleBeep() {
    this.playTone(800, 0.1);
    setTimeout(() => this.playTone(800, 0.1), 150);
  },

  warn() {
    // 3 rapid beeps
    const now = this.ctx?.currentTime || 0;
    this.playTone(800, 0.08, 'square');
    setTimeout(() => this.playTone(800, 0.08, 'square'), 120);
    setTimeout(() => this.playTone(800, 0.08, 'square'), 240);
  },

  tick() {
    this.playTone(1200, 0.05);
  }
};
