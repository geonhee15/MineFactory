// 멀티플레이
// 서버 없이 브라우저끼리 직접 연결한다(WebRTC). 한 명이 '방장'이 되어 자기 세계를 열고,
// 다른 사람은 6글자 방 코드로 들어온다. 세계의 주인은 방장이고(방장 기기에 저장),
// 손님의 가방·진행도는 손님 브라우저에 따로 저장된다.
//
//  · 타일 변경   : 누가 바꾸든 방장을 거쳐 모두에게 전달 (ts)
//  · 부수기/따기 : 손님은 방장에게 요청 → 방장이 처리하고 드롭을 만든다 (brk, hv) — 아이템 복사 방지
//  · 드롭 아이템 : 방장이 만들고(d+), 줍는 것도 방장이 한 명에게만 허락한다(dq → d-)
//  · 상자·화로  : 한 번에 한 사람만 열 수 있다. 연 사람이 내용을 책임지고 방장에게 돌려준다 (eo/eg/eu/ec)
//                  큰 상자는 두 칸을 한꺼번에 맡는다
//  · 표지판 글   : 쓰면 방장을 거쳐 모두에게 전달 (sg). 블록에 붙인 나무 판을 떼는 것은 방장이 처리한다 (sx)
//  · 성장·시간   : 방장만 계산해서 결과를 보낸다
//  · 동물        : 방장만 움직인다. 손님에게는 가까운 동물들의 위치를 보내고(ms), 손님이 때리면 방장이 처리한다(mh → md)
import { MAP_W, MAP_H, TILE } from './config.js';
import { O, OBJ, canPlaque, cleanSign, entType } from './data/objects.js';
import { ITEMS, attackDamage } from './data/items.js';
import { pack, unpack, gzip, gunzip, b64enc, b64dec, restoreWorld, loadProfile } from './save.js';

const N = MAP_W * MAP_H;
const PROTO = 6;                       // 통신 규칙 버전 (다르면 접속 거절). 메시지 형식이나 타일·오브젝트 번호가 늘면 올린다
const PREFIX = 'mf1-';
const PEERJS = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js';
export const MAX_PLAYERS = 8;
// PeerJS의 JSON 채널은 메시지 하나가 16,300바이트를 넘으면 버린다(message-too-big).
// 그래서 세계 데이터와 타일 묶음은 그보다 훨씬 작게 잘라 보낸다.
const CHUNK = 12000;
const TILE_BATCH = 400;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // 헷갈리는 0·O·1·I 제외
const rand = (a, b) => a + Math.random() * (b - a);
const entPub = (e) => (e.type !== 'chest'      // 화로 · 압축기
  ? { type: e.type, slots: e.slots, burn: e.burn, burnMax: e.burnMax, prog: e.prog }
  : { type: e.type, slots: e.slots });
const dropPub = (d) => ({ uid: d.uid, id: d.id, n: d.n, x: Math.round(d.x), y: Math.round(d.y), layer: d.layer, vx: d.vx | 0, vy: d.vy | 0, t: d.t });

