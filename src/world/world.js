// 월드 데이터: 지상/지하 두 레이어의 타일 배열 + 타일 엔티티 + 성장 타이머 + 지붕 · 깃발
import { MAP_W, MAP_H } from '../config.js';
import { GROUND } from '../data/ground.js';
import { O, OBJ } from '../data/objects.js';

const N = MAP_W * MAP_H;

export class World {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.id = '';                         // 세계 고유 번호 (멀티플레이 손님이 자기 가방을 이 번호로 기억한다)
    this.w = MAP_W; this.h = MAP_H;
    const mk = () => ({
      ground: new Uint8Array(N), obj: new Uint8Array(N), meta: new Uint8Array(N), seen: new Uint8Array(N),
      roof: new Uint8Array(N),            // 타일 위를 덮는 지붕 (0 없음 / 1 있음)
    });
    this.layers = [mk(), mk()];
    this.ents = [new Map(), new Map()];   // idx → { type, ... } (상자, 화로)
    this.grow = [new Map(), new Map()];   // idx → 남은 시간(초)
    this.entrances = [];                  // 동굴 입구 좌표 [{x, y}]
    this.spawn = { x: MAP_W >> 1, y: MAP_H >> 1 };
    this.flags = [[], []];                // 깃발이 꽂힌 타일 idx 목록 (지도 표시용)
    this.roofs = [new Set(), new Set()];  // 지붕 타일 idx 집합
    this.regions = [null, null];          // 이어진 지붕 덩어리 캐시 (idx → region)
    this.onChange = null;                 // (layer, x, y) — 미니맵 갱신용
  }
  inb(x, y) { return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H; }
  idx(x, y) { return y * MAP_W + x; }
  ground(l, x, y) { return this.inb(x, y) ? this.layers[l].ground[y * MAP_W + x] : 0; }
  obj(l, x, y) { return this.inb(x, y) ? this.layers[l].obj[y * MAP_W + x] : 0; }
  meta(l, x, y) { return this.inb(x, y) ? this.layers[l].meta[y * MAP_W + x] : 0; }
  roof(l, x, y) { return this.inb(x, y) ? this.layers[l].roof[y * MAP_W + x] : 0; }
  setGround(l, x, y, g) {
    if (!this.inb(x, y)) return;
    this.layers[l].ground[y * MAP_W + x] = g;
    if (this.onChange) this.onChange(l, x, y);
  }
  setObj(l, x, y, o, m = 0) {
    if (!this.inb(x, y)) return;
    const i = y * MAP_W + x, L = this.layers[l], old = L.obj[i];
    if (old === O.FLAG && o !== O.FLAG) { const k = this.flags[l].indexOf(i); if (k >= 0) this.flags[l].splice(k, 1); }
    if (o === O.FLAG && old !== O.FLAG) this.flags[l].push(i);
    L.obj[i] = o; L.meta[i] = m;
    if (this.onChange) this.onChange(l, x, y);
  }
  setMeta(l, x, y, m) {
    if (!this.inb(x, y)) return;
    this.layers[l].meta[y * MAP_W + x] = m;
    if (this.onChange) this.onChange(l, x, y);
  }
  setRoof(l, x, y, v) {
    if (!this.inb(x, y)) return;
    const i = y * MAP_W + x;
    this.layers[l].roof[i] = v ? 1 : 0;
    if (v) this.roofs[l].add(i); else this.roofs[l].delete(i);
    this.regions[l] = null;
    if (this.onChange) this.onChange(l, x, y);
  }
  // 불러온 직후: 타일 배열에서 깃발 · 지붕 목록을 다시 만든다
  rescan() {
    for (let l = 0; l < 2; l++) {
      const L = this.layers[l];
      this.flags[l] = []; this.roofs[l] = new Set(); this.regions[l] = null;
      for (let i = 0; i < N; i++) {
        if (L.obj[i] === O.FLAG) this.flags[l].push(i);
        if (L.roof[i]) this.roofs[l].add(i);
      }
    }
  }
  // 이 타일을 덮은 지붕이 속한 덩어리(상하좌우로 이어진 지붕들)
  regionAt(l, i) {
    if (!this.layers[l].roof[i]) return null;
    let m = this.regions[l];
    if (!m) {
      m = this.regions[l] = new Map();
      const set = this.roofs[l];
      for (const s of set) {
        if (m.has(s)) continue;
        const reg = { tiles: [], frame: -1, open: false, alpha: -1, af: -1 };
        const stack = [s];
        m.set(s, reg);
        while (stack.length) {
          const c = stack.pop(), cx = c % MAP_W;
          reg.tiles.push(c);
          for (const j of [c - 1, c + 1, c - MAP_W, c + MAP_W]) {
            if ((j === c - 1 && cx === 0) || (j === c + 1 && cx === MAP_W - 1)) continue;
            if (set.has(j) && !m.has(j)) { m.set(j, reg); stack.push(j); }
          }
        }
      }
    }
    return m.get(i) || null;
  }
  // 걸어갈 수 없는 타일인가
  solid(l, x, y) {
    if (!this.inb(x, y)) return true;
    const i = y * MAP_W + x, L = this.layers[l];
    if (!GROUND[L.ground[i]].walk) return true;
    const o = L.obj[i];
    if (o === O.NONE) return false;
    if (o === O.DOOR) return L.meta[i] === 0;
    return OBJ[o].solid;
  }
  isWallAt(l, x, y) {
    if (!this.inb(x, y)) return true;
    return OBJ[this.layers[l].obj[y * MAP_W + x]].wall;
  }
  // 벽 블록이 빈 공간과 맞닿아 있는가 (맞닿지 않은 벽은 정체를 알 수 없는 어둠으로 그린다)
  exposed(l, x, y) {
    const obj = this.layers[l].obj;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= MAP_W || yy >= MAP_H) continue;
      if (!OBJ[obj[yy * MAP_W + xx]].wall) return true;
    }
    return false;
  }
  // 주변 r칸 안에 물이 있는가 (작물 성장 보너스)
  nearWater(l, x, y, r = 3) {
    const g = this.layers[l].ground;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const xx = x + dx, yy = y + dy;
      if (this.inb(xx, yy) && GROUND[g[yy * MAP_W + xx]].water) return true;
    }
    return false;
  }
}
