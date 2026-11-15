// 월드 렌더러: 지형 → (행 단위 y정렬) 오브젝트·플레이어 → 조명 → 커서
import { TILE, MAP_W, MAP_H, SURFACE, CAVE, WALL_LIFT, ROOF_LIFT, PLAYER_COLORS } from '../config.js';
import { GROUND } from '../data/ground.js';
import { OBJ, O, joins } from '../data/objects.js';
import { MOBS, MOB_KEYS } from '../data/mobs.js';
import { ITEMS } from '../data/items.js';
import { hash2, clamp } from '../rng.js';
import { hex } from './pix.js';

const SIDES = ['N', 'E', 'S', 'W'];

export class Renderer {
  constructor(canvas, atlas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.atlas = atlas; this.img = atlas.canvas;
    this.zoom = 3; this.userZoom = 0;
    this.cam = { x: 0, y: 0 };
    this.ox = 0; this.oy = 0;
    this.t = 0; this.frame = 0;
    this.world = null; this.layerNo = 0;      // 지금 그리고 있는 세계와 층 (이웃에 따라 모양이 바뀌는 그림용)
    this.light = document.createElement('canvas');
    this.lctx = this.light.getContext('2d');
    this.css = new Map();
    this.varr = new Uint8Array(MAP_W * MAP_H);
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) this.varr[y * MAP_W + x] = (hash2(x, y, 7) * 256) | 0;
    this.bind();
    this.makeLights();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  bind() {
    const A = this.atlas, get = (n) => A.get(n);
    this.gs = []; this.edges = [];
    for (const g of GROUND) {
      if (!g || !g.spr) continue;
      const vars = [];
      for (let v = 0; v < g.n; v++) {
        if (g.frames) { const fr = []; for (let f = 0; f < g.frames; f++) fr.push(get(`${g.spr}_${v}_${f}`)); vars.push(fr); }
        else vars.push(get(`${g.spr}_${v}`));
      }
      this.gs[g.id] = vars;
      if (A.has(`${g.spr}_eN0`)) {
        const e = {};
        for (const s of SIDES) e[s] = [get(`${g.spr}_e${s}0`), get(`${g.spr}_e${s}1`)];
        for (const c of ['NW', 'NE', 'SW', 'SE']) e[c] = get(`${g.spr}_c${c}`);
        this.edges[g.id] = e;
      }
    }
    this.foam = {};
    for (const s of SIDES) this.foam[s] = [get(`foam_${s}0`), get(`foam_${s}1`)];
    this.os = [];
    for (const d of OBJ) {
      if (!d || !d.spr) continue;
      const b = { late: (d.solid || d.tall) && !d.wall };
      if (d.connect) { b.conn = []; for (let m = 0; m < 16; m++) b.conn.push(get(`${d.spr}_${m}`)); }
      else if (d.gate) b.gate = ['h', 'v'].map((n) => [get(`${d.spr}_${n}_0`), get(`${d.spr}_${n}_1`)]);
      else if (d.frames && d.byMeta) {
        b.mf = [];
        for (let m = 0; m < d.byMeta; m++) { const fr = []; for (let f = 0; f < d.frames; f++) fr.push(get(`${d.spr}_${m}_${f}`)); b.mf.push(fr); }
      }
      else if (d.frames) { b.anim = []; for (let f = 0; f < d.frames; f++) b.anim.push(get(`${d.spr}_0_${f}`)); }
      else if (d.byMeta) { b.metas = []; for (let m = 0; m < d.byMeta; m++) b.metas.push(get(`${d.spr}_${m}`)); }
      else { b.vars = []; for (let v = 0; v < d.n; v++) b.vars.push(get(`${d.spr}_${v}`)); }
      this.os[d.id] = b;
    }
    this.furnB = get('o_furnace_1b');
    this.roofSpr = [get('r_roof_0'), get('r_roof_1')];
    this.roofRim = { N: get('r_rim_N'), W: get('r_rim_W'), E: get('r_rim_E'), S: get('r_rim_S') };
    this.dark = [get('w_dark_0'), get('w_dark_1')];
    this.rim = { N: get('rim_N'), W: get('rim_W'), E: get('rim_E') };
    this.shadowS = get('shadow_S');
    this.cracks = [0, 1, 2, 3].map((s) => get('crack_' + s));
    this.pl = PLAYER_COLORS.map((_, c) => {
      const set = {};
      for (const d of ['d', 'u', 'l', 'r']) set[d] = [0, 1, 2, 3].map((f) => get(`p${c}_${d}_${f}`));
      return set;
    });
    this.shadowP = get('shadow_p'); this.shadowD = get('shadow_s');
    this.ms = {};                // 동물: 종류 → { r, l, rh, lh } 각각 [서기, 걷기1, 걷기2]
    for (const k of MOB_KEYS) { const set = (this.ms[k] = {}); for (const d of ['r', 'l', 'rh', 'lh']) set[d] = [0, 1, 2].map((f) => get(`mob_${k}_${d}_${f}`)); }
    this.icons = {};
    for (const id in ITEMS) this.icons[id] = get(ITEMS[id].icon);
  }