// ── 전송 수단 ────────────────────────────────────────────────
// 인터넷: PeerJS(WebRTC 데이터 채널). 방장의 피어 ID = PREFIX + 방 코드
class PeerTransport {
  constructor() { this.conns = new Map(); this.peer = null; this.onopen = this.onmsg = this.onclose = () => {}; }
  static load() {
    if (window.Peer) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = PEERJS; s.onload = () => (window.Peer ? res() : rej(new Error('lib')));
      s.onerror = () => rej(Object.assign(new Error('lib'), { type: 'lib' }));
      document.head.append(s);
    });
  }
  host(code) {
    return PeerTransport.load().then(() => new Promise((res, rej) => {
      const p = (this.peer = new window.Peer(PREFIX + code));
      let opened = false;
      p.on('open', () => { opened = true; res(); });
      p.on('connection', (c) => this.wire(c));
      p.on('disconnected', () => { if (!p.destroyed) p.reconnect(); });   // 중계 서버와 끊겨도 이미 맺은 연결은 유지된다
      p.on('error', (e) => { if (!opened) rej(e); else console.warn('PeerJS:', e.type || e); });
    }));
  }
  join(code) {
    return PeerTransport.load().then(() => new Promise((res, rej) => {
      const p = (this.peer = new window.Peer());
      let done = false;
      const fail = (e) => { if (!done) { done = true; rej(e); } };
      p.on('open', () => {
        setTimeout(() => fail(Object.assign(new Error('timeout'), { type: 'timeout' })), 20000);
        // 직렬화는 'json'으로 고정한다. (PeerJS 문서에는 'none'도 있지만 1.5.5 구현에는 없어 예외가 난다)
        try { this.wire(p.connect(PREFIX + code, { reliable: true, serialization: 'json' }), () => { done = true; res(); }); }
        catch (e) { fail(e); }
      });
      p.on('error', fail);
    }));
  }
  wire(c, ready) {
    c.on('open', () => { this.conns.set(c.peer, c); this.onopen(c.peer); if (ready) ready(); });
    c.on('data', (d) => { try { this.onmsg(c.peer, typeof d === 'string' ? JSON.parse(d) : d); } catch (e) { console.warn('메시지 처리 오류', e); } });
    c.on('close', () => { if (this.conns.delete(c.peer)) this.onclose(c.peer); });
    c.on('error', (e) => console.warn('연결 오류', e && e.type));
  }
  send(id, m) { const c = this.conns.get(id); if (c && c.open) c.send(m); }      // 'json' 직렬화: 객체를 그대로 넘긴다
  close() { try { if (this.peer) this.peer.destroy(); } catch { /* 이미 닫힘 */ } this.conns.clear(); }
}
// 같은 브라우저의 탭끼리 (개발·테스트용, 주소에 ?net=local)
class LocalTransport {
  constructor() { this.peers = new Set(); this.onopen = this.onmsg = this.onclose = () => {}; this.id = ''; this.ch = null; }
  listen(code) {
    this.ch = new BroadcastChannel('mf-local-' + code);
    this.ch.onmessage = ({ data }) => {
      if (data.to !== this.id) return;
      if (data.hello) { this.peers.add(data.from); this.ch.postMessage({ to: data.from, from: this.id, ack: true }); this.onopen(data.from); }
      else if (data.ack) { this.peers.add(data.from); this.onopen(data.from); if (this.ready) this.ready(); }
      else if (data.bye) { if (this.peers.delete(data.from)) this.onclose(data.from); }
      else { try { this.onmsg(data.from, JSON.parse(data.m)); } catch (e) { console.warn('메시지 처리 오류', e); } }
    };
  }
  host(code) { this.id = 'host'; this.listen(code); return Promise.resolve(); }
  join(code) {
    this.id = 'g' + Math.random().toString(36).slice(2, 8);
    this.listen(code);
    return new Promise((res, rej) => {
      this.ready = res;
      this.ch.postMessage({ to: 'host', from: this.id, hello: true });
      setTimeout(() => rej(Object.assign(new Error('peer-unavailable'), { type: 'peer-unavailable' })), 3000);
    });
  }
  send(id, m) { if (this.peers.has(id)) this.ch.postMessage({ to: id, from: this.id, m: JSON.stringify(m) }); }
  close() { if (!this.ch) return; for (const id of this.peers) this.ch.postMessage({ to: id, from: this.id, bye: true }); this.peers.clear(); this.ch.close(); this.ch = null; }
}

// ─────────────────────────────────────────────────────────────
export class Net {
  constructor(game) {
    this.game = game;
    this.role = 'off';            // 'off'(혼자) | 'host'(방장) | 'guest'(손님)
    this.code = ''; this.tp = null; this.hostId = null;
    this.id = 'host'; this.color = 0;
    let nm = '';
    try { nm = localStorage.getItem('mf_name') || ''; } catch { /* 무시 */ }
    this.name = nm || '광부' + (100 + ((Math.random() * 900) | 0));
    this.players = new Map();     // 나를 뺀 다른 플레이어들
    this.dirty = new Set();       // 내가 바꾼 타일 (곧 보낼 것)
    this.applying = false;        // 남이 바꾼 것을 적용하는 중 (되돌려 보내지 않는다)
    this.owned = null;            // 손님: 열어 둔 상자/화로 { l, i, ent, sent }
    this.pendingEnt = null;
    this.joining = null; this.ready = false; this.queue = [];
    this.sendAcc = 0; this.timeAcc = 0; this.entAcc = 0; this.mobAcc = 0; this.swingN = 0; this.lastSwing = 0; this.lastP = ''; this.lastPAt = 0;
    this.local = new URLSearchParams(location.search).get('net') === 'local';
    this.bgAt = performance.now();
    setInterval(() => this.flush(), 60);
    setInterval(() => this.background(), 1000);
  }
  get on() { return this.role !== 'off'; }
  get isHost() { return this.role !== 'guest'; }   // 혼자 할 때도 세계의 주인은 나
  get isGuest() { return this.role === 'guest'; }
  get count() { return this.players.size + 1; }
  setName(n) {
    n = String(n || '').trim().slice(0, 12);
    if (!n) return;
    this.name = n;
    try { localStorage.setItem('mf_name', n); } catch { /* 무시 */ }
  }
  link() { return `${location.origin}${location.pathname}?join=${this.code}`; }
  pubMe() { const p = this.game.player; return { id: this.id, name: this.name, color: this.color, x: p.x, y: p.y, d: p.dir, l: this.game.layer }; }

