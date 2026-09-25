// Every sound and every note of music is synthesised live with WebAudio — nothing to download.
let ctx = null, master = null, sfxBus = null, musicBus = null, comp = null, verb = null;
let musicOn = true, sfxOn = true;
try { musicOn = localStorage.getItem('gp.music') !== '0'; sfxOn = localStorage.getItem('gp.sfx') !== '0'; } catch { }

export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(ctx.destination);
  master = ctx.createGain(); master.gain.value = 0.8; master.connect(comp);
  sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? 1 : 0; sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? 0.42 : 0; musicBus.connect(master);
  // small room reverb from a noise impulse
  verb = ctx.createConvolver();
  const len = ctx.sampleRate * 1.4, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
  verb.buffer = ir; const vg = ctx.createGain(); vg.gain.value = 0.22; verb.connect(vg); vg.connect(master);
  music.tick();
}
export function setMusic(on) { musicOn = on; try { localStorage.setItem('gp.music', on ? '1' : '0'); } catch { } if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.42 : 0, ctx.currentTime, 0.1); }
export function setSfx(on) { sfxOn = on; try { localStorage.setItem('gp.sfx', on ? '1' : '0'); } catch { } if (sfxBus) sfxBus.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.05); }
export const audioState = () => ({ music: musicOn, sfx: sfxOn });
const now = () => ctx ? ctx.currentTime : 0;
const midi = m => 440 * Math.pow(2, (m - 69) / 12);

// ------------------------------------------------------------------ building blocks
let noiseBuf = null;
function nb() { if (!noiseBuf) { const n = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; } return noiseBuf; }
// out: a node chain end (panner/gain) — defaults to sfx bus
function tone(f, t0, dur, { type = 'sine', vol = 0.3, attack = 0.004, slide = 0, out = sfxBus, send = 0 } = {}) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t0 + dur);
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
  o.connect(g); g.connect(out); if (send) { const s = ctx.createGain(); s.gain.value = send; g.connect(s); s.connect(verb); }
  o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise(t0, dur, { vol = 0.3, f = 2000, q = 1, type = 'bandpass', slide = 0, out = sfxBus, attack = 0.002, send = 0 } = {}) {
  if (!ctx) return;
  const s = ctx.createBufferSource(); s.buffer = nb(); s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t0); fl.Q.value = q;
  if (slide) fl.frequency.exponentialRampToValueAtTime(Math.max(40, f * slide), t0 + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
  s.connect(fl); fl.connect(g); g.connect(out); if (send) { const sg = ctx.createGain(); sg.gain.value = send; g.connect(sg); sg.connect(verb); }
  s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.05);
}
// positional: returns an output node panned/attenuated for a world position relative to the listener
let listener = { x: 0, y: 0, z: 0, rx: 1, rz: 0 };
export function setListener(x, y, z, yaw) { listener = { x, y, z, rx: Math.cos(yaw), rz: -Math.sin(yaw) }; }
function at(pos, base = 1) {
  if (!ctx) return null;
  if (!pos) return sfxBus;
  const dx = pos[0] - listener.x, dy = pos[1] - listener.y, dz = pos[2] - listener.z, d = Math.hypot(dx, dy, dz);
  const g = ctx.createGain(); g.gain.value = base / (1 + d / 7);
  const p = ctx.createStereoPanner(); p.pan.value = d > 0.1 ? Math.max(-1, Math.min(1, (dx * listener.rx + dz * listener.rz) / d)) * 0.85 : 0;
  // far sounds lose their top end
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 18000 / (1 + d / 12);
  g.connect(lp); lp.connect(p); p.connect(sfxBus);
  setTimeout(() => { try { g.disconnect(); lp.disconnect(); p.disconnect(); } catch { } }, 2500);
  return g;
}

