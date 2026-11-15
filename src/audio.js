// 모든 소리를 WebAudio로 합성한다: 효과음 · 환경음 · 자동 생성 배경음악
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const pick = (a) => a[(Math.random() * a.length) | 0];
const rnd = (a, b) => a + Math.random() * (b - a);

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11], lydian: [0, 2, 4, 6, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
};
const deg = (scale, d) => scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);

// 분위기별 작곡 규칙
const MOODS = {
  day: {
    bpm: 80, roots: [60, 62, 65, 67, 58], scales: ['major', 'major', 'lydian'], lead: 'flute',
    progs: [[0, 4, 5, 3], [0, 5, 3, 4], [3, 0, 4, 5], [0, 3, 5, 4], [5, 3, 0, 4], [0, 2, 3, 4]],
    arps: [[0, 2, 1, 2, 3, 2, 1, 2], [0, 1, 2, 3, 2, 1, 2, 1], [0, -1, 2, 1, -1, 2, 3, -1], [0, 2, 3, 2, 0, 2, 3, 2]],
    form: [
      { p: 'A', bars: 4, pad: 0.5, arp: 0.45 },
      { p: 'A', bars: 8, pad: 0.5, bass: 0.6, arp: 0.42, lead: 0.62, motif: 0 },
      { p: 'B', bars: 8, pad: 0.55, bass: 0.6, arp: 0.3, lead: 0.62, motif: 1 },
      { p: 'A', bars: 8, pad: 0.5, bass: 0.6, arp: 0.42, lead: 0.66, motif: 0 },
      { p: 'A', bars: 4, pad: 0.5, arp: 0.3 },
    ],
    rest: [22, 45],
  },
  night: {
    bpm: 62, roots: [57, 60, 62, 55], scales: ['major', 'lydian', 'dorian'], lead: 'bell',
    progs: [[0, 3, 0, 4], [5, 3, 0, 4], [0, 2, 3, 3], [3, 4, 5, 5]],
    arps: [[0, -1, 2, -1, 1, -1, 3, -1], [0, -1, -1, 2, -1, -1, 1, -1], [0, -1, 1, -1, 2, -1, 1, -1]],
    form: [
      { p: 'A', bars: 4, pad: 0.6 },
      { p: 'A', bars: 8, pad: 0.6, arp: 0.36, lead: 0.42, motif: 0 },
      { p: 'B', bars: 8, pad: 0.62, bass: 0.4, lead: 0.42, motif: 1 },
      { p: 'A', bars: 4, pad: 0.6, arp: 0.28 },
    ],
    rest: [28, 55],
  },
  cave: {
    bpm: 54, roots: [57, 55, 52, 50], scales: ['minor', 'dorian', 'minor'], lead: 'flute', low: true,
    progs: [[0, 5, 2, 6], [0, 3, 0, 4], [0, 6, 5, 6], [0, 2, 3, 0]],
    arps: [[0, -1, -1, 2, -1, -1, -1, 1], [-1, 0, -1, -1, 3, -1, 2, -1], [0, -1, 2, -1, -1, 3, -1, -1]],
    form: [
      { p: 'A', bars: 4, pad: 0.7, boom: 1 },
      { p: 'A', bars: 8, pad: 0.7, arp: 0.4, echo: 1, boom: 1 },
      { p: 'B', bars: 8, pad: 0.7, arp: 0.34, echo: 1, lead: 0.3, motif: 0 },
      { p: 'A', bars: 4, pad: 0.62, arp: 0.25, echo: 1 },
    ],
    rest: [30, 60],
  },
};

function makeMotif(density) {
  const notes = []; let slot = 0, off = pick([0, 2, 4]);
  const tones = [0, 2, 4, 7];
  while (slot < 16) {
    const strong = slot % 4 === 0;
    if (Math.random() < (strong ? 0.86 : density)) {
      if (strong) { const want = off + pick([-2, -1, 0, 1, 2]); off = tones.reduce((a, b) => (Math.abs(b - want) < Math.abs(a - want) ? b : a)); }
      else off = Math.max(-1, Math.min(8, off + pick([-1, 1, 1, -1, 2, -2])));
      const len = Math.min(pick([1, 1, 2, 2, 2, 3, 4]), 16 - slot);
      notes.push({ slot, len, off });
      slot += len;
    } else slot++;
  }
  const last = notes[notes.length - 1];
  if (last) { last.off = pick([0, 0, 4, 2]); last.len = Math.max(last.len, Math.min(4, 16 - last.slot)); }
  return notes;
}

