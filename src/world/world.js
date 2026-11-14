// 월드 데이터: 지상/지하 두 레이어의 타일 배열 + 타일 엔티티 + 성장 타이머
import { MAP_W, MAP_H } from '../config.js';
import { GROUND } from '../data/ground.js';
import { O, OBJ } from '../data/objects.js';

const N = MAP_W * MAP_H;

export class World {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.w = MAP_W; this.h = MAP_H;
    const mk = () => ({
      ground: new Uint8Array(N), obj: new Uint8Array(N), meta: new Uint8Array(N), seen: new Uint8Array(N),
    });
    this.layers = [mk(), mk()];
    this.ents = [new Map(), new Map()];   // idx → { type, ... } (상자, 화로)
    this.grow = [new Map(), new Map()];   // idx → 남은 시간(초)
    this.entrances = [];                  // 동굴 입구 좌표 [{x, y}]
    this.spawn = { x: MAP_W >> 1, y: MAP_H >> 1 };
    this.onChange = null;                 // (layer, x, y) — 미니맵 갱신용
  }
  inb(x, y) { return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H; }
  idx(x, y) { return y * MAP_W + x; }
  ground(l, x, y) { return this.inb(x, y) ? this.layers[l].ground[y * MAP_W + x] : 0; }
  obj(l, x, y) { return this.inb(x, y) ? this.layers[l].obj[y * MAP_W + x] : 0; }
  meta(l, x, y) { return this.inb(x, y) ? this.layers[l].meta[y * MAP_W + x] : 0; }
  setGround(l, x, y, g) {
    if (!this.inb(x, y)) return;
    this.layers[l].ground[y * MAP_W + x] = g;
    if (this.onChange) this.onChange(l, x, y);
  }
  setObj(l, x, y, o, m = 0) {
    if (!this.inb(x, y)) return;
    const i = y * MAP_W + x;
    this.layers[l].obj[i] = o; this.layers[l].meta[i] = m;
    if (this.onChange) this.onChange(l, x, y);
  }
  setMeta(l, x, y, m) {
    if (!this.inb(x, y)) return;
    this.layers[l].meta[y * MAP_W + x] = m;
    if (this.onChange) this.onChange(l, x, y);
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