// ------------------------------------------------------------------ sound effects
export const sfx = {
  click() { if (!ctx) return; tone(2200, now(), 0.03, { vol: 0.08 }); },
  hover() { if (!ctx) return; tone(1500, now(), 0.02, { vol: 0.03 }); },
  // pneumatic marker: sharp air crack + low thump + bolt clack
  shot(pos, mine) {
    if (!ctx) return; const t = now(), o = at(pos, mine ? 0.9 : 1.2);
    noise(t, 0.09, { f: 1400, q: 0.9, vol: 0.55, slide: 0.4, out: o, send: 0.2 });
    noise(t, 0.035, { f: 5200, q: 1.5, vol: 0.35, out: o });
    tone(150, t, 0.09, { vol: 0.35, slide: 0.45, out: o });
    noise(t + 0.03, 0.02, { f: 3200, q: 8, vol: 0.18, out: o });
  },
  whiz(pos) { if (!ctx) return; const t = now(), o = at(pos, 1); noise(t, 0.22, { f: 2600, q: 5, vol: 0.2, slide: 0.35, out: o, attack: 0.08 }); },
  splat(pos, soft) {
    if (!ctx) return; const t = now(), o = at(pos, soft ? 0.6 : 1);
    noise(t, 0.14, { f: 700, q: 1.2, vol: 0.5, slide: 0.4, out: o, send: 0.15 });
    noise(t, 0.05, { f: 2400, q: 2, vol: 0.25, out: o });
    tone(260, t, 0.08, { vol: 0.12, slide: 0.4, out: o, type: 'triangle' });
  },
  // a paintball hitting a googly: wet slap + a little "oof"
  hitBody(pos, head) {
    if (!ctx) return; const t = now(), o = at(pos, 1.3);
    noise(t, 0.16, { f: 520, q: 1, vol: 0.7, slide: 0.35, out: o });
    tone(head ? 520 : 330, t + 0.02, 0.18, { type: 'sawtooth', vol: 0.08, slide: 0.55, out: o });
    tone(head ? 780 : 480, t + 0.02, 0.14, { type: 'triangle', vol: 0.08, slide: 0.6, out: o });
  },
  hitmark(head) { if (!ctx) return; const t = now(); tone(head ? 1900 : 1400, t, 0.07, { vol: 0.22, type: 'triangle' }); if (head) tone(2600, t + 0.05, 0.08, { vol: 0.15 }); },
  hurt() { if (!ctx) return; const t = now(); noise(t, 0.2, { f: 400, q: 0.8, vol: 0.6, slide: 0.4 }); tone(240, t, 0.25, { type: 'sawtooth', vol: 0.1, slide: 0.6 }); },
  // painted out: big squelch, sad slide and a googly boing
  out(pos, mine) {
    if (!ctx) return; const t = now(), o = at(pos, mine ? 1.5 : 1.2);
    noise(t, 0.35, { f: 450, q: 0.7, vol: 0.8, slide: 0.3, out: o, send: 0.3 });
    tone(520, t + 0.05, 0.7, { type: 'sawtooth', vol: 0.09, slide: 0.35, out: o });
    tone(220, t + 0.35, 0.35, { type: 'sine', vol: 0.25, slide: 2.4, out: o });
  },
  tagged() { if (!ctx) return; const t = now(); [76, 81, 88].forEach((m, i) => tone(midi(m), t + i * 0.06, 0.25, { type: 'square', vol: 0.07, send: 0.2 })); tone(midi(64), t, 0.3, { type: 'triangle', vol: 0.15 }); },
  empty() { if (!ctx) return; const t = now(); noise(t, 0.02, { f: 4200, q: 6, vol: 0.3 }); tone(900, t, 0.02, { vol: 0.08, type: 'square' }); },
  // hopper rattle while reloading: a pod of balls pouring in
  reload() {
    if (!ctx) return; const t = now();
    noise(t, 0.08, { f: 1800, q: 3, vol: 0.25 });                                      // pod lid pop
    for (let i = 0; i < 34; i++) { const d = 0.15 + Math.random() * 1.0; noise(t + d, 0.02, { f: 2000 + Math.random() * 2500, q: 10, vol: 0.12 + Math.random() * 0.1 }); }
    noise(t + 1.3, 0.05, { f: 1200, q: 4, vol: 0.3 }); tone(600, t + 1.35, 0.05, { vol: 0.1, type: 'square' });   // lid snap
  },
  pickup() { if (!ctx) return; const t = now(); for (let i = 0; i < 12; i++) noise(t + i * 0.02, 0.02, { f: 2600 + Math.random() * 1500, q: 10, vol: 0.2 }); [72, 79, 84].forEach((m, i) => tone(midi(m), t + 0.1 + i * 0.07, 0.2, { type: 'triangle', vol: 0.12 })); },
  step(pos, surf = 'turf', v = 1) {
    if (!ctx) return; const t = now(), o = at(pos, 0.55 * v);
    if (surf === 'concrete') { noise(t, 0.05, { f: 1800, q: 2, vol: 0.25, out: o }); tone(95, t, 0.05, { vol: 0.1, out: o }); }
    else if (surf === 'forest') { noise(t, 0.08, { f: 1100, q: 0.8, vol: 0.3, out: o }); for (let i = 0; i < 3; i++) noise(t + Math.random() * 0.05, 0.015, { f: 3000, q: 8, vol: 0.08, out: o }); }
    else noise(t, 0.07, { f: 900, q: 0.7, vol: 0.25, out: o });
  },
  steel(pos) { if (!ctx) return; const t = now(), o = at(pos, 0.5); tone(420, t, 0.12, { type: 'triangle', vol: 0.12, out: o }); noise(t, 0.04, { f: 2500, q: 3, vol: 0.2, out: o }); },
  jump() { if (!ctx) return; const t = now(); tone(260, t, 0.14, { vol: 0.12, slide: 1.8 }); noise(t, 0.05, { f: 900, vol: 0.12 }); },
  land(v = 1) { if (!ctx) return; const t = now(); tone(90, t, 0.12, { vol: 0.25 * v, slide: 0.5 }); noise(t, 0.08, { f: 700, vol: 0.2 * v }); },
  beep(hi) { if (!ctx) return; tone(hi ? 1320 : 880, now(), hi ? 0.5 : 0.18, { type: 'square', vol: 0.09, send: 0.2 }); },
  horn() { if (!ctx) return; const t = now(); for (const f of [220, 277, 330]) tone(f, t, 0.9, { type: 'sawtooth', vol: 0.07, attack: 0.02, send: 0.3 }); },
  win() { if (!ctx) return; const t = now(); [67, 72, 76, 79, 84, 88, 91].forEach((m, i) => { tone(midi(m), t + i * 0.1, 0.6, { type: 'triangle', vol: 0.16, send: 0.4 }); tone(midi(m - 12), t + i * 0.1, 0.4, { type: 'square', vol: 0.04 }); }); for (let i = 0; i < 20; i++) noise(t + 0.7 + Math.random() * 1.2, 0.05, { f: 3000 + Math.random() * 3000, q: 6, vol: 0.1 }); },
  lose() { if (!ctx) return; const t = now(); [67, 63, 60, 55].forEach((m, i) => tone(midi(m), t + i * 0.2, 0.55, { type: 'triangle', vol: 0.14, send: 0.3 })); },
  unlock() { if (!ctx) return; const t = now(); [72, 76, 79, 84, 88].forEach((m, i) => tone(midi(m), t + i * 0.08, 0.5, { type: 'sine', vol: 0.18, send: 0.5 })); },
  chat() { if (!ctx) return; tone(1200, now(), 0.06, { vol: 0.06 }); },
  join() { if (!ctx) return; const t = now(); tone(660, t, 0.1, { vol: 0.08 }); tone(990, t + 0.08, 0.14, { vol: 0.08 }); },
};

