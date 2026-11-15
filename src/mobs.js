// 동물: 풀밭을 돌아다니고, 맞으면 달아나고, 잡으면 아이템을 떨어뜨린다.
// 움직임은 세계의 주인(혼자 할 때의 나 / 방장)만 계산한다. 손님은 방장이 보내 주는
// 가까운 동물들의 위치를 받아 부드럽게 따라 그리고, 때릴 때는 방장에게 부탁한다.
import { TILE, MAP_W, MAP_H, SURFACE } from './config.js';
import { G } from './data/ground.js';
import { MOBS, MOB_KEYS } from './data/mobs.js';

const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const TARGET = 220;                // 세계 전체의 동물 수 목표
const ACTIVE = 44 * TILE;          // 플레이어에게서 이만큼 안에 있는 동물만 움직인다
const STREAM = 34 * TILE;          // 손님에게는 이만큼 안의 동물만 알려 준다
const HEAR = 13 * TILE;            // 울음소리가 들리는 거리

export class Mobs {
  constructor(game) {
    this.game = game;
    this.list = []; this.byId = new Map();
    this.seq = 1; this.spawnAcc = 0;
  }
  clear() { this.list = []; this.byId.clear(); this.seq = 1; this.spawnAcc = 0; }
  add(k, x, y, hp, id) {
    const d = MOBS[k];
    const m = {
      id: id ?? this.seq++, k, x, y, rx: x, ry: y, hp: hp ?? d.hp, dir: Math.random() < 0.5 ? 'l' : 'r',
      moving: false, anim: 0, state: 'idle', t: rand(0.5, 4), ax: 0, ay: 0, kx: 0, ky: 0,
      hurt: 0, hc: 0, voiceT: rand(8, 50), seenAt: 0, mine: 0,
    };
    this.list.push(m); this.byId.set(m.id, m);
    return m;
  }
  remove(m) {
    const k = this.list.indexOf(m);
    if (k >= 0) this.list.splice(k, 1);
    this.byId.delete(m.id);
  }
  serialize() { return this.list.map((m) => [m.k, Math.round(m.x), Math.round(m.y), m.hp]); }
  load(arr) {
    this.clear();
    for (const [k, x, y, hp] of arr) if (MOBS[k]) this.add(k, x, y, hp);
  }

  // ── 처음 채우기 · 다시 채우기 ──
  free(tx, ty) {
    const w = this.game.world;
    if (tx < 3 || ty < 3 || tx >= MAP_W - 3 || ty >= MAP_H - 3) return false;
    const g = w.ground(SURFACE, tx, ty);
    return (g === G.GRASS || g === G.DIRT) && !w.solid(SURFACE, tx, ty);
  }
  herd(cx, cy, k) {
    const d = MOBS[k], n = randi(d.herd[0], d.herd[1]);
    let made = 0;
    for (let t = 0; t < 40 && made < n; t++) {
      const x = cx + randi(-3, 3), y = cy + randi(-3, 3);
      if (!this.free(x, y)) continue;
      this.add(k, x * TILE + 8 + rand(-3, 3), y * TILE + 10 + rand(-2, 2));
      made++;
    }
    return made;
  }
  // 새 세계(또는 동물이 없던 예전 세이브)에 동물 무리를 뿌린다
  populate() {
    this.clear();
    const w = this.game.world, s = w.spawn;
    // 시작 지점에서 멀지 않은 곳에 양 떼와 다른 무리 몇 개를 꼭 둔다
    for (const k of ['sheep', 'cow', 'chicken', 'pig']) {
      for (let t = 0; t < 60; t++) {
        const a = rand(0, Math.PI * 2), r = rand(9, 24 + t * 0.4);
        const x = Math.round(s.x + Math.cos(a) * r), y = Math.round(s.y + Math.sin(a) * r);
        if (w.ground(SURFACE, x, y) === G.GRASS && this.herd(x, y, k)) break;
      }
    }
    for (let t = 0; t < 2400 && this.list.length < TARGET; t++) {
      const x = randi(8, MAP_W - 9), y = randi(8, MAP_H - 9);
      if (w.ground(SURFACE, x, y) !== G.GRASS) continue;
      if ((x - s.x) ** 2 + (y - s.y) ** 2 < 36) continue;
      this.herd(x, y, MOB_KEYS[randi(0, MOB_KEYS.length - 1)]);
    }
  }
  // 많이 줄었으면 플레이어가 보지 않는 먼 풀밭에 한 무리씩 다시 나타난다
  respawn(pts) {
    if (this.list.length >= TARGET * 0.75) return;
    const w = this.game.world;
    for (let t = 0; t < 30; t++) {
      const x = randi(8, MAP_W - 9), y = randi(8, MAP_H - 9);
      if (w.ground(SURFACE, x, y) !== G.GRASS) continue;
      const px = x * TILE, py = y * TILE;
      if (pts.some((q) => Math.abs(q.x - px) < ACTIVE && Math.abs(q.y - py) < ACTIVE)) continue;
      if (this.herd(x, y, MOB_KEYS[randi(0, MOB_KEYS.length - 1)])) return;
    }
  }