  makeLights() {
    const mk = (r, g, b) => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, `rgba(${r},${g},${b},1)`); gr.addColorStop(0.45, `rgba(${r},${g},${b},0.94)`);
      gr.addColorStop(0.75, `rgba(${r},${g},${b},0.5)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
      x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
      return c;
    };
    this.lightMask = mk(255, 255, 255);
    this.glow = { warm: mk(255, 150, 60), cool: mk(90, 210, 255), day: mk(255, 240, 190) };
  }

  resize() {
    const W = window.innerWidth, H = window.innerHeight;
    this.zoom = this.userZoom || clamp(Math.round(H / 340), 2, 6);
    this.vw = Math.ceil(W / this.zoom); this.vh = Math.ceil(H / this.zoom);
    for (const c of [this.canvas, this.light]) { c.width = this.vw; c.height = this.vh; }
    this.canvas.style.width = this.vw * this.zoom + 'px'; this.canvas.style.height = this.vh * this.zoom + 'px';
    this.ctx.imageSmoothingEnabled = false;
  }
  setZoom(d) {
    const z = clamp(this.zoom + d, 2, 6);
    if (z !== this.zoom) { this.userZoom = z; this.resize(); }
  }
  snap() { /* 카메라는 매 프레임 플레이어에 고정되므로 따로 할 일 없음 */ }
  screenToWorld(mx, my) { return { x: this.ox + mx / this.zoom, y: this.oy + my / this.zoom }; }

  objSprite(def, meta, x, y) {
    const b = this.os[def.id];
    if (!b) return null;
    if (b.conn || b.gate) {
      // 울타리 · 울타리 문: 상하좌우 이웃을 보고 이어진 모양을 고른다
      const w = this.world, L = this.layerNo, j = (dx, dy) => (w && joins(w.obj(L, x + dx, y + dy)) ? 1 : 0);
      const n = j(0, -1), e = j(1, 0), s = j(0, 1), we = j(-1, 0);
      if (b.conn) return b.conn[n | (e << 1) | (s << 2) | (we << 3)];
      return b.gate[(n || s) && !(e || we) ? 1 : 0][meta ? 1 : 0];
    }
    if (b.mf) return b.mf[Math.min(meta, b.mf.length - 1)][((this.t * 5 + x * 3 + y) | 0) % b.mf[0].length];
    if (b.anim) return b.anim[((this.t * 8 + x * 3 + y) | 0) % b.anim.length];
    if (b.metas) {
      if (def.id === O.FURNACE && meta === 1 && ((this.t * 7) | 0) % 2) return this.furnB;
      return b.metas[Math.min(meta, b.metas.length - 1)];
    }
    return b.vars[this.varr[y * MAP_W + x] % b.vars.length];
  }
  col(c) { let s = this.css.get(c); if (!s) { s = hex(c); this.css.set(c, s); } return s; }

  render(game, dt) {
    this.t += dt; this.frame++;
    this.world = game.world; this.layerNo = game.layer;
    const ctx = this.ctx, img = this.img, w = game.world, vw = this.vw, vh = this.vh;
    if (!w) { ctx.fillStyle = '#0b0910'; ctx.fillRect(0, 0, vw, vh); return; }
    const L = game.layer, Lr = w.layers[L], ground = Lr.ground, objs = Lr.obj, metas = Lr.meta;
    const title = game.state === 'title', p = game.player;
    const tx = title ? this.cam.x : Math.round(p.x), ty = title ? this.cam.y : Math.round(p.y) - 8;
    const ox = this.ox = clamp(Math.round(tx - vw / 2), 0, Math.max(0, MAP_W * TILE - vw));
    const oy = this.oy = clamp(Math.round(ty - vh / 2), 0, Math.max(0, MAP_H * TILE - vh));
    const x0 = Math.max(0, Math.floor(ox / TILE)), x1 = Math.min(MAP_W - 1, Math.floor((ox + vw) / TILE));
    const y0 = Math.max(0, Math.floor(oy / TILE)), y1 = Math.min(MAP_H - 1, Math.floor((oy + vh) / TILE));
    const D = (s, dx, dy) => ctx.drawImage(img, s.x, s.y, s.w, s.h, dx, dy, s.w, s.h);
    ctx.fillStyle = '#0b0910'; ctx.fillRect(0, 0, vw, vh);

    // ── 1) 지형 ──
    const wf = ((this.t * 2.2) | 0) % 4, ff = ((this.t * 1.4) | 0) % 2;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * MAP_W + x;
      if (OBJ[objs[i]].wall) continue;                  // 벽 아래 바닥은 보이지 않는다
      const g = ground[i], gd = GROUND[g], vars = this.gs[g];
      if (!vars) continue;
      const px = x * TILE - ox, py = y * TILE - oy, v = this.varr[i];
      const s = vars[v % vars.length];
      D(gd.frames ? s[(wf + (v >> 4)) % 4] : s, px, py);
      if (gd.edge) {
        const pr = gd.prio, ev = (x * 7 + y * 13) & 1;
        const n = y > 0 ? ground[i - MAP_W] : g, so = y < MAP_H - 1 ? ground[i + MAP_W] : g;
        const we = x > 0 ? ground[i - 1] : g, ea = x < MAP_W - 1 ? ground[i + 1] : g;
        const pn = GROUND[n].prio, ps = GROUND[so].prio, pw = GROUND[we].prio, pe = GROUND[ea].prio;
        if (gd.water) {
          if (!GROUND[n].water) D(this.foam.N[ff], px, py);
          if (!GROUND[so].water) D(this.foam.S[ff], px, py);
          if (!GROUND[we].water) D(this.foam.W[ff], px, py);
          if (!GROUND[ea].water) D(this.foam.E[ff], px, py);
        }
        let e;
        if (pn > pr && (e = this.edges[n])) D(e.N[ev], px, py);
        if (ps > pr && (e = this.edges[so])) D(e.S[ev], px, py);
        if (pw > pr && (e = this.edges[we])) D(e.W[ev], px, py);
        if (pe > pr && (e = this.edges[ea])) D(e.E[ev], px, py);
        if (y > 0 && x > 0) { const c = ground[i - MAP_W - 1], pc = GROUND[c].prio; if (pc > pr && pn < pc && pw < pc && (e = this.edges[c])) D(e.NW, px, py); }
        if (y > 0 && x < MAP_W - 1) { const c = ground[i - MAP_W + 1], pc = GROUND[c].prio; if (pc > pr && pn < pc && pe < pc && (e = this.edges[c])) D(e.NE, px, py); }
        if (y < MAP_H - 1 && x > 0) { const c = ground[i + MAP_W - 1], pc = GROUND[c].prio; if (pc > pr && ps < pc && pw < pc && (e = this.edges[c])) D(e.SW, px, py); }
        if (y < MAP_H - 1 && x < MAP_W - 1) { const c = ground[i + MAP_W + 1], pc = GROUND[c].prio; if (pc > pr && ps < pc && pe < pc && (e = this.edges[c])) D(e.SE, px, py); }
      }
      if (y > 0 && OBJ[objs[i - MAP_W]].wall) D(this.shadowS, px, py);   // 북쪽 벽이 드리우는 그림자
    }

    // ── 2) 오브젝트와 플레이어 (행 단위 y정렬) ──
    const ents = [];
    if (!title) ents.push({ y: p.y, p: true });
    for (const d of game.drops) {
      if (d.layer !== L || d.x < ox - 16 || d.x > ox + vw + 16 || d.y < oy - 16 || d.y > oy + vh + 32) continue;
      ents.push({ y: d.y, d });
    }
    if (!title) for (const rp of game.net.players.values()) {
      if (rp.layer !== L || rp.rx < ox - 24 || rp.rx > ox + vw + 24 || rp.ry < oy - 8 || rp.ry > oy + vh + 32) continue;
      ents.push({ y: rp.ry, rp });
    }
    if (L === SURFACE) for (const m of game.mobs.list) {
      if (m.rx < ox - 24 || m.rx > ox + vw + 24 || m.ry < oy - 8 || m.ry > oy + vh + 32) continue;
      ents.push({ y: m.ry, m });
    }
    ents.sort((a, b) => a.y - b.y);
    let ei = 0;
    const mn = game.mining, sh = game.shake;
    const roofs = Lr.roof, hasRoof = w.roofs[L].size > 0;
    const isWall = (x, y) => x < 0 || y < 0 || x >= MAP_W || y >= MAP_H || OBJ[objs[y * MAP_W + x]].wall;
    const yEnd = Math.min(MAP_H - 1, y1 + 3), xs = Math.max(0, x0 - 1), xe = Math.min(MAP_W - 1, x1 + 1);
    for (let y = y0; y <= yEnd; y++) {
      const py = y * TILE - oy;
      for (let pass = 0; pass < 2; pass++) {
        for (let x = xs; x <= xe; x++) {
          const i = y * MAP_W + x, o = objs[i];
          if (!o) continue;
          const def = OBJ[o], b = this.os[o];
          if (!b || (b.late ? 1 : 0) !== pass) continue;
          let px = x * TILE - ox;
          if (sh && sh.x === x && sh.y === y) px += Math.round(Math.sin(sh.t * 90) * 1.4);
          if (def.wall) {
            const vis = L !== CAVE || w.exposed(L, x, y);
            if (!vis) { D(this.dark[this.varr[i] & 1], px, py - WALL_LIFT); continue; }
            D(b.vars[this.varr[i] % b.vars.length], px, py - WALL_LIFT);
            if (!isWall(x, y - 1)) D(this.rim.N, px, py - WALL_LIFT);
            if (!isWall(x - 1, y)) D(this.rim.W, px, py - WALL_LIFT);
            if (!isWall(x + 1, y)) D(this.rim.E, px, py - WALL_LIFT);
            if (mn && !mn.roof && mn.x === x && mn.y === y) D(this.cracks[Math.min(3, ((mn.t / mn.total) * 4) | 0)], px, py - WALL_LIFT);
            continue;
          }
          const s = this.objSprite(def, metas[i], x, y);
          if (!s) continue;
          let fade = false;
          if (def.tall && !title && p.y < (y + 1) * TILE - 2) {
            const cx0 = x * TILE + s.ox + 3, cx1 = cx0 + s.w - 6, cy0 = y * TILE + s.oy, cy1 = y * TILE + 2;
            fade = p.x + 6 > cx0 && p.x - 6 < cx1 && p.y > cy0 && p.y - 18 < cy1;
          }
          if (fade) ctx.globalAlpha = 0.45;
          D(s, px + s.ox, py + s.oy);
          if (fade) ctx.globalAlpha = 1;
          if (mn && !mn.roof && mn.x === x && mn.y === y) D(this.cracks[Math.min(3, ((mn.t / mn.total) * 4) | 0)], px, py);
        }
        if (pass === 0) {
          const limit = (y + 1) * TILE - 2;
          while (ei < ents.length && ents[ei].y < limit) this.drawEnt(ents[ei++], game, D, ox, oy);
        }
      }
      if (hasRoof) {
        for (let x = xs; x <= xe; x++) {
          const i = y * MAP_W + x;
          if (!roofs[i]) continue;
          const reg = w.regionAt(L, i);
          if (!reg) continue;
          if (reg.af !== this.frame) {      // 덩어리마다 한 프레임에 한 번, 투명도를 부드럽게 바꾼다
            reg.af = this.frame;
            const target = title ? 1 : game.roofEdit ? 0.62 : game.roofOpen(reg) ? 0.1 : 1;
            reg.alpha = reg.alpha < 0 ? target : reg.alpha + (target - reg.alpha) * Math.min(1, dt * 9);
            if (Math.abs(target - reg.alpha) < 0.01) reg.alpha = target;
          }
          const px = x * TILE - ox;
          ctx.globalAlpha = reg.alpha;
          D(this.roofSpr[this.varr[i] & 1], px, py - ROOF_LIFT);
          if (y === 0 || !roofs[i - MAP_W]) D(this.roofRim.N, px, py - ROOF_LIFT);
          if (x === 0 || !roofs[i - 1]) D(this.roofRim.W, px, py - ROOF_LIFT);
          if (x === MAP_W - 1 || !roofs[i + 1]) D(this.roofRim.E, px + 15, py - ROOF_LIFT);
          if (y === MAP_H - 1 || !roofs[i + MAP_W]) D(this.roofRim.S, px, py + TILE - ROOF_LIFT);
          if (mn && mn.roof && mn.x === x && mn.y === y) D(this.cracks[Math.min(3, ((mn.t / mn.total) * 4) | 0)], px, py - ROOF_LIFT);
        }
        ctx.globalAlpha = 1;
      }
    }
    while (ei < ents.length) this.drawEnt(ents[ei++], game, D, ox, oy);

    // ── 3) 파티클 ──
    for (const q of game.particles) {
      ctx.globalAlpha = Math.min(1, (q.life / q.max) * 2.5);
      ctx.fillStyle = this.col(q.c);
      ctx.fillRect(Math.round(q.x - ox), Math.round(q.y - oy), q.s, q.s);
    }
    ctx.globalAlpha = 1;

    // ── 4) 조명 ──
    this.drawLight(game, title, ox, oy, x0, x1, y0, y1);

    // ── 5) 커서 ──
    if (!title && !game.ui.blocking && !game.fade) this.drawCursor(game, D, ox, oy);
  }

  drawEnt(e, game, D, ox, oy) {
    const ctx = this.ctx;
    if (e.d) {
      const d = e.d, s = this.icons[d.id];
      if (!s) return;
      const x = Math.round(d.x - ox), y = Math.round(d.y - oy);
      const bob = d.z > 0 ? 0 : Math.round(Math.sin(this.t * 3 + d.x) * 1.2);
      D(this.shadowD, x - 5, y - 1);
      ctx.drawImage(this.img, s.x, s.y, s.w, s.h, x - 6, y - 11 - Math.round(d.z) + bob, 12, 12);
      return;
    }
    if (e.m) {        // 동물
      const m = e.m, x = Math.round(m.rx) - ox, y = Math.round(m.ry) - oy, d = MOBS[m.k];
      const s = this.ms[m.k][m.dir + (m.hurt > 0 ? 'h' : '')][m.moving ? 1 + ((m.anim | 0) & 1) : 0];
      const sh = d.w > 14 ? this.shadowP : this.shadowD, sw = d.w - 4;
      ctx.drawImage(this.img, sh.x, sh.y, sh.w, sh.h, x - (sw >> 1), y - 3, sw, sh.h);
      D(s, x + s.ox, y + s.oy);
      return;
    }
    if (e.rp) {       // 다른 플레이어
      const r = e.rp, px = Math.round(r.rx) - ox, py = Math.round(r.ry) - oy;
      const set = this.pl[r.color % this.pl.length], s = (set[r.dir] || set.d)[r.moving ? (r.anim | 0) % 4 : 0];
      D(this.shadowP, px - 7, py - 2);
      const sw = r.swingT > 0 && r.held && this.icons[r.held] ? { dir: set[r.dir] ? r.dir : 'd', swing: r.swingT } : null;
      if (sw && sw.dir === 'u') this.drawSwing(sw, { id: r.held }, px, py);
      D(s, px + s.ox, py + s.oy);
      if (sw && sw.dir !== 'u') this.drawSwing(sw, { id: r.held }, px, py);
      return;
    }
    const p = game.player, px = Math.round(p.x) - ox, py = Math.round(p.y) - oy;
    const s = this.pl[game.net.color % this.pl.length][p.dir][p.moving ? (p.anim | 0) % 4 : 0];
    D(this.shadowP, px - 7, py - 2);
    const held = game.heldSlot(), swinging = p.swing > 0 && held;
    if (swinging && p.dir === 'u') this.drawSwing(p, held, px, py);
    D(s, px + s.ox, py + s.oy);
    if (swinging && p.dir !== 'u') this.drawSwing(p, held, px, py);
  }
  drawSwing(p, held, px, py) {
    const ctx = this.ctx, s = this.icons[held.id];
    if (!s) return;
    const k = clamp(1 - p.swing / 0.22, 0, 1);
    const [a0, a1, hx, hy] = { r: [-1.5, 0.6, 3, -7], l: [-1.5, 0.6, -3, -7], d: [0.2, 2.2, 2, -5], u: [-2.3, -0.5, 0, -10] }[p.dir];
    ctx.save();
    ctx.translate(px + hx, py + hy);
    if (p.dir === 'l') ctx.scale(-1, 1);
    ctx.rotate(a0 + (a1 - a0) * k);
    ctx.drawImage(this.img, s.x, s.y, s.w, s.h, -2, -14, 16, 16);
    ctx.restore();
  }

  drawLight(game, title, ox, oy, x0, x1, y0, y1) {
    const ctx = this.ctx, vw = this.vw, vh = this.vh, L = game.layer;
    const d = title || this.noDark ? 0 : game.darkness;
    // 노을 · 새벽 빛
    if (!title && L !== CAVE) {
      const h = game.hour;
      const k = h >= 17 && h < 20 ? 1 - Math.abs(h - 18.5) / 1.5 : h >= 4.5 && h < 7.5 ? 1 - Math.abs(h - 6) / 1.5 : 0;
      if (k > 0) { ctx.fillStyle = `rgba(255,120,50,${(0.16 * k).toFixed(3)})`; ctx.fillRect(0, 0, vw, vh); }
    }
    if (d <= 0.01) return;
    const lc = this.lctx, w = game.world, Lr = w.layers[L];
    lc.globalCompositeOperation = 'source-over'; lc.globalAlpha = 1;
    lc.clearRect(0, 0, vw, vh);
    lc.fillStyle = L === CAVE ? 'rgba(5,4,12,0.975)' : `rgba(10,14,42,${(0.8 * d).toFixed(3)})`;
    lc.fillRect(0, 0, vw, vh);
    lc.globalCompositeOperation = 'destination-out';
    const lights = [];
    const p = game.player, held = game.heldDef();
    const pr = held && held.light ? held.light : L === CAVE ? 6.2 : 4;
    lights.push([p.x, p.y - 8, pr, held && held.light ? 'warm' : 'day', 1]);
    for (const rp of game.net.players.values()) {
      if (rp.layer !== L) continue;
      const hl = rp.held && ITEMS[rp.held] && ITEMS[rp.held].light;
      lights.push([rp.rx, rp.ry - 8, hl || (L === CAVE ? 6.2 : 4), hl ? 'warm' : 'day', 1]);
    }
    const m = 7;
    for (let y = Math.max(0, y0 - m); y <= Math.min(MAP_H - 1, y1 + m); y++) for (let x = Math.max(0, x0 - m); x <= Math.min(MAP_W - 1, x1 + m); x++) {
      const i = y * MAP_W + x, o = Lr.obj[i];
      if (!o) continue;
      const def = OBJ[o], li = def.light || (def.lightIf && Lr.meta[i] ? def.lightIf : null);
      if (!li) continue;
      const fl = li.c === 'warm' ? 1 + Math.sin(this.t * 9 + x * 3.1 + y * 1.7) * 0.035 : 1;
      lights.push([x * TILE + 8, y * TILE + 2, li.r * fl, li.c, 1]);
    }
    for (const [lx, ly, r, , a] of lights) {
      const R = r * TILE;
      lc.globalAlpha = a;
      lc.drawImage(this.lightMask, lx - ox - R, ly - oy - R, R * 2, R * 2);
    }
    lc.globalAlpha = 1;
    ctx.drawImage(this.light, 0, 0);
    // 따뜻한/차가운 빛 번짐
    ctx.globalCompositeOperation = 'lighter';
    for (const [lx, ly, r, c] of lights) {
      const R = r * TILE * 0.8;
      ctx.globalAlpha = (c === 'day' ? 0.05 : c === 'cool' ? 0.16 : 0.2) * d;
      ctx.drawImage(this.glow[c], lx - ox - R, ly - oy - R, R * 2, R * 2);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  drawCursor(game, D, ox, oy) {
    const ctx = this.ctx, c = game.cursor, w = game.world, L = game.layer;
    if (game.mobT) {
      const m = game.mobT.m, d = MOBS[m.k], near = game.mobT.inReach;
      const pulse = near ? ((this.t * 3) | 0) % 2 : 0;
      const a = Math.round(m.rx - d.w / 2) - ox - 1 - pulse, b = Math.round(m.ry) - d.h - oy - pulse, ww = d.w + 2 + pulse * 2, hh = d.h + 2 + pulse * 2;
      ctx.fillStyle = near ? 'rgba(255,255,255,0.9)' : 'rgba(255,90,90,0.55)';
      const br = (bx, by, sx, sy) => { ctx.fillRect(bx, by, 4 * sx, 1 * sy); ctx.fillRect(bx, by, 1 * sx, 4 * sy); };
      br(a, b, 1, 1); br(a + ww, b, -1, 1); br(a, b + hh, 1, -1); br(a + ww, b + hh, -1, -1);
      return;
    }
    if (!c || !w.inb(c.x, c.y)) return;
    const o = w.obj(L, c.x, c.y), def = OBJ[o], held = game.heldDef();
    let x = c.x * TILE - ox, y = c.y * TILE - oy, h = TILE;
    if (c.roof) {
      y -= ROOF_LIFT;
      if (c.inReach && game.roofEdit && !w.roof(L, c.x, c.y)) { ctx.globalAlpha = 0.5; D(this.roofSpr[0], x, y); ctx.globalAlpha = 1; }
    }
    else if (def.wall) { y -= WALL_LIFT; h += WALL_LIFT; }
    // 설치 미리보기
    if (!c.roof && c.inReach && o === O.NONE && held && held.place && held.place.obj) {
      const pd = OBJ[held.place.obj], s = this.objSprite(pd, held.place.meta || 0, c.x, c.y) || null;
      if (s) { ctx.globalAlpha = 0.5; D(s, x + s.ox, y + s.oy - (pd.wall ? 0 : 0)); ctx.globalAlpha = 1; }
    }
    ctx.fillStyle = c.inReach ? 'rgba(255,255,255,0.9)' : 'rgba(255,90,90,0.55)';
    const pulse = c.inReach ? ((this.t * 3) | 0) % 2 : 0, a = x - pulse, b = y - pulse, ww = TILE + pulse * 2, hh = h + pulse * 2;
    const br = (bx, by, sx, sy) => { ctx.fillRect(bx, by, 4 * sx, 1 * sy); ctx.fillRect(bx, by, 1 * sx, 4 * sy); };
    br(a, b, 1, 1); br(a + ww, b, -1, 1); br(a, b + hh, 1, -1); br(a + ww, b + hh, -1, -1);
    // 채굴 진행 막대
    const mn = game.mining;
    if (mn && mn.total > 0.35) {
      const k = clamp(mn.t / mn.total, 0, 1);
      ctx.fillStyle = 'rgba(20,16,28,0.85)'; ctx.fillRect(x + 1, y + h + 2, 14, 3);
      ctx.fillStyle = '#f4c430'; ctx.fillRect(x + 2, y + h + 3, Math.round(12 * k), 1);
    }
  }
}