// ------------------------------------------------------------------ music: a little step sequencer
// 'menu' = laid-back funk, 'match' = driving breakbeat, 'end' = victory vamp
const SONGS = {
  menu: { bpm: 100, root: 45, prog: [0, 0, 5, 3], kick: 'x...x.....x.x...', snare: '....x.......x...', hat: 'x.x.xxx.x.x.xxx.', bass: [0, null, 12, null, 0, 0, null, 10, null, 7, null, 0, null, 3, 5, null], lead: [null, null, 12, null, 15, null, 12, 10, null, null, 7, null, 10, null, null, null], pad: true },
  match: { bpm: 132, root: 40, prog: [0, 0, 3, 5, 0, 0, 7, 5], kick: 'x.....x.x.x.....', snare: '....x..x.x..x...', hat: 'xxxxxxxxxxxxxxxx', bass: [0, 0, 12, 0, null, 0, 10, 12, 0, null, 0, 12, 7, null, 5, 3], lead: [12, null, 15, 17, null, 19, 17, 15, 12, null, null, 10, 12, null, null, null], pad: false },
  end: { bpm: 110, root: 48, prog: [0, 5, 7, 5], kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: [0, null, null, 7, null, null, 12, null, 0, null, null, 7, null, 12, null, null], lead: [12, 16, 19, 24, null, 19, 16, null, 12, 16, 19, 24, null, 24, 26, null], pad: true },
};
export const music = {
  song: 'menu', step: 0, next: 0, bar: 0, intensity: 0,
  play(name) { if (this.song === name) return; this.song = name; this.step = 0; this.bar = 0; },
  tick() {
    if (!ctx) return;
    const S = SONGS[this.song], spb = 60 / S.bpm / 4;
    if (this.next < ctx.currentTime) this.next = ctx.currentTime + 0.05;
    while (this.next < ctx.currentTime + 0.15) {
      const s = this.step % 16, t = this.next, chord = S.prog[this.bar % S.prog.length], out = musicBus;
      const swing = this.song === 'menu' && s % 2 ? spb * 0.18 : 0, tt = t + swing;
      if (S.kick[s] === 'x') { tone(150, tt, 0.28, { vol: 0.55, slide: 0.28, out }); noise(tt, 0.01, { f: 3000, vol: 0.1, out }); }
      if (S.snare[s] === 'x') { noise(tt, 0.16, { f: 1900, q: 0.7, vol: 0.32, out, send: 0.3 }); tone(210, tt, 0.08, { vol: 0.14, type: 'triangle', out }); }
      if (S.hat[s] === 'x') noise(tt, s % 4 === 2 ? 0.08 : 0.03, { f: 8500, q: 1, type: 'highpass', vol: s % 4 === 2 ? 0.12 : 0.07, out });
      const b = S.bass[s];
      if (b !== null) { const f = midi(S.root + chord + b); this.bassNote(f, tt, spb * 1.6); }
      const l = S.lead[s];
      if (l !== null && (this.song !== 'menu' || this.bar % 4 >= 2)) tone(midi(S.root + 24 + chord + l), tt, spb * 1.5, { type: this.song === 'match' ? 'square' : 'triangle', vol: this.song === 'match' ? 0.035 : 0.06, out, send: 0.35 });
      if (S.pad && s === 0) for (const iv of [0, 3, 7, 10]) tone(midi(S.root + 12 + chord + iv), t, spb * 15, { type: 'sine', vol: 0.03, attack: 0.3, out, send: 0.5 });
      if (this.song === 'match' && s === 0 && this.bar % 2 === 0) noise(t, 0.6, { f: 6000, q: 0.5, type: 'highpass', vol: 0.06, out, attack: 0.01 });
      this.next += spb; this.step++;
      if (this.step % 16 === 0) this.bar++;
    }
    setTimeout(() => this.tick(), 40);
  },
  bassNote(f, t, dur) {
    const o = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = f;
    fl.type = 'lowpass'; fl.Q.value = 8; fl.frequency.setValueAtTime(1400, t); fl.frequency.exponentialRampToValueAtTime(180, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.2, t + 0.005); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(fl); fl.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 0.05);
  },
};
