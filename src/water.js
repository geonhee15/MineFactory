// 물: 양동이로 뜨고 붓기, 부은 물이 번지고 마르는 규칙 (세계의 주인만 계산한다)
//
//  · 자연의 물(호수 · 바다 · 지하 호수)은 가만히 있다. 번지지 않고, 떠도 둘레에 물이 있으면 마르지 않는다.
//  · 양동이로 부은 물은 '솟는 자리'(lv 0)가 되고, 거기서 FLOW_MAX칸까지 얕게 번진다 (lv 1, 2, 3…).
//    얕은 물의 깊이(lv)는 '둘레에서 가장 가까운 물 + 1'이고, 이어진 솟는 자리가 없어지면 바깥부터 말라 들어간다.
//  · 무한 물: 얕은 물 칸의 상하좌우에 솟는 자리가 둘 이상이면 그 칸도 솟는 자리가 된다.
//    (솟는 자리 둘 사이의 칸, 대각선으로 놓은 둘 사이의 두 칸 — 가운데를 떠도 다시 차오른다)
//
// 부은 물은 world.water[층] (idx → { u: 물 아래의 원래 바닥, lv })에 적어 둔다. 자연의 물은 여기에 없다.
import { MAP_W, CAVE } from './config.js';
import { G, GROUND } from './data/ground.js';
import { O, OBJ } from './data/objects.js';

export const FLOW_MAX = 3;          // 솟는 자리에서 번져 가는 가장 먼 거리(칸)
const FLOW_TICK = 0.35;             // 물이 한 칸 번지거나 마르는 간격(초)
const NB = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export class Water {
  constructor(game) { this.game = game; this.acc = 0; }
  // 이 칸과 둘레를 다음 차례에 다시 살핀다
  wake(l, x, y) {
    const w = this.game.world, q = w.flowQ[l];
    q.add(y * MAP_W + x);
    for (const [dx, dy] of NB) if (w.inb(x + dx, y + dy)) q.add((y + dy) * MAP_W + x + dx);
  }
  // 마른 칸에 물이 들어올 수 있는가: 걸어 다닐 수 있는 바닥이고, 놓인 것이 없어야 한다 (수풀은 물에 쓸려 간다)
  canHold(l, x, y) {
    const w = this.game.world;
    if (!w.inb(x, y)) return false;
    const gd = GROUND[w.ground(l, x, y)], o = w.obj(l, x, y);
    return gd.walk && !gd.water && (!o || OBJ[o].replace);
  }
  enter(l, x, y, lv) {
    const w = this.game.world;
    if (w.obj(l, x, y)) w.setObj(l, x, y, O.NONE);
    w.water[l].set(y * MAP_W + x, { u: w.ground(l, x, y), lv });
    w.setGround(l, x, y, lv ? G.SHALLOW : G.WATER);
    this.wake(l, x, y);
  }
  dry(l, x, y) {
    const w = this.game.world, i = y * MAP_W + x, e = w.water[l].get(i);
    if (!e) return;
    w.water[l].delete(i);
    w.setGround(l, x, y, e.u);
    this.wake(l, x, y);
  }

  // ── 양동이 ── 돌려주는 값: 됐으면 '', 안 됐으면 이유
  pour(l, x, y) {
    const w = this.game.world, e = w.water[l].get(y * MAP_W + x);
    if (e) {
      if (e.lv === 0) return '여기는 이미 물이 솟는 자리예요';
      e.lv = 0; w.setGround(l, x, y, G.WATER); this.wake(l, x, y);     // 얕은 물 위에 부으면 솟는 자리가 된다
      return '';
    }
    if (GROUND[w.ground(l, x, y)].water) return '여기는 이미 물이에요';
    if (!this.canHold(l, x, y)) return '여기에는 물을 부을 수 없어요';
    this.enter(l, x, y, 0);
    return '';
  }
  scoop(l, x, y) {
    const w = this.game.world, e = w.water[l].get(y * MAP_W + x);
    if (e) {
      if (e.lv > 0) return '흐르는 얕은 물은 뜰 수 없어요. 물이 솟는 자리를 뜨세요';
      this.dry(l, x, y);
      return '';
    }
    const gd = GROUND[w.ground(l, x, y)];
    if (!gd.water || gd.flow) return '물이 있는 곳에서 뜰 수 있어요';
    // 자연의 물: 둘레에 깊은 물이 둘 이상이면 곧바로 다시 차오른다. 외따로 있던 물은 떠내면 바닥이 드러난다
    let n = 0;
    for (const [dx, dy] of NB) { const g = GROUND[w.ground(l, x + dx, y + dy)]; if (g.water && !g.flow) n++; }
    if (n < 2) { w.setGround(l, x, y, l === CAVE ? G.CAVE : G.DIRT); this.wake(l, x, y); }
    return '';
  }

  // ── 흐름 ──
  update(dt) {
    this.acc += dt;
    if (this.acc < FLOW_TICK) return;
    this.acc = Math.min(this.acc - FLOW_TICK, FLOW_TICK);
    for (let l = 0; l < 2; l++) this.tick(l);
  }
  tick(l) {
    const w = this.game.world, q = w.flowQ[l], map = w.water[l], ground = w.layers[l].ground;
    if (!q.size) return;
    const list = [...q];
    q.clear();
    for (const i of list) {
      const e = map.get(i);
      if (!e) continue;                                    // 마른 칸과 자연의 물은 스스로 변하지 않는다
      const x = i % MAP_W, y = (i / MAP_W) | 0;
      if (!GROUND[ground[i]].water) { map.delete(i); this.wake(l, x, y); continue; }   // 그 사이에 누가 바닥을 깔았다
      let src = 0, best = Infinity;
      for (const [dx, dy] of NB) {
        const n = w.inb(x + dx, y + dy) ? map.get((y + dy) * MAP_W + x + dx) : null;
        if (!n) continue;
        if (n.lv === 0) src++;
        if (n.lv < best) best = n.lv;
      }
      if (e.lv > 0) {
        if (src >= 2) { e.lv = 0; w.setGround(l, x, y, G.WATER); this.wake(l, x, y); }      // 무한 물
        else if (best + 1 > FLOW_MAX) { this.dry(l, x, y); continue; }                       // 이어진 물이 끊겼다
        else if (best + 1 !== e.lv) { e.lv = best + 1; this.wake(l, x, y); }
      }
      if (e.lv >= FLOW_MAX) continue;
      for (const [dx, dy] of NB) {                         // 둘레로 번진다
        const nx = x + dx, ny = y + dy;
        if (!w.inb(nx, ny)) continue;
        const n = map.get(ny * MAP_W + nx);
        if (n) { if (n.lv > e.lv + 1) { n.lv = e.lv + 1; this.wake(l, nx, ny); } }
        else if (this.canHold(l, nx, ny)) this.enter(l, nx, ny, e.lv + 1);
      }
    }
  }
}
