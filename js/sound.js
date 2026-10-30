// Sound for the seven worlds, all synthesised (no audio files). Off until the visitor turns it on.
// Each world has a quiet ambient bed; beds crossfade with the same weights as the visuals.
const BEDS = {
  //            notes (Hz)                     wave        cutoff  level  lfo   noise
  cosmic:    { notes: [55, 82.4, 164.8, 246.9], type: 'sine',     cut: 900,  lvl: 0.20, lfo: 0.05, noise: 0 },
  clay:      { notes: [130.8, 164.8, 196, 261.6], type: 'triangle', cut: 1400, lvl: 0.10, lfo: 0.6, noise: 0 },
  glass:     { notes: [164.8, 246.9, 329.6, 493.9], type: 'sine',   cut: 2600, lvl: 0.12, lfo: 0.12, noise: 0 },
  arena:     { notes: [41.2, 61.7, 82.4],         type: 'sawtooth', cut: 260,  lvl: 0.20, lfo: 1.0, noise: 0.05 },
  fantasy:   { notes: [73.4, 110, 146.8, 174.6, 220], type: 'sawtooth', cut: 700, lvl: 0.07, lfo: 0.2, noise: 0 },
  concrete:  { notes: [49, 98],                   type: 'sine',     cut: 300,  lvl: 0.10, lfo: 0.0, noise: 0.25 },
  studio:    { notes: [174.6, 220, 261.6, 329.6], type: 'triangle', cut: 1800, lvl: 0.08, lfo: 0.3, noise: 0 },
  editorial: { notes: [98, 146.8],                type: 'sine',     cut: 700,  lvl: 0.06, lfo: 0.05, noise: 0 },
  void:      { notes: [55, 110],                  type: 'sine',     cut: 400,  lvl: 0.05, lfo: 0.03, noise: 0 },
};

export function createSound() {
  let ctx = null, master = null, noiseBuf = null;
  const beds = {};
  let on = false;

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); let b = 0;
    for (let i = 0; i < d.length; i++) { b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = b * 3.5; } // brown noise
    for (const [name, B] of Object.entries(BEDS)) {
      const bus = ctx.createGain(); bus.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = B.cut; lp.Q.value = 0.7;
      lp.connect(bus); bus.connect(master);
      B.notes.forEach((f, i) => {
        const o = ctx.createOscillator(); o.type = B.type; o.frequency.value = f; o.detune.value = (i % 2 ? 6 : -6);
        const g = ctx.createGain(); g.gain.value = 1 / B.notes.length;
        if (B.lfo) { // a slow swell per voice so the bed breathes
          const l = ctx.createOscillator(); l.frequency.value = B.lfo * (1 + i * 0.37);
          const lg = ctx.createGain(); lg.gain.value = 0.45 / B.notes.length; l.connect(lg).connect(g.gain); l.start();
        }
        o.connect(g).connect(lp); o.start();
      });
      if (B.noise) {
        const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
        const ng = ctx.createGain(); ng.gain.value = B.noise; n.connect(ng).connect(lp); n.start();
      }
      beds[name] = { bus, lvl: B.lvl };
    }
  }

  function setWeights(w) {
    if (!on || !ctx) return;
    const t = ctx.currentTime;
    for (const [name, bed] of Object.entries(beds)) bed.bus.gain.setTargetAtTime((w[name] || 0) * bed.lvl, t, 0.4);
  }

  // short effects
  function tone(f0, f1, dur, type = 'square', vol = 0.12, delay = 0) {
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, from, to, vol = 0.3, type = 'bandpass', delay = 0) {
    const t = ctx.currentTime + delay;
    const n = ctx.createBufferSource(); n.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = 1.2;
    f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f).connect(g).connect(master); n.start(t); n.stop(t + dur + 0.05);
  }
  const FX = {
    beep: () => { tone(880, 1320, 0.09, 'square', 0.06); tone(1320, 990, 0.1, 'square', 0.05, 0.1); },
    shot: () => { noise(0.22, 3000, 300, 0.9, 'lowpass'); tone(160, 50, 0.16, 'sine', 0.25); },
    hit: () => { tone(1800, 2400, 0.05, 'square', 0.05); tone(2400, 2400, 0.04, 'square', 0.04, 0.05); },
    coin: () => { tone(988, 988, 0.08, 'square', 0.06); tone(1319, 1319, 0.22, 'square', 0.06, 0.08); },
    // spells: a charge while the bolt flies, then each school's own sound when it lands (0.38 s)
    charge: () => { noise(0.4, 400, 2600, 0.25); tone(300, 900, 0.38, 'sine', 0.05); },
    spell_fire: () => { FX.charge(); noise(0.7, 2400, 200, 0.9, 'lowpass', 0.38); tone(110, 40, 0.6, 'sine', 0.3, 0.38); for (let i = 0; i < 7; i++) noise(0.05, 5000, 2500, 0.3, 'highpass', 0.45 + i * 0.09 + Math.random() * 0.05); },
    spell_water: () => { FX.charge(); noise(0.8, 1800, 300, 0.4, 'lowpass', 0.38); for (let i = 0; i < 6; i++) tone(300 + Math.random() * 200, 900 + Math.random() * 500, 0.08, 'sine', 0.06, 0.4 + i * 0.07); },
    spell_wind: () => { FX.charge(); noise(1.2, 300, 3000, 0.6, 'bandpass', 0.3); noise(1.0, 2500, 400, 0.35, 'bandpass', 0.8); },
    spell_stone: () => { FX.charge(); tone(80, 32, 0.5, 'sine', 0.45, 0.38); noise(0.35, 1400, 150, 0.7, 'lowpass', 0.38); for (let i = 0; i < 6; i++) tone(220 + Math.random() * 120, 120, 0.05, 'triangle', 0.08, 0.7 + i * 0.12 + Math.random() * 0.06); },
    spell_healing: () => { FX.charge(); [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, f, 0.7, 'sine', 0.05, 0.38 + i * 0.08)); tone(392, 784, 1.0, 'triangle', 0.03, 0.38); },
    splat: () => { noise(0.18, 900, 200, 0.5, 'lowpass'); },
    hop: () => { tone(300, 600, 0.12, 'sine', 0.06); },
  };

  return {
    get on() { return on; },
    toggle() {
      if (!ctx) build();
      on = !on;
      if (on) ctx.resume();
      master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.25);
      return on;
    },
    setWeights,
    fx(name) { if (on && ctx && FX[name]) FX[name](); },
  };
}