function makeSong(mood) {
  const M = MOODS[mood], root = pick(M.roots), scale = SCALES[pick(M.scales)];
  const beat = 60 / (M.bpm + rnd(-4, 4));
  const progA = pick(M.progs), progB = pick(M.progs.filter((p) => p !== progA));
  const motifs = [makeMotif(0.4), makeMotif(0.3)];
  const arpA = pick(M.arps), arpB = pick(M.arps);
  const ev = []; let bar = 0;
  const fold = (m, lo, hi) => { while (m < lo) m += 12; while (m > hi) m -= 12; return m; };
  for (const sec of M.form) {
    const prog = sec.p === 'A' ? progA : progB, arp = sec.p === 'A' ? arpA : arpB;
    for (let b = 0; b < sec.bars; b++, bar++) {
      const d0 = prog[b % prog.length], d = d0 > 3 ? d0 - 7 : d0, t0 = bar * 4;
      if (sec.pad) for (const k of [0, 2, 4]) ev.push({ t: t0, k: 'pad', m: fold(root + deg(scale, d + k), 50, 66), d: 4.2, v: sec.pad });
      if (sec.bass) {
        const bm = fold(root + deg(scale, d), 36, 47);
        ev.push({ t: t0, k: 'bass', m: bm, d: 1.8, v: sec.bass });
        if (Math.random() < 0.6) ev.push({ t: t0 + 2.5, k: 'bass', m: Math.random() < 0.5 ? bm + 7 : bm, d: 1.2, v: sec.bass * 0.7 });
      }
      if (sec.boom && b % 4 === 0) ev.push({ t: t0, k: 'boom', m: fold(root + deg(scale, d), 28, 39), d: 6, v: 0.5 });
      if (sec.arp) {
        for (let s = 0; s < 8; s++) {
          const k = arp[s];
          if (k < 0) continue;
          const m = fold(root + deg(scale, d + [0, 2, 4, 7][k]), M.low ? 57 : 62, M.low ? 76 : 81);
          ev.push({ t: t0 + s * 0.5, k: 'pluck', m, d: M.low ? 3 : 1.4, v: sec.arp * (s % 2 ? 0.75 : 1) * rnd(0.85, 1), echo: sec.echo });
        }
      }
      if (sec.lead) {
        const half = (b % 2) * 8;
        for (const n of motifs[sec.motif || 0]) {
          if (n.slot < half || n.slot >= half + 8) continue;
          // 4마디 프레이즈의 마지막 마디는 조금 쉬어 준다
          if (b % 4 === 3 && n.slot - half >= 6) continue;
          const m = fold(root + 12 + deg(scale, d + n.off), M.low ? 60 : 69, M.low ? 77 : 86);
          ev.push({ t: t0 + (n.slot - half) * 0.5, k: M.lead, m, d: n.len * 0.5, v: sec.lead });
        }
      }
    }
  }
  // 으뜸화음으로 마무리
  const tEnd = bar * 4;
  for (const k of [0, 2, 4]) ev.push({ t: tEnd, k: 'pad', m: fold(root + deg(scale, k), 50, 66), d: 5, v: 0.5 });
  ev.push({ t: tEnd, k: 'pluck', m: fold(root + 12, 62, 81), d: 3, v: 0.4, echo: M.low });
  ev.sort((a, b) => a.t - b.t);
  return { ev, beat, len: tEnd + 6, i: 0, mood };
}