  // ── 충돌 ──
  blocked(m, x, y) {
    const w = this.game.world, hw = MOBS[m.k].hw;
    const x0 = Math.floor((x - hw) / TILE), x1 = Math.floor((x + hw) / TILE);
    const y0 = Math.floor((y - 3) / TILE), y1 = Math.floor((y + 1) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (w.solid(SURFACE, tx, ty)) return true;
    return false;
  }
  // 이 칸에 걸쳐 서 있는 동물이 있는가 (그 칸에 블록을 놓거나 문을 닫지 못하게)
  overlapsTile(l, tx, ty) {
    if (l !== SURFACE) return false;
    const x0 = tx * TILE, y0 = ty * TILE;
    for (const m of this.list) {
      const hw = MOBS[m.k].hw;
      if (m.x + hw > x0 && m.x - hw < x0 + TILE && m.y + 1 > y0 && m.y - 3 < y0 + TILE) return true;
    }
    return false;
  }
  // 이 지점(월드 좌표)에 그려진 동물. 겹치면 앞에 있는(아래쪽) 동물
  pick(wx, wy) {
    let best = null;
    for (const m of this.list) {
      const d = MOBS[m.k];
      if (wx < m.rx - d.w / 2 || wx > m.rx + d.w / 2 || wy < m.ry - d.h || wy > m.ry + 2) continue;
      if (!best || m.ry > best.ry) best = m;
    }
    return best;
  }

  // ── 매 프레임 ──
  // 지상에 있는 플레이어들의 위치 (이 근처의 동물만 움직인다)
  watchers() {
    const g = this.game, pts = [];
    if (g.layer === SURFACE) pts.push({ x: g.player.x, y: g.player.y });
    for (const q of g.net.players.values()) if (q.layer === SURFACE) pts.push({ x: q.x, y: q.y });
    return pts;
  }
  update(dt) {
    if (this.game.net.isGuest) return this.updateGuest(dt);
    const pts = this.watchers();
    this.spawnAcc += dt;
    if (this.spawnAcc > 45) { this.spawnAcc = 0; this.respawn(pts); }
    if (!pts.length) return;
    // 한 번에 크게 움직이면 울타리를 뚫으므로 잘게 나눠 계산한다
    const total = Math.min(1, dt), steps = Math.max(1, Math.ceil(total / 0.05)), h = total / steps;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const m = this.list[i];
      if (!pts.some((q) => Math.abs(q.x - m.x) < ACTIVE && Math.abs(q.y - m.y) < ACTIVE)) { m.moving = false; continue; }
      for (let s = 0; s < steps; s++) this.step(m, h);
      m.rx = m.x; m.ry = m.y;
      this.chatter(m, total);
    }
  }
  step(m, h) {
    const d = MOBS[m.k];
    if (m.hurt > 0) m.hurt -= h;
    m.t -= h;
    let vx = 0, vy = 0;
    if (m.state === 'idle') {
      if (m.t <= 0) {
        if (Math.random() < 0.7) {
          const a = rand(0, Math.PI * 2);
          m.ax = Math.cos(a); m.ay = Math.sin(a) * 0.8; m.state = 'walk'; m.t = rand(1, 3.2);
        } else m.t = rand(1, 4);
      }
    } else {
      const sp = d.speed * (m.state === 'flee' ? 2.5 : 1);
      vx = m.ax * sp; vy = m.ay * sp;
      if (m.t <= 0) { m.t = m.state === 'flee' ? rand(0.4, 1.5) : rand(1.5, 5); m.state = 'idle'; }
    }
    m.moving = m.state !== 'idle';
    if (m.moving && Math.abs(m.ax) > 0.15) m.dir = m.ax > 0 ? 'r' : 'l';
    if (m.kx || m.ky) {                        // 맞았을 때 밀려나기
      vx += m.kx; vy += m.ky;
      const f = Math.pow(0.004, h); m.kx *= f; m.ky *= f;
      if (Math.abs(m.kx) + Math.abs(m.ky) < 3) m.kx = m.ky = 0;
    }
    if (vx || vy) {
      const dx = vx * h, dy = vy * h;
      if (this.blocked(m, m.x, m.y)) { m.x += dx; m.y += dy; }       // 끼었을 때는 빠져나올 수 있게
      else {
        let hit = false;
        if (!this.blocked(m, m.x + dx, m.y)) m.x += dx; else hit = true;
        if (!this.blocked(m, m.x, m.y + dy)) m.y += dy; else hit = true;
        if (hit && m.moving) {
          if (m.state === 'flee') { const a = rand(0, Math.PI * 2); m.ax = Math.cos(a); m.ay = Math.sin(a) * 0.8; }   // 달아나다 막히면 다른 쪽으로
          else { m.state = 'idle'; m.t = rand(0.3, 1.5); }
        }
      }
      m.x = Math.max(8, Math.min(MAP_W * TILE - 8, m.x)); m.y = Math.max(10, Math.min(MAP_H * TILE - 6, m.y));
    }
    m.anim = m.moving ? m.anim + h * (m.state === 'flee' ? 13 : 6) : 0;
  }
  updateGuest(dt) {
    const now = performance.now(), k = Math.min(1, dt * 12);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const m = this.list[i];
      if (now - m.seenAt > 2500) { this.remove(m); continue; }       // 멀어져서 방장이 더 알려 주지 않는 동물
      if (Math.hypot(m.x - m.rx, m.y - m.ry) > 60) { m.rx = m.x; m.ry = m.y; }
      else { m.rx += (m.x - m.rx) * k; m.ry += (m.y - m.ry) * k; }
      m.anim = m.moving ? m.anim + dt * 7 : 0;
      if (m.hurt > 0) m.hurt -= dt;
      this.chatter(m, dt);
    }
  }
  // 가끔 우는 소리 (가까울수록 크게)
  chatter(m, dt) {
    m.voiceT -= dt;
    if (m.voiceT > 0) return;
    m.voiceT = rand(18, 60);
    this.voice(m, 0.55);
  }
  loud(x, y) {
    const g = this.game;
    if (g.layer !== SURFACE || g.state !== 'play') return 0;
    return Math.max(0, 1 - Math.hypot(x - g.player.x, y - g.player.y) / HEAR);
  }
  voice(m, k = 1) {
    const v = this.loud(m.rx, m.ry) * k;
    if (v > 0.04) this.game.audio.play(MOBS[m.k].voice, v);
  }

  // ── 때리기 ──
  // 내가 때렸다: 세계의 주인이면 바로 처리하고, 손님이면 방장에게 부탁한다
  strike(m, dmg) {
    const g = this.game;
    if (g.net.isGuest) {
      g.net.send({ t: 'mh', id: m.id });
      m.mine = performance.now();              // 곧 방장이 알려 줄 '맞았다'는 소식에 소리를 또 내지 않도록
      this.hitFx(m);
      return;
    }
    this.damage(m, dmg, g.player.x, g.player.y);
  }
  // 세계의 주인: 체력을 깎고, 달아나게 하고, 죽으면 아이템을 떨어뜨린다
  damage(m, dmg, fx, fy) {
    if (!this.byId.has(m.id)) return;
    m.hp -= dmg; m.hc = (m.hc + 1) & 255;
    const dx = m.x - fx, dy = m.y - fy, len = Math.hypot(dx, dy) || 1;
    m.ax = dx / len; m.ay = dy / len; m.state = 'flee'; m.t = rand(2.5, 4);
    m.kx = m.ax * 95; m.ky = m.ay * 95;
    this.hitFx(m);
    if (m.hp <= 0) this.kill(m);
  }
  kill(m) {
    const g = this.game;
    for (const [id, min, max, chance = 1] of MOBS[m.k].drops) {
      if (Math.random() < chance) g.spawnDrop(id, randi(min, max), m.x, m.y - 4, { layer: SURFACE });
    }
    this.remove(m);
    this.dieFx(m.k, m.x, m.y);
    g.net.all({ t: 'md', id: m.id, k: m.k, x: Math.round(m.x), y: Math.round(m.y) });
  }
  hitFx(m) {
    m.hurt = 0.22;
    const v = this.loud(m.rx, m.ry);
    if (v <= 0.04) return;
    const g = this.game, d = MOBS[m.k];
    g.audio.play('hit_mob', v);
    g.audio.play(d.voice, v);
    g.burst(m.rx, m.ry - d.h / 2, d.pcol, 4, 45);
  }
  dieFx(k, x, y) {
    const v = this.loud(x, y);
    if (v <= 0.04) return;
    const g = this.game, d = MOBS[k];
    g.audio.play('mob_die', v);
    g.burst(x, y - d.h / 2, [0xffffff, 0xe8e4d8, ...d.pcol], 14, 60, 0.6);
  }

  // ── 멀티플레이 ──
  // 방장 → 손님: 그 손님 가까이에 있는 동물들 [번호, 종류, x, y, 움직임·방향, 체력, 맞은 횟수]
  netState(px, py) {
    const a = [];
    for (const m of this.list) {
      if (Math.abs(m.x - px) > STREAM || Math.abs(m.y - py) > STREAM) continue;
      a.push([m.id, MOB_KEYS.indexOf(m.k), Math.round(m.x), Math.round(m.y), (m.moving ? 1 : 0) | (m.dir === 'r' ? 2 : 0) | (m.state === 'flee' ? 4 : 0), m.hp, m.hc]);
      if (a.length >= 90) break;
    }
    return a;
  }
  netApply(rows) {
    const now = performance.now();
    for (const [id, ki, x, y, fl, hp, hc] of rows) {
      const k = MOB_KEYS[ki];
      if (!k) continue;
      let m = this.byId.get(id);
      if (!m) { m = this.add(k, x, y, hp, id); m.hc = hc; }
      else if (hc !== m.hc) { m.hc = hc; if (now - m.mine > 700) this.hitFx(m); else m.hurt = 0.22; }
      m.x = x; m.y = y; m.hp = hp; m.moving = !!(fl & 1); m.dir = fl & 2 ? 'r' : 'l'; m.state = fl & 4 ? 'flee' : m.moving ? 'walk' : 'idle';
      m.seenAt = now;
    }
  }
  netDied(msg) {
    const m = this.byId.get(msg.id);
    if (m) this.remove(m);
    if (MOBS[msg.k]) this.dieFx(msg.k, msg.x, msg.y);
  }
}