  // ── 방 열기 / 닫기 (방장) ──
  async openRoom() {
    if (this.on) return this.code;
    let tp = null, code = '';
    for (let tries = 0; tries < 4 && !tp; tries++) {
      code = Array.from({ length: 6 }, () => CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0]).join('');
      const t = this.local ? new LocalTransport() : new PeerTransport();
      try { await t.host(code); tp = t; }
      catch (e) { t.close(); if (!e || e.type !== 'unavailable-id') throw e; }   // 코드가 겹치면 다른 코드로
    }
    if (!tp) throw Object.assign(new Error('code'), { type: 'unavailable-id' });
    this.tp = tp; this.code = code; this.role = 'host'; this.id = 'host'; this.color = 0;
    this.players.clear(); this.dirty.clear();
    tp.onmsg = (id, m) => this.hostMsg(id, m);
    tp.onclose = (id) => this.peerLeft(id);
    this.game.paused = false;
    return code;
  }
  closeRoom() {
    if (this.role !== 'host') return;
    this.all({ t: 'bye' });
    for (const m of this.game.world.ents) for (const e of m.values()) if (e.owner && e.owner !== 'host') delete e.owner;
    const tp = this.tp;
    setTimeout(() => tp.close(), 200);      // 작별 인사가 나갈 틈을 준다
    this.tp = null; this.role = 'off'; this.code = ''; this.players.clear();
    this.game.ui.netChanged();
  }

  // ── 방 들어가기 / 나가기 (손님) ──
  async join(code, onProgress) {
    code = String(code || '').trim().toUpperCase();
    const tp = this.local ? new LocalTransport() : new PeerTransport();
    const js = (this.joining = { chunks: [], n: 0, got: 0, onProgress });
    const done = new Promise((res, rej) => { js.resolve = res; js.reject = rej; });
    done.catch(() => {});
    tp.onopen = (id) => { this.hostId = id; };
    tp.onmsg = (id, m) => this.guestMsg(m);
    tp.onclose = () => this.hostLost();
    try { await tp.join(code); } catch (e) { tp.close(); this.joining = null; throw e; }
    this.tp = tp; this.role = 'guest'; this.code = code; this.ready = false; this.queue = []; this.players.clear(); this.dirty.clear();
    this.send({ t: 'hello', name: this.name, v: PROTO });
    const timer = setTimeout(() => js.reject(Object.assign(new Error('timeout'), { type: 'timeout' })), 40000);
    try { await done; }
    catch (e) { this.leave(); throw e; }
    finally { clearTimeout(timer); this.joining = null; }
  }
  leave() {
    if (this.role !== 'guest') return;
    this.closeEnt();
    this.flush();
    const tp = this.tp;
    this.tp = null; this.role = 'off'; this.code = ''; this.players.clear(); this.ready = false;
    if (tp) { tp.onclose = () => {}; setTimeout(() => tp.close(), 150); }
  }
  hostLost() {
    if (this.role !== 'guest') return;
    if (this.joining) { this.joining.reject(Object.assign(new Error('closed'), { type: 'closed' })); return; }
    const g = this.game;
    this.owned = null;
    g.save();                      // 내 가방·진행도는 지킨다
    const tp = this.tp;
    this.tp = null; this.role = 'off'; this.code = ''; this.players.clear(); this.ready = false;
    if (tp) { tp.onclose = () => {}; tp.close(); }
    g.onDisconnected();
  }

  // ── 보내기 ──
  to(id, m) { if (this.tp) this.tp.send(id, m); }
  all(m, except) { if (this.tp) for (const id of this.players.keys()) if (id !== except) this.tp.send(id, m); }
  send(m) { if (this.role === 'guest' && this.tp) this.tp.send(this.hostId, m); }
  tile(l, i) { const L = this.game.world.layers[l]; return [l, i, L.ground[i], L.obj[i], L.meta[i], L.roof[i], L.rot[i]]; }
  mark(l, i) { if (this.role !== 'off' && !this.applying) this.dirty.add(l * N + i); }
  quiet(fn) { const was = this.applying; this.applying = true; try { fn(); } finally { this.applying = was; } }
  flush() {
    if (!this.dirty.size) return;
    if (this.role === 'off' || (this.isGuest && !this.ready)) { this.dirty.clear(); return; }
    const a = [];
    for (const k of this.dirty) a.push(this.tile((k / N) | 0, k % N));
    this.dirty.clear();
    for (let s = 0; s < a.length; s += TILE_BATCH) {
      const m = { t: 'ts', a: a.slice(s, s + TILE_BATCH) };
      if (this.isHost) this.all(m); else this.send(m);
    }
  }

  // ── 타일 적용 ──
  applyTile(t) {
    const [l, i, gr, o, me, r] = t, ro = t[6] & 3, w = this.game.world, L = w.layers[l];
    if (!L || i < 0 || i >= N) return 0;
    const x = i % MAP_W, y = (i / MAP_W) | 0, prev = L.obj[i];
    if (L.ground[i] !== gr) w.setGround(l, x, y, gr);
    if (L.obj[i] !== o || L.meta[i] !== me || L.rot[i] !== ro) w.setObj(l, x, y, o, me, ro);
    if (L.roof[i] !== r) w.setRoof(l, x, y, r);
    return prev;
  }
  // 남이 뭔가를 부쉈을 때 가까이 있으면 소리와 파편을 보여 준다
  fx(l, i, prev, now) {
    const g = this.game;
    if (!prev || now || l !== g.layer || g.state !== 'play') return;
    const x = (i % MAP_W) * TILE + 8, y = ((i / MAP_W) | 0) * TILE + 8, def = OBJ[prev];
    if (Math.hypot(x - g.player.x, y - g.player.y) > 15 * TILE) return;
    g.burst(x, y - 2, def.pcol, def.wall ? 10 : 6, 60);
    g.audio.play('break_' + def.mat);
  }

  // ── 방장: 손님이 보낸 메시지 ──
  hostMsg(id, m) {
    if (this.role !== 'host' || !m) return;
    if (m.t === 'hello') return this.admit(id, m);
    const g = this.game, w = g.world, pl = this.players.get(id);
    if (!pl) return;
    switch (m.t) {
      case 'p':
        pl.x = m.x; pl.y = m.y; pl.dir = m.d; pl.moving = !!m.m; pl.layer = m.l; pl.held = m.h || '';
        if (m.s !== pl.sw) { pl.sw = m.s; pl.swingT = 0.22; }
        break;
      case 'ts':
        this.applying = true;
        try { for (const t of m.a) { const prev = this.applyTile(t); this.afterGuestTile(t[0], t[1], prev); } }
        finally { this.applying = false; }
        this.all(m, id);
        break;
      case 'brk': {
        const { l, x, y } = m;
        if (!w.inb(x, y) || (l !== 0 && l !== 1)) break;
        const i = w.idx(x, y), o = w.obj(l, x, y), e = w.ents[l].get(i);
        if (!o || !OBJ[o].canBreak || (e && e.owner && e.owner !== id)) { this.to(id, { t: 'ts', a: [this.tile(l, i)] }); break; }   // 거절: 원래 상태를 돌려준다
        g.breakObj(x, y, l, true);
        break;
      }
      case 'hv':
        if (w.inb(m.x, m.y) && !g.harvestAt(m.x, m.y, m.l, true)) this.to(id, { t: 'ts', a: [this.tile(m.l, w.idx(m.x, m.y))] });
        break;
      case 'ds':
        if (m.d && ITEMS[m.d.id] && m.d.n > 0) g.spawnDrop(m.d.id, Math.min(999, m.d.n | 0), m.d.x, m.d.y, { layer: m.d.layer ? 1 : 0, vx: m.d.vx, vy: m.d.vy, t: m.d.t });
        break;
      case 'dq': {
        const k = g.drops.findIndex((d) => d.uid === m.id);
        if (k < 0) { this.to(id, { t: 'd-', id: m.id, by: null }); break; }
        g.drops.splice(k, 1);
        this.all({ t: 'd-', id: m.id, by: id });
        break;
      }
      case 'eo': {
        const { l, i } = m, o = w.layers[l] ? w.layers[l].obj[i] : 0;
        const type = entType(o);
        if (!type) { this.to(id, { t: 'ex', why: 'gone' }); break; }
        // 큰 상자면 두 칸을 함께 맡긴다 (j, ent2 = 다른 반쪽)
        const [e, e2] = g.entsAt(l, i, type), busy = (x) => x && x.owner && x.owner !== id;
        if (busy(e) || busy(e2)) { this.to(id, { t: 'ex', why: 'busy' }); break; }
        e.owner = id;
        const msg = { t: 'eg', l, i: e2 ? Math.min(i, g.chestPartner(l, i)) : i, ent: entPub(e) };
        if (e2) { e2.owner = id; msg.j = Math.max(i, g.chestPartner(l, i)); msg.ent2 = entPub(e2); }
        this.to(id, msg);
        break;
      }
      case 'sg': {
        // 표지판 글 쓰기 / 블록에 나무 판 붙이기
        const { l, i } = m, L = w.layers[l];
        if (!L || !Number.isInteger(i) || i < 0 || i >= N) break;
        const o = L.obj[i], signs = w.signs[l], text = cleanSign(m.text);
        if (o !== O.SIGN && !signs.has(i) && !canPlaque(o)) { this.to(id, { t: 'sx', l, i }); break; }   // 거절: 붙일 수 없는 자리
        if (text || o !== O.SIGN) signs.set(i, text); else signs.delete(i);
        this.all({ t: 'sg', l, i, text }, id);
        break;
      }
      case 'sx':
        if (w.layers[m.l] && Number.isInteger(m.i) && m.i >= 0 && m.i < N) g.removePlaque(m.i % MAP_W, (m.i / MAP_W) | 0, m.l, true);
        break;
      case 'bk': {
        // 손님이 양동이를 썼다: 물을 뜨거나 붓고, 됐는지 알려 준다 (손님은 답을 받고 양동이를 바꾼다)
        const { l, x, y } = m;
        if ((l !== 0 && l !== 1) || !Number.isInteger(x) || !Number.isInteger(y) || !w.inb(x, y)) break;
        const msg = m.pour ? g.water.pour(l, x, y) : g.water.scoop(l, x, y);
        this.to(id, { t: 'bk', ok: !msg, msg, pour: !!m.pour, x, y });
        break;
      }
      case 'eu': case 'ec': {
        const e = w.ents[m.l] && w.ents[m.l].get(m.i);
        if (e && e.owner === id && m.ent && Array.isArray(m.ent.slots)) {
          e.slots = m.ent.slots;
          if (e.type !== 'chest') { e.burn = +m.ent.burn || 0; e.burnMax = +m.ent.burnMax || 0; e.prog = +m.ent.prog || 0; }
          if (m.t === 'ec') delete e.owner;
        }
        break;
      }
      case 'mh': {
        // 손님이 동물을 때렸다: 가까이 있을 때만, 너무 빠르지 않게, 그 손님이 든 물건의 공격력으로
        const mob = g.mobs.byId.get(m.id), now = performance.now();
        if (!mob || pl.layer !== 0 || now - (pl.atkAt || 0) < 250 || Math.hypot(mob.x - pl.x, mob.y - pl.y) > 5 * TILE) break;
        pl.atkAt = now;
        g.mobs.damage(mob, attackDamage(pl.held), pl.x, pl.y);
        break;
      }
      case 'chat': this.chatOut(pl.name, pl.color, String(m.text || '').slice(0, 120)); break;
    }
  }
  async admit(id, m) {
    if (this.players.has(id)) return;
    if (m.v !== PROTO) return this.to(id, { t: 'no', why: 'version' });
    if (this.players.size >= MAX_PLAYERS - 1) return this.to(id, { t: 'no', why: 'full' });
    const g = this.game, w = g.world, s = w.spawn;
    const used = new Set([0]); for (const p of this.players.values()) used.add(p.color);
    let color = 1; while (used.has(color)) color++;
    const x = s.x * TILE + 8, y = s.y * TILE + 10;
    const pl = { id, name: String(m.name || '손님').slice(0, 12), color, x, y, rx: x, ry: y, dir: 'd', moving: false, layer: 0, held: '', sw: 0, swingT: 0, anim: 0 };
    const others = [this.pubMe(), ...[...this.players.values()].map((p) => this.pub(p))];
    this.all({ t: 'join', p: this.pub(pl) });
    this.players.set(id, pl);
    // 이 순간의 세계를 통째로 묶어 보낸다 (손님의 지도는 비워서)
    const zero = new Uint8Array(N);
    const packed = pack({
      v: PROTO, seed: w.seed, id: w.id, time: g.time, entrances: w.entrances, spawn: w.spawn, drops: g.drops.map(dropPub),
      signs: w.signs.map((sm) => [...sm]),
      layers: w.layers.map((L) => ({ ground: L.ground, obj: L.obj, meta: L.meta, roof: L.roof, rot: L.rot, seen: zero })),
    });
    const b64 = b64enc(await gzip(packed));
    if (!this.players.has(id)) return;
    const n = Math.ceil(b64.length / CHUNK);
    this.to(id, { t: 'welcome', id, color, n, players: others });
    for (let k = 0; k < n; k++) this.to(id, { t: 'w', k, s: b64.slice(k * CHUNK, (k + 1) * CHUNK) });
    g.ui.toast(`${pl.name} 님이 들어왔어요`, 'good');
    g.ui.chatLine('', 0, `${pl.name} 님이 들어왔어요`);
    g.audio.play('open');
    g.ui.netChanged();
  }
  pub(p) { return { id: p.id, name: p.name, color: p.color, x: p.x, y: p.y, d: p.dir, l: p.layer }; }
  peerLeft(id) {
    const pl = this.players.get(id);
    if (!pl) return;
    this.players.delete(id);
    for (const m of this.game.world.ents) for (const e of m.values()) if (e.owner === id) delete e.owner;
    this.all({ t: 'leave', id });
    this.game.ui.toast(`${pl.name} 님이 나갔어요`);
    this.game.ui.chatLine('', 0, `${pl.name} 님이 나갔어요`);
    this.game.ui.netChanged();
  }
  // 손님이 바꾼 타일에 대해 방장이 챙길 것들: 상자·화로 내용물, 성장 타이머
  afterGuestTile(l, i, prev) {
    const g = this.game, w = g.world, L = w.layers[l];
    if (!L) return;
    const o = L.obj[i], def = OBJ[o], m = L.meta[i], gm = w.grow[l];
    if (o !== prev) {
      if (entType(o)) g.ensureEnt(l, i, entType(o)); else w.ents[l].delete(i);
    }
    if (def.grow && !(def.crop && m >= 3)) { if (!gm.has(i) || o !== prev) gm.set(i, rand(def.grow[0], def.grow[1])); }
    else if (def.harvest && m === 0) { if (!gm.has(i)) gm.set(i, rand(def.harvest.regrow[0], def.harvest.regrow[1])); }
    else gm.delete(i);
    this.fx(l, i, prev, o);
  }
  dropNew(d) { if (this.role === 'host') this.all({ t: 'd+', d: dropPub(d) }); }
  dropGone(uid, by = 'host') { if (this.role === 'host') this.all({ t: 'd-', id: uid, by }); }

  // ── 손님: 방장이 보낸 메시지 ──
  guestMsg(m) {
    if (!m) return;
    const js = this.joining;
    if (m.t === 'no') { if (js) js.reject(Object.assign(new Error(m.why), { type: m.why })); return; }
    if (m.t === 'welcome') { if (js) { this.id = m.id; this.color = m.color; js.n = m.n; js.players = m.players; } return; }
    if (m.t === 'w') {
      if (!js) return;
      js.chunks[m.k] = m.s; js.got++;
      if (js.onProgress) js.onProgress(js.got / js.n);
      if (js.got === js.n) this.finishJoin(js).catch((e) => js.reject(e));
      return;
    }
    if (!this.ready) { this.queue.push(m); return; }
    this.guestApply(m);
  }
  async finishJoin(js) {
    const data = unpack(await gunzip(b64dec(js.chunks.join(''))));
    const world = restoreWorld({ ...data, ents: [[], []], grow: [[], []] });
    const profile = await loadProfile(world.id);
    if (this.role !== 'guest') return;
    this.game.joinWorld(world, data, profile);
    for (const p of js.players || []) this.addPlayer(p);
    this.ready = true;
    for (const m of this.queue) this.guestApply(m);    // 세계를 받는 동안 쌓인 변경을 순서대로 적용
    this.queue = [];
    js.resolve();
  }
  addPlayer(p) {
    this.players.set(p.id, { id: p.id, name: p.name, color: p.color, x: p.x, y: p.y, rx: p.x, ry: p.y, dir: p.d || 'd', moving: false, layer: p.l || 0, held: '', sw: 0, swingT: 0, anim: 0 });
  }
  guestApply(m) {
    const g = this.game;
    switch (m.t) {
      case 'ps':
        for (const [id, x, y, d, mv, l, h, s] of m.a) {
          const pl = this.players.get(id);
          if (!pl) continue;
          pl.x = x; pl.y = y; pl.dir = d; pl.moving = !!mv; pl.layer = l; pl.held = h || '';
          if (s !== pl.sw) { pl.sw = s; pl.swingT = 0.22; }
        }
        break;
      case 'join': this.addPlayer(m.p); g.ui.toast(`${m.p.name} 님이 들어왔어요`, 'good'); g.ui.chatLine('', 0, `${m.p.name} 님이 들어왔어요`); g.ui.netChanged(); break;
      case 'leave': {
        const pl = this.players.get(m.id);
        if (pl) { this.players.delete(m.id); g.ui.toast(`${pl.name} 님이 나갔어요`); g.ui.chatLine('', 0, `${pl.name} 님이 나갔어요`); g.ui.netChanged(); }
        break;
      }
      case 'ts':
        this.applying = true;
        try {
          for (const t of m.a) {
            const prev = this.applyTile(t);
            this.fx(t[0], t[1], prev, t[3]);
            const ow = this.owned;
            if (ow && ow.l === t[0] && (ow.i === t[1] || ow.j === t[1]) && !entType(t[3])) { const e = ow.ent; this.owned = null; g.ui.entGone(e); }
          }
        } finally { this.applying = false; }
        break;
      case 'd+': if (m.d && ITEMS[m.d.id] && !g.drops.some((d) => d.uid === m.d.uid)) g.drops.push({ z: 3, vz: rand(55, 95), age: 0, ...m.d }); break;
      case 'd-': g.takeDrop(m.id, m.by === this.id); break;
      case 'eg': {
        this.pendingEnt = null;
        this.owned = { l: m.l, i: m.i, ent: m.ent, sent: JSON.stringify(entPub(m.ent)) };
        if (m.ent2) Object.assign(this.owned, { j: m.j, ent2: m.ent2, sent2: JSON.stringify(entPub(m.ent2)) });   // 큰 상자의 다른 반쪽
        g.ui.open(m.ent.type, m.ent, m.ent2 || null);
        break;
      }
      case 'sg': {
        const L = g.world.layers[m.l], signs = g.world.signs[m.l];
        if (!L || !L.obj[m.i]) break;
        const text = cleanSign(m.text);
        if (text || L.obj[m.i] !== O.SIGN) signs.set(m.i, text); else signs.delete(m.i);
        break;
      }
      case 'sx':
        if (g.world.layers[m.l]) { if (!g.removePlaque(m.i % MAP_W, (m.i / MAP_W) | 0, m.l, true)) g.world.signs[m.l].delete(m.i); }
        break;
      case 'ex': this.pendingEnt = null; g.ui.toast(m.why === 'busy' ? '다른 플레이어가 쓰고 있어요' : '지금은 열 수 없어요'); g.audio.play('deny'); break;
      case 'bk':
        g.bkWait = 0;
        if (m.ok) g.bucketDone(!!m.pour, m.x, m.y); else { g.ui.toast(String(m.msg || '지금은 할 수 없어요')); g.audio.play('deny'); }
        break;
      case 'tm': if (Math.abs(g.time - m.time) > 0.5) g.time = m.time; break;
      case 'ms': if (Array.isArray(m.a)) g.mobs.netApply(m.a); break;
      case 'md': g.mobs.netDied(m); break;
      case 'chat': g.ui.chatLine(m.name, m.color, m.text); break;
      case 'bye': this.hostLost(); break;
    }
  }

  // ── 상자·화로 (손님) ──
  requestEnt(l, i) {
    if (this.pendingEnt && performance.now() - this.pendingEnt.at < 3000) return;
    this.pendingEnt = { l, i, at: performance.now() };
    this.send({ t: 'eo', l, i });
  }
  syncEnt() {
    const o = this.owned;
    if (!o) return;
    const s = JSON.stringify(entPub(o.ent));
    if (s !== o.sent) { o.sent = s; this.send({ t: 'eu', l: o.l, i: o.i, ent: entPub(o.ent) }); }
    if (!o.ent2) return;
    const s2 = JSON.stringify(entPub(o.ent2));
    if (s2 !== o.sent2) { o.sent2 = s2; this.send({ t: 'eu', l: o.l, i: o.j, ent: entPub(o.ent2) }); }
  }
  closeEnt() {
    const o = this.owned;
    if (!o) return;
    this.send({ t: 'ec', l: o.l, i: o.i, ent: entPub(o.ent) });
    if (o.ent2) this.send({ t: 'ec', l: o.l, i: o.j, ent: entPub(o.ent2) });
    this.owned = null;
  }

  // ── 대화 ──
  chat(text) {
    text = String(text || '').trim().slice(0, 120);
    if (!text || !this.on) return;
    if (this.isGuest) this.send({ t: 'chat', text }); else this.chatOut(this.name, this.color, text);
  }
  chatOut(name, color, text) { this.all({ t: 'chat', name, color, text }); this.game.ui.chatLine(name, color, text); }

  // ── 매 프레임 ──
  update(dt) {
    for (const p of this.players.values()) {
      const k = Math.min(1, dt * 14);
      if (Math.hypot(p.x - p.rx, p.y - p.ry) > 90) { p.rx = p.x; p.ry = p.y; }
      else { p.rx += (p.x - p.rx) * k; p.ry += (p.y - p.ry) * k; }
      p.anim = p.moving ? p.anim + dt * 8 : 0;
      if (p.swingT > 0) p.swingT -= dt;
    }
    if (this.role === 'off') return;
    const me = this.game.player;
    if (me.swing > this.lastSwing + 0.01) this.swingN++;
    this.lastSwing = me.swing;
    this.sendAcc += dt;
    if (this.sendAcc >= 0.08) { this.sendAcc = 0; this.sendState(); }
    if (this.isGuest) { this.entAcc += dt; if (this.entAcc > 0.25) { this.entAcc = 0; this.syncEnt(); } }
    else {
      this.timeAcc += dt; if (this.timeAcc > 3) { this.timeAcc = 0; this.all({ t: 'tm', time: this.game.time }); }
      this.mobAcc += dt; if (this.mobAcc >= 0.12) { this.mobAcc = 0; this.sendMobs(); }
    }
  }
  // 방장: 지상에 있는 손님마다 그 근처의 동물들을 알려 준다
  sendMobs() {
    const mobs = this.game.mobs;
    for (const q of this.players.values()) {
      if (q.layer !== 0) continue;
      const a = mobs.netState(q.x, q.y);
      if (a.length) this.to(q.id, { t: 'ms', a });
    }
  }
  sendState() {
    const g = this.game, p = g.player, h = g.heldSlot();
    const mine = [this.id, Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10, p.dir, p.moving ? 1 : 0, g.layer, h ? h.id : '', this.swingN];
    if (this.isGuest) {
      if (!this.ready) return;
      const s = mine.join(), now = performance.now();
      if (s === this.lastP && now - this.lastPAt < 1000) return;
      this.lastP = s; this.lastPAt = now;
      this.send({ t: 'p', x: mine[1], y: mine[2], d: mine[3], m: mine[4], l: mine[5], h: mine[6], s: mine[7] });
    } else if (this.players.size) {
      const rows = [mine];
      for (const q of this.players.values()) rows.push([q.id, q.x, q.y, q.dir, q.moving ? 1 : 0, q.layer, q.held, q.sw]);
      for (const id of this.players.keys()) this.to(id, { t: 'ps', a: rows.filter((r) => r[0] !== id) });
    }
  }
  // 방장이 다른 탭을 보고 있어 화면이 멈춰도, 세계(시간·성장·화로·동물)와 중계는 계속 돌린다
  background() {
    const now = performance.now(), dt = Math.min(5, (now - this.bgAt) / 1000);
    this.bgAt = now;
    if (!document.hidden || this.role !== 'host' || this.game.state !== 'play') return;
    this.game.simulate(dt);
    this.sendState();
    this.sendMobs();
    this.all({ t: 'tm', time: this.game.time });
  }
}