export class AudioSys {
  constructor() {
    this.ctx = null; this.ready = false;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('mf_vol') || 'null'); } catch { /* 무시 */ }
    this.vol = saved && typeof saved.sfx === 'number' ? saved : { sfx: 0.8, music: 0.6 };
    this.scene = null; this.song = null; this.nextSongAt = 0; this.songGain = null;
    this.combo = { t: 0, n: 0 };
    this.ambToken = 0; this.loops = [];
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend(); else this.ctx.resume();
    });
  }

  // 첫 사용자 입력 때 호출 (브라우저 자동재생 정책)
  unlock() {
    if (!this.ctx) this.build();
    if (this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume();
  }

  build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    const c = (this.ctx = new AC());
    const G = (v, to) => { const g = c.createGain(); g.gain.value = v; if (to) g.connect(to); return g; };
    this.master = G(0.9);
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.22;
    this.master.connect(comp); comp.connect(c.destination);
    this.analyser = c.createAnalyser(); this.analyser.fftSize = 2048; comp.connect(this.analyser);
    this.sfxBus = G(this.vol.sfx, this.master);
    this.ambBus = G(this.vol.sfx * 0.6, this.master);
    this.musicBus = G(this.vol.music * 0.5, this.master);
    // 잔향
    const len = Math.floor(c.sampleRate * 2.8), ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch); let lp = 0;
      for (let i = 0; i < len; i++) {
        const k = i / len;
        lp += ((Math.random() * 2 - 1) - lp) * (0.55 - k * 0.4);
        d[i] = lp * Math.pow(1 - k, 2.6) * (i < 400 ? i / 400 : 1);
      }
    }
    this.rev = c.createConvolver(); this.rev.buffer = ir;
    this.revIn = G(1, this.rev); this.rev.connect(G(0.55, this.master));
    // 메아리 (동굴)
    const dl = c.createDelay(1.5); dl.delayTime.value = 0.41;
    const fb = G(0.46), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    this.echoIn = G(1, dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(G(0.5, this.master)); lp.connect(G(0.3, this.revIn));
    // 잡음 버퍼
    const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    this.ready = true;
    setInterval(() => this.musicTick(), 90);
    if (this.scene) { const s = this.scene; this.scene = null; this.setScene(s); }
  }

  setVolume(kind, v) {
    this.vol[kind] = v;
    try { localStorage.setItem('mf_vol', JSON.stringify(this.vol)); } catch { /* 무시 */ }
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.03);
    this.ambBus.gain.setTargetAtTime(this.vol.sfx * 0.6, t, 0.03);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.5, t, 0.03);
  }
  // 디버그: 현재 출력 크기(RMS)
  level() {
    if (!this.ready) return 0;
    const b = new Float32Array(this.analyser.fftSize); this.analyser.getFloatTimeDomainData(b);
    let s = 0; for (const v of b) s += v * v;
    return Math.sqrt(s / b.length);
  }

  // ── 기본 음원 ──
  out(dest, send = 0, echo = 0, pan = 0) {
    const c = this.ctx, g = c.createGain();
    let tail = g;
    if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); tail = p; }
    tail.connect(dest || this.sfxBus);
    if (send > 0) { const s = c.createGain(); s.gain.value = send; tail.connect(s); s.connect(this.revIn); }
    if (echo > 0) { const s = c.createGain(); s.gain.value = echo; tail.connect(s); s.connect(this.echoIn); }
    return g;
  }
  tone({ type = 'sine', f, f2, t = 0, dur = 0.15, vol = 0.2, attack = 0.004, dest, send = 0, echo = 0, pan = 0, lp }) {
    const c = this.ctx, t0 = c.currentTime + t, o = c.createOscillator(), g = this.out(dest, send, echo, pan);
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    if (lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl); fl.connect(g); } else o.connect(g);
    o.start(t0); o.stop(t0 + dur + 0.03);
  }
  noise({ type = 'bandpass', f = 1000, f2, q = 1, t = 0, dur = 0.1, vol = 0.2, attack = 0.002, dest, send = 0, echo = 0, pan = 0 }) {
    const c = this.ctx, t0 = c.currentTime + t, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = this.out(dest, send, echo, pan);
    s.buffer = this.noiseBuf; s.loop = true;
    fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, t0);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(fl); fl.connect(g);
    s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.03);
  }

  // ── 효과음 ──
  // k: 소리 크기 배수 (멀리서 나는 소리는 작게)
  play(name, k = 1) {
    if (!this.ready || this.ctx.state !== 'running') return;
    const cave = this.scene === 'cave';
    const S = cave ? 0.28 : 0.04, E = cave ? 0.16 : 0;   // 동굴에서는 소리가 울린다
    const p = rnd(0.92, 1.08);
    const T = (o) => this.tone({ send: S, echo: E, ...o, vol: (o.vol ?? 0.2) * k });
    const N = (o) => this.noise({ send: S, echo: E, ...o, vol: (o.vol ?? 0.2) * k });
    switch (name) {
      case 'hit_wood':
        N({ f: 430 * p, q: 1.3, dur: 0.09, vol: 0.5 }); T({ type: 'triangle', f: 160 * p, f2: 92, dur: 0.11, vol: 0.5 }); T({ type: 'square', f: 320 * p, f2: 210, dur: 0.035, vol: 0.06 }); break;
      case 'hit_stone':
        N({ f: 2700 * p, q: 2.2, dur: 0.05, vol: 0.34 }); T({ type: 'triangle', f: 900 * p, f2: 520, dur: 0.06, vol: 0.16 }); T({ f: 190 * p, f2: 120, dur: 0.08, vol: 0.28 }); break;
      case 'hit_plant': N({ f: 1900 * p, q: 0.8, dur: 0.07, vol: 0.2 }); break;
      case 'hit_dirt': N({ type: 'lowpass', f: 520 * p, dur: 0.09, vol: 0.4 }); break;
      case 'break_wood':
        N({ f: 520 * p, f2: 240, q: 0.9, dur: 0.24, vol: 0.5 }); T({ type: 'triangle', f: 185 * p, f2: 62, dur: 0.24, vol: 0.5 }); T({ type: 'square', f: 430, f2: 130, dur: 0.08, vol: 0.07 }); break;
      case 'break_stone':
        N({ f: 1500 * p, f2: 420, q: 0.8, dur: 0.3, vol: 0.5 }); T({ type: 'triangle', f: 240 * p, f2: 70, dur: 0.26, vol: 0.45 });
        for (const t of [0.07, 0.13, 0.2]) N({ type: 'highpass', f: 3000, dur: 0.03, vol: 0.13, t: t + rnd(0, 0.03) });
        break;
      case 'break_plant': N({ f: 2300 * p, f2: 900, q: 0.7, dur: 0.17, vol: 0.28 }); T({ f: 520 * p, f2: 320, dur: 0.06, vol: 0.08 }); break;
      case 'break_dirt': N({ type: 'lowpass', f: 720 * p, f2: 200, dur: 0.2, vol: 0.45 }); break;
      case 'treefall':
        T({ type: 'sawtooth', f: 92, f2: 54, dur: 0.5, vol: 0.1, lp: 500 }); N({ f: 320, q: 0.6, dur: 0.55, vol: 0.26, attack: 0.3 });
        N({ f: 3200, q: 0.5, dur: 0.6, vol: 0.1, attack: 0.2 });
        T({ f: 82, f2: 40, dur: 0.32, vol: 0.7, t: 0.46 }); N({ type: 'lowpass', f: 320, dur: 0.26, vol: 0.5, t: 0.46 });
        break;
      case 'pickup': {
        const now = this.ctx.currentTime;
        this.combo.n = now - this.combo.t < 0.6 ? Math.min(this.combo.n + 1, 9) : 0; this.combo.t = now;
        const f = 640 * Math.pow(2, this.combo.n / 12);
        T({ f, f2: f * 1.9, dur: 0.09, vol: 0.2 }); T({ type: 'triangle', f: f * 2, dur: 0.07, vol: 0.09, t: 0.05 });
        break;
      }
      case 'place': T({ f: 230 * p, f2: 140, dur: 0.08, vol: 0.4 }); N({ type: 'lowpass', f: 900, dur: 0.05, vol: 0.22 }); break;
      case 'place_stone': T({ type: 'triangle', f: 310 * p, f2: 180, dur: 0.07, vol: 0.34 }); N({ f: 1900, q: 1.5, dur: 0.05, vol: 0.24 }); break;
      case 'craft':
        N({ f: 1300, q: 2, dur: 0.03, vol: 0.14 });
        T({ type: 'triangle', f: 660, dur: 0.1, vol: 0.2, send: 0.2 }); T({ type: 'triangle', f: 880, dur: 0.11, vol: 0.2, t: 0.08, send: 0.2 }); T({ type: 'triangle', f: 1320, dur: 0.22, vol: 0.18, t: 0.16, send: 0.3 });
        break;
      case 'click': this.tone({ type: 'square', f: 880, f2: 700, dur: 0.03, vol: 0.05 }); break;
      case 'select': this.tone({ f: 720 * p, dur: 0.04, vol: 0.1 }); break;
      case 'open': this.tone({ f: 420, f2: 640, dur: 0.08, vol: 0.12 }); this.noise({ f: 800, dur: 0.05, vol: 0.07 }); break;
      case 'close': this.tone({ f: 620, f2: 400, dur: 0.08, vol: 0.11 }); break;
      case 'eat':
        for (const t of [0, 0.11, 0.22]) N({ f: 1200 * rnd(0.85, 1.15), q: 2, dur: 0.06, vol: 0.3, t });
        T({ f: 210, f2: 150, dur: 0.1, vol: 0.12, t: 0.3 });
        break;
      case 'till': N({ f: 720 * p, f2: 300, q: 0.8, dur: 0.17, vol: 0.4 }); T({ type: 'triangle', f: 140, f2: 80, dur: 0.1, vol: 0.25 }); break;
      case 'shovel': N({ type: 'lowpass', f: 560 * p, f2: 210, dur: 0.12, vol: 0.4 }); T({ type: 'triangle', f: 118, f2: 68, dur: 0.1, vol: 0.3 }); N({ f: 1700 * p, q: 1.2, dur: 0.04, vol: 0.1, t: 0.03 }); break;
      // 사냥과 동물 울음소리
      case 'swing': N({ f: 900 * p, f2: 2600, q: 0.9, dur: 0.11, vol: 0.16 }); break;
      case 'hit_mob': N({ type: 'lowpass', f: 900 * p, f2: 240, dur: 0.1, vol: 0.5 }); T({ type: 'triangle', f: 190 * p, f2: 90, dur: 0.1, vol: 0.4 }); break;
      case 'mob_die': N({ f: 1400, f2: 500, q: 0.6, dur: 0.22, vol: 0.3 }); T({ f: 420 * p, f2: 160, dur: 0.2, vol: 0.16 }); break;
      case 'moo': T({ type: 'sawtooth', f: 132 * p, f2: 150 * p, dur: 0.22, vol: 0.2, attack: 0.07, lp: 700 }); T({ type: 'sawtooth', f: 150 * p, f2: 112 * p, dur: 0.62, vol: 0.22, attack: 0.03, lp: 760, t: 0.2 }); T({ type: 'triangle', f: 300 * p, f2: 224 * p, dur: 0.6, vol: 0.05, t: 0.2 }); break;
      case 'oink': [0, 0.14].forEach((t, i) => { T({ type: 'sawtooth', f: (290 - i * 50) * p, f2: 200 * p, dur: 0.1, vol: 0.14, lp: 1300, t }); N({ f: 650, q: 2.4, dur: 0.09, vol: 0.14, t }); }); break;
      case 'baa': for (let i = 0; i < 6; i++) T({ type: 'sawtooth', f: (440 + (i % 2 ? 22 : -22)) * p, f2: (425 - i * 6) * p, dur: 0.095, vol: 0.12 - i * 0.01, attack: 0.012, lp: 1900, t: i * 0.08 }); break;
      case 'cluck': [0, 0.1, 0.22].forEach((t, i) => T({ type: 'square', f: (i === 2 ? 980 : 740) * p, f2: (i === 2 ? 640 : 560) * p, dur: 0.055, vol: 0.07, lp: 2600, t })); break;
      case 'plant': T({ f: 500 * p, f2: 760, dur: 0.07, vol: 0.14 }); N({ type: 'lowpass', f: 600, dur: 0.05, vol: 0.16 }); break;
      case 'pluck': T({ f: 900 * p, f2: 1400, dur: 0.05, vol: 0.14 }); N({ f: 2500, q: 0.8, dur: 0.07, vol: 0.15 }); break;
      case 'deny': this.tone({ type: 'square', f: 185, dur: 0.07, vol: 0.07 }); this.tone({ type: 'square', f: 140, dur: 0.1, vol: 0.07, t: 0.08 }); break;
      case 'door': N({ f: 320, q: 0.8, dur: 0.1, vol: 0.3 }); T({ type: 'triangle', f: 165, f2: 110, dur: 0.12, vol: 0.3 }); T({ type: 'sawtooth', f: 520, f2: 700, dur: 0.1, vol: 0.02 }); break;
      case 'step_grass': this.noise({ f: 1400 * rnd(0.8, 1.2), q: 0.7, dur: 0.05, vol: rnd(0.05, 0.08) }); break;
      case 'step_sand': this.noise({ f: 900 * rnd(0.8, 1.2), q: 0.5, dur: 0.07, vol: rnd(0.05, 0.08) }); break;
      case 'step_dirt': this.noise({ type: 'lowpass', f: 700 * rnd(0.8, 1.2), dur: 0.05, vol: rnd(0.07, 0.1) }); break;
      case 'step_stone':
        N({ f: 2400 * rnd(0.85, 1.15), q: 1.5, dur: 0.03, vol: rnd(0.06, 0.09) }); T({ f: 165 * rnd(0.9, 1.1), dur: 0.03, vol: 0.05 }); break;
      case 'step_wood': this.tone({ type: 'triangle', f: 185 * rnd(0.9, 1.1), f2: 130, dur: 0.05, vol: 0.12 }); this.noise({ f: 800, dur: 0.03, vol: 0.05 }); break;
      case 'quest':
        [72, 76, 79, 84].forEach((m, i) => { this.tone({ type: 'triangle', f: hz(m), dur: i === 3 ? 0.6 : 0.16, vol: 0.2, t: i * 0.11, send: 0.4 }); this.tone({ f: hz(m + 12), dur: i === 3 ? 0.5 : 0.12, vol: 0.06, t: i * 0.11, send: 0.4 }); });
        break;
      case 'cave': this.noise({ type: 'lowpass', f: 1300, f2: 150, dur: 0.75, vol: 0.34, send: 0.4 }); this.tone({ f: 112, f2: 55, dur: 0.75, vol: 0.3, send: 0.3 }); break;
      case 'sleep': [79, 76, 72, 67].forEach((m, i) => this.tone({ f: hz(m), dur: 0.5, vol: 0.14, t: i * 0.28, send: 0.5, attack: 0.02 })); break;
      case 'smelt': N({ type: 'highpass', f: 4200, dur: 0.22, vol: 0.08 }); T({ f: 1320, dur: 0.3, vol: 0.1, send: 0.3 }); break;
    }
  }

  // ── 장면(낮/밤/동굴/타이틀) ──
  setScene(scene) {
    if (scene === this.scene) return;
    const mood = (s) => (s === 'title' ? 'day' : s);
    const same = this.ready && this.scene && mood(scene) === mood(this.scene);
    this.scene = scene;
    if (!this.ready || same) return;
    const c = this.ctx, now = c.currentTime;
    // 음악: 지금 곡은 페이드아웃, 조금 뒤 새 분위기로
    if (this.songGain) { const g = this.songGain; g.gain.setTargetAtTime(0, now, 0.5); setTimeout(() => g.disconnect(), 3000); }
    this.song = null; this.songGain = null;
    this.nextSongAt = now + (scene === 'title' ? 0.6 : rnd(3, 6));
    // 환경음
    for (const l of this.loops) { l.g.gain.setTargetAtTime(0, now, 0.4); const s = l.s; setTimeout(() => { try { s.stop(); } catch { /* 이미 멈춤 */ } }, 2500); }
    this.loops = [];
    const token = ++this.ambToken;
    const alive = () => token === this.ambToken && this.ctx.state === 'running';
    const again = (fn, a, b) => setTimeout(() => { if (token !== this.ambToken) return; if (alive()) fn(); again(fn, a, b); }, rnd(a, b) * 1000);
    const loop = (type, f, q, vol, lfo) => {
      const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noiseBuf; s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      g.gain.value = 0; g.gain.setTargetAtTime(vol, now, 1.2);
      s.connect(fl); fl.connect(g); g.connect(this.ambBus);
      if (lfo) { const o = c.createOscillator(), og = c.createGain(); o.frequency.value = lfo; og.gain.value = f * 0.35; o.connect(og); og.connect(fl.frequency); o.start(); }
      s.start(now, Math.random());
      this.loops.push({ s, g });
    };
    if (scene === 'day' || scene === 'title') {
      loop('bandpass', 420, 0.5, 0.05, 0.11);
      again(() => this.bird(), 1.5, 7);
    } else if (scene === 'night') {
      loop('bandpass', 300, 0.5, 0.035, 0.07);
      again(() => this.cricket(), 0.8, 3.5);
    } else if (scene === 'cave') {
      loop('lowpass', 110, 0.7, 0.3, 0.05);
      again(() => this.drip(), 2.5, 9);
    }
  }
  bird() {
    const pan = rnd(-0.8, 0.8), v = rnd(0.02, 0.05), kind = (Math.random() * 3) | 0, o = { dest: this.ambBus, send: 0.5, pan };
    if (kind === 0) { const f = rnd(2600, 3800); for (let i = 0; i < 2 + ((Math.random() * 3) | 0); i++) this.tone({ ...o, f, f2: f * rnd(1.15, 1.4), dur: 0.07, vol: v, t: i * 0.13 }); }
    else if (kind === 1) { const f = rnd(3200, 4400); for (let i = 0; i < 5 + ((Math.random() * 4) | 0); i++) this.tone({ ...o, f: f * (i % 2 ? 1 : 0.9), dur: 0.035, vol: v * 0.8, t: i * 0.055 }); }
    else { const f = rnd(2800, 3600); this.tone({ ...o, f, f2: f * 0.72, dur: 0.24, vol: v, attack: 0.02 }); this.tone({ ...o, f: f * 0.8, f2: f * 1.05, dur: 0.12, vol: v, t: 0.3 }); }
  }
  cricket() {
    const pan = rnd(-0.9, 0.9), f = rnd(4200, 5000), v = rnd(0.012, 0.028), reps = 2 + ((Math.random() * 5) | 0);
    for (let r = 0; r < reps; r++) for (let i = 0; i < 3; i++) this.tone({ dest: this.ambBus, f, dur: 0.03, vol: v, t: r * 0.42 + i * 0.05, pan, attack: 0.006 });
  }
  drip() {
    const f = rnd(1100, 1700), pan = rnd(-0.7, 0.7);
    this.tone({ dest: this.ambBus, f, f2: f * 0.62, dur: 0.09, vol: 0.09, send: 0.6, echo: 0.5, pan });
    if (Math.random() < 0.3) this.tone({ dest: this.ambBus, f: f * 1.2, f2: f * 0.7, dur: 0.07, vol: 0.06, t: rnd(0.15, 0.3), send: 0.6, echo: 0.5, pan });
  }

  // ── 배경음악 ──
  musicTick() {
    if (!this.ready || this.ctx.state !== 'running' || !this.scene) return;
    const c = this.ctx, now = c.currentTime;
    if (!this.song) {
      if (now < this.nextSongAt) return;
      const mood = this.scene === 'title' ? 'day' : this.scene;
      this.song = makeSong(mood);
      this.song.t0 = now + 0.15;
      this.songGain = c.createGain(); this.songGain.gain.value = 1; this.songGain.connect(this.musicBus);
    }
    const s = this.song;
    while (s.i < s.ev.length && s.t0 + s.ev[s.i].t * s.beat < now + 0.4) {
      const e = s.ev[s.i++], t = s.t0 + e.t * s.beat;
      if (t > now - 0.05) this.note(e, t, e.d * s.beat);
    }
    if (now > s.t0 + s.len * s.beat) {
      const r = MOODS[s.mood].rest;
      this.song = null; this.nextSongAt = now + rnd(r[0], r[1]);
      const g = this.songGain; this.songGain = null; setTimeout(() => g.disconnect(), 6000);
    }
  }
  note(e, t, dur) {
    const c = this.ctx, f = hz(e.m), dest = this.songGain;
    const g = c.createGain(); g.connect(dest);
    const send = (v) => { const s = c.createGain(); s.gain.value = v; g.connect(s); s.connect(this.revIn); };
    const osc = (type, freq, vol, det = 0) => {
      const o = c.createOscillator(), og = c.createGain();
      o.type = type; o.frequency.value = freq; o.detune.value = det; og.gain.value = vol;
      o.connect(og); return [o, og];
    };
    let stopAt = t + dur + 0.1; const list = [];
    if (e.k === 'pluck') {
      // 칼림바 같은 맑은 뜯는 소리
      const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 0.6;
      fl.frequency.setValueAtTime(Math.min(6000, f * 6), t); fl.frequency.exponentialRampToValueAtTime(Math.max(400, f * 1.5), t + 0.5);
      for (const [ty, mul, v, det] of [['triangle', 1, 0.5, rnd(-4, 4)], ['sine', 2, 0.18, 0], ['sine', 3.01, 0.05, 0]]) { const [o, og] = osc(ty, f * mul, v, det); og.connect(fl); list.push(o); }
      fl.connect(g);
      const len = Math.max(0.7, dur * 1.6);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32 * e.v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      stopAt = t + len + 0.05; send(0.4);
      if (e.echo) { const s = c.createGain(); s.gain.value = 0.5; g.connect(s); s.connect(this.echoIn); }
    } else if (e.k === 'flute') {
      const [o1, g1] = osc('sine', f, 0.6), [o2, g2] = osc('triangle', f, 0.22), [o3, g3] = osc('sine', f * 2, 0.06);
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.006, t + 0.35);
      lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
      g1.connect(g); g2.connect(g); g3.connect(g); list.push(o1, o2, o3, lfo);
      const hold = Math.max(0.12, dur * 0.92);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2 * e.v, t + 0.05);
      g.gain.setValueAtTime(0.2 * e.v, t + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + hold + 0.22);
      stopAt = t + hold + 0.3; send(0.55);
    } else if (e.k === 'bell') {
      // 오르골
      for (const [mul, v] of [[1, 0.5], [2, 0.14], [4.02, 0.07], [5.4, 0.025]]) { const [o, og] = osc('sine', f * mul, v); og.connect(g); list.push(o); }
      const len = Math.max(1.4, dur * 2.2);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.24 * e.v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      stopAt = t + len + 0.05; send(0.6);
    } else if (e.k === 'pad') {
      const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 780; fl.Q.value = 0.4;
      for (const det of [-7, 6]) { const [o, og] = osc('sawtooth', f, 0.22, det); og.connect(fl); list.push(o); }
      const [o, og] = osc('sine', f, 0.3); og.connect(fl); list.push(o);
      fl.connect(g);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.085 * e.v, t + Math.min(1, dur * 0.3));
      g.gain.setValueAtTime(0.085 * e.v, t + dur * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + dur + 1.2);
      stopAt = t + dur + 1.3; send(0.5);
    } else if (e.k === 'bass') {
      const [o1, g1] = osc('sine', f, 0.8), [o2, g2] = osc('triangle', f, 0.25);
      g1.connect(g); g2.connect(g); list.push(o1, o2);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3 * e.v, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      send(0.1);
    } else if (e.k === 'boom') {
      const [o1, g1] = osc('sine', f, 1); g1.connect(g); list.push(o1);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.3 * e.v, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      send(0.5);
    }
    for (const o of list) { o.start(t); o.stop(stopAt); }
    setTimeout(() => g.disconnect(), (stopAt - c.currentTime + 4) * 1000);
  }
}
