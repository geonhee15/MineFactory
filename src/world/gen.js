// 월드 생성: 지상(섬 + 생물군계) / 지하(동굴 + 광맥)
import { MAP_W as W, MAP_H as H, SURFACE, CAVE } from '../config.js';
import { Noise, mulberry32, hash2, clamp } from '../rng.js';
import { G } from '../data/ground.js';
import { O, OBJ } from '../data/objects.js';

const N = W * H;

function percentiles(arr, mask, ps) {
  const s = [];
  for (let i = 0; i < arr.length; i += 5) if (!mask || mask[i]) s.push(arr[i]);
  s.sort((a, b) => a - b);
  return ps.map((p) => s[Math.min(s.length - 1, Math.floor(p * s.length))]);
}

export function generate(world) {
  genSurface(world);
  genCave(world);
  return world;
}

// ─────────────────────────────────────────────────────────────
function genSurface(world) {
  const seed = world.seed;
  const L = world.layers[SURFACE];
  const nE = new Noise(seed + 1), nM = new Noise(seed + 2), nT = new Noise(seed + 3);
  const nD = new Noise(seed + 4), nF = new Noise(seed + 5), nC = new Noise(seed + 6);

  const elev = new Float32Array(N), moist = new Float32Array(N), temp = new Float32Array(N);
  const inner = new Uint8Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    let e = nE.fbm(x / 92, y / 92, 5);
    // 섬: 맵 가장자리로 갈수록 바다로 가라앉는다 (해안선은 노이즈로 구불구불하게)
    const d = Math.min(x, W - 1 - x, y, H - 1 - y) + nC.fbm(x / 34, y / 34, 2) * 22;
    const edge = clamp(d / 44, 0, 1);
    if (edge >= 1) inner[i] = 1;
    e -= (1 - edge) * (1 - edge) * 1.25;
    elev[i] = e;
    moist[i] = nM.fbm(x / 120 + 31, y / 120 + 17, 4);
    temp[i] = nT.fbm(x / 170 + 71, y / 170 + 53, 3);
  }
  const [eDeep, eWater, eBeach, eRock] = percentiles(elev, inner, [0.07, 0.15, 0.185, 0.9]);
  const [mDry, mWet] = percentiles(moist, inner, [0.5, 0.6]);
  const [tHot] = percentiles(temp, inner, [0.76]);

  const biome = new Uint8Array(N); // 0 물, 1 해변, 2 초원, 3 숲, 4 사막, 5 바위지대
  for (let i = 0; i < N; i++) {
    const e = elev[i];
    if (e < eDeep) { L.ground[i] = G.DEEP; biome[i] = 0; }
    else if (e < eWater) { L.ground[i] = G.WATER; biome[i] = 0; }
    else if (e < eBeach) { L.ground[i] = G.SAND; biome[i] = 1; }
    else if (e > eRock) biome[i] = 5;
    else if (temp[i] > tHot && moist[i] < mDry) biome[i] = 4;
    else if (moist[i] > mWet) biome[i] = 3;
    else biome[i] = 2;
  }

  const hasTreeNear = (x, y) => {
    for (const [dx, dy] of [[-1, 0], [-1, -1], [0, -1], [1, -1]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W) continue;
      if (OBJ[L.obj[yy * W + xx]].tree) return true;
    }
    return false;
  };

  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, b = biome[i];
    if (b === 0) continue;
    const r = hash2(x, y, seed), r2 = hash2(x, y, seed + 977);
    const det = nD.fbm(x / 13, y / 13, 2);
    const fl = nF.fbm(x / 26, y / 26, 2);
    let o = O.NONE, m = 0;
    if (b === 1) {                      // 해변
      if (r < 0.01) o = O.PEBBLE; else if (r < 0.015) o = O.TWIG;
    } else if (b === 2) {               // 초원
      L.ground[i] = det > 0.3 ? G.DIRT : G.GRASS;
      const dirt = L.ground[i] === G.DIRT;
      const meadow = fl > 0.2;
      if (r < 0.022 && !hasTreeNear(x, y)) { o = r2 < 0.07 ? O.TREE_APPLE : r2 < 0.75 ? O.TREE_OAK : O.TREE_BIRCH; m = o === O.TREE_APPLE ? 1 : 0; }
      else if (dirt) { if (r < 0.05) o = O.PEBBLE; else if (r < 0.06) o = O.TWIG; }
      else if (r < 0.022 + (meadow ? 0.2 : 0.012)) o = [O.FLOWER_R, O.FLOWER_Y, O.FLOWER_B, O.FLOWER_W][(fl * 37 + r2 * 2.2) & 3];
      else if (r < 0.25 + (det > 0 ? 0.1 : 0) && r > 0.22) o = O.TALLGRASS;
      else if (r > 0.3 && r < 0.3 + (det < -0.1 ? 0.14 : 0.03)) o = O.TALLGRASS;
      else if (r > 0.5 && r < 0.511) { o = O.BUSH; m = 1; }
      else if (r > 0.6 && r < 0.606) o = O.WILD_CARROT;
      else if (r > 0.7 && r < 0.712) o = O.PEBBLE;
      else if (r > 0.8 && r < 0.807) o = O.TWIG;
      else if (r > 0.9 && r < 0.903) o = O.BOULDER;
    } else if (b === 3) {               // 숲
      L.ground[i] = det > 0.38 ? G.DIRT : G.GRASS;
      if (r < 0.17 && !hasTreeNear(x, y)) {
        const cold = temp[i] < -0.02;
        o = fl > 0.22 ? O.TREE_BIRCH : cold ? (r2 < 0.75 ? O.TREE_PINE : O.TREE_OAK) : (r2 < 0.78 ? O.TREE_OAK : r2 < 0.97 ? O.TREE_PINE : O.TREE_APPLE);
        m = o === O.TREE_APPLE ? 1 : 0;
      }
      else if (r > 0.3 && r < 0.38) o = O.TALLGRASS;
      else if (r > 0.4 && r < 0.412) o = O.MUSHROOM;
      else if (r > 0.5 && r < 0.53) o = O.TWIG;
      else if (r > 0.6 && r < 0.618) { o = O.BUSH; m = 1; }
      else if (r > 0.7 && r < 0.708) o = [O.FLOWER_R, O.FLOWER_Y, O.FLOWER_B, O.FLOWER_W][(r2 * 4) | 0];
      else if (r > 0.8 && r < 0.808) o = O.PEBBLE;
    } else if (b === 4) {               // 사막
      L.ground[i] = G.SAND;
      if (r < 0.018) o = O.CACTUS;
      else if (r < 0.032) o = O.DEADBUSH;
      else if (r < 0.044) o = O.PEBBLE;
      else if (r < 0.048) o = O.BOULDER;
    } else {                            // 바위 지대
      L.ground[i] = det > -0.12 ? G.STONE : (det > -0.3 ? G.DIRT : G.GRASS);
      if (r < 0.075) o = O.BOULDER;
      else if (r < 0.14) o = O.PEBBLE;
      else if (r < 0.165 && !hasTreeNear(x, y) && L.ground[i] !== G.STONE) o = O.TREE_PINE;
      else if (r < 0.19 && L.ground[i] === G.GRASS) o = O.TALLGRASS;
    }
    L.obj[i] = o; L.meta[i] = m;
  }

  // ── 시작 지점: 맵 중앙 근처의 탁 트인 초원 ──
  const cx = W >> 1, cy = H >> 1;
  let spawn = { x: cx, y: cy }, best = Infinity;
  for (let y = cy - 60; y <= cy + 60; y += 2) for (let x = cx - 60; x <= cx + 60; x += 2) {
    if (biome[y * W + x] !== 2) continue;
    let ok = true;
    for (let dy = -3; dy <= 3 && ok; dy++) for (let dx = -3; dx <= 3; dx++) {
      if (biome[(y + dy) * W + x + dx] === 0) { ok = false; break; }
    }
    if (!ok) continue;
    const d = (x - cx) ** 2 + (y - cy) ** 2;
    if (d < best) { best = d; spawn = { x, y }; }
  }
  if (best === Infinity) {              // 중앙에 초원이 없으면 가장 가까운 땅
    for (let rad = 0; rad < W / 2 && best === Infinity; rad += 2) {
      for (let a = 0; a < 40; a++) {
        const x = Math.round(cx + Math.cos(a / 40 * Math.PI * 2) * rad), y = Math.round(cy + Math.sin(a / 40 * Math.PI * 2) * rad);
        if (x > 2 && y > 2 && x < W - 2 && y < H - 2 && biome[y * W + x] > 1) { spawn = { x, y }; best = 0; break; }
      }
    }
  }
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const i = (spawn.y + dy) * W + spawn.x + dx;
    L.obj[i] = O.NONE; L.meta[i] = 0;
  }
  world.spawn = spawn;

  // ── 동굴 입구 ──
  const rnd = mulberry32(seed + 4242);
  const ents = [];
  const okSpot = (x, y) => {
    if (x < 26 || y < 26 || x >= W - 26 || y >= H - 26) return false;
    for (let dy = -2; dy <= 3; dy++) for (let dx = -2; dx <= 2; dx++) if (biome[(y + dy) * W + x + dx] < 2) return false;
    return true;
  };
  const far = (x, y, min) => ents.every((e) => (e.x - x) ** 2 + (e.y - y) ** 2 >= min * min);
  // 첫 입구는 시작 지점에서 걸어서 금방 닿는 곳에
  for (let t = 0; t < 400 && !ents.length; t++) {
    const a = rnd() * Math.PI * 2, d = 20 + rnd() * 18 + t * 0.1;
    const x = Math.round(spawn.x + Math.cos(a) * d), y = Math.round(spawn.y + Math.sin(a) * d);
    if (okSpot(x, y)) ents.push({ x, y });
  }
  for (let t = 0; t < 6000 && ents.length < 15; t++) {
    const x = 26 + ((rnd() * (W - 52)) | 0), y = 26 + ((rnd() * (H - 52)) | 0);
    if (!okSpot(x, y) || !far(x, y, 62)) continue;
    if (biome[y * W + x] !== 5 && rnd() > 0.3) continue;   // 바위 지대를 선호
    if ((x - spawn.x) ** 2 + (y - spawn.y) ** 2 < 12 * 12) continue;
    ents.push({ x, y });
  }
  for (const e of ents) {
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const x = e.x + dx, y = e.y + dy, i = y * W + x;
      const d = Math.hypot(dx, dy * 1.1) + hash2(x, y, seed + 5) * 0.9;
      if (d < 3.1) { L.obj[i] = O.NONE; L.meta[i] = 0; }
      if (d < 2.7) L.ground[i] = G.STONE;
      else if (d < 3.3 && L.ground[i] === G.GRASS) L.ground[i] = G.DIRT;
    }
    L.obj[e.y * W + e.x] = O.CAVE_IN;
    L.obj[(e.y - 1) * W + e.x - 2] = O.BOULDER;
    L.obj[(e.y) * W + e.x + 2] = O.PEBBLE;
  }
  world.entrances = ents;
}

// ─────────────────────────────────────────────────────────────
function genCave(world) {
  const seed = world.seed;
  const L = world.layers[CAVE];
  const nA = new Noise(seed + 11), nB = new Noise(seed + 12), nC = new Noise(seed + 13);
  const nR = new Noise(seed + 14), nW = new Noise(seed + 15);
  let open = new Uint8Array(N);
  const B = 3; // 기반암 테두리 두께

  for (let y = B; y < H - B; y++) for (let x = B; x < W - B; x++) {
    const a = nA.fbm(x / 42, y / 42, 3), b = nB.fbm(x / 30 + 100, y / 30, 3), c = nC.fbm(x / 28, y / 28, 2);
    if (Math.abs(a) < 0.03 || Math.abs(b) < 0.024 || c > 0.3) open[y * W + x] = 1;
  }
  // 자잘한 구멍/돌기 정리
  for (let pass = 0; pass < 2; pass++) {
    const nx = new Uint8Array(N);
    for (let y = B; y < H - B; y++) for (let x = B; x < W - B; x++) {
      let c = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && open[(y + dy) * W + x + dx]) c++;
      const i = y * W + x;
      nx[i] = c >= 5 ? 1 : c <= 2 ? 0 : open[i];
    }
    open = nx;
  }

  // 입구 아래 사다리 방 + 가장 가까운 동굴까지 통로
  const rnd = mulberry32(seed + 808);
  const room = new Uint8Array(N);
  const carve = (cx, cy, r, mark) => {
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < B || y < B || x >= W - B || y >= H - B) continue;
      if (dx * dx + dy * dy <= r * r) { open[y * W + x] = 1; if (mark) room[y * W + x] = 1; }
    }
  };
  for (const e of world.entrances) {
    // 방을 파기 전에, 방 바깥에서 가장 가까운 빈 칸을 찾아 둔다
    let target = null;
    for (let r = 6; r < 70 && !target; r++) {
      for (let k = 0; k < r * 8; k++) {
        const a = (k / (r * 8)) * Math.PI * 2;
        const x = Math.round(e.x + Math.cos(a) * r), y = Math.round(e.y + Math.sin(a) * r);
        if (x >= B && y >= B && x < W - B && y < H - B && open[y * W + x]) { target = { x, y }; break; }
      }
    }
    carve(e.x, e.y, 3.3, true);
    if (target) {
      let x = e.x, y = e.y;
      for (let s = 0; s < 300 && (Math.abs(x - target.x) > 1 || Math.abs(y - target.y) > 1); s++) {
        const dx = target.x - x, dy = target.y - y, len = Math.hypot(dx, dy) || 1;
        x += dx / len + (rnd() - 0.5) * 1.1; y += dy / len + (rnd() - 0.5) * 1.1;
        carve(Math.round(x), Math.round(y), 1.2 + rnd() * 0.5, false);
      }
    }
  }

  // 바닥과 벽 채우기
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const border = x < B || y < B || x >= W - B || y >= H - B;
    const gv = nW.fbm(x / 18, y / 18, 2);
    L.ground[i] = gv > 0.26 ? G.GRAVEL : G.CAVE;
    if (border) { L.obj[i] = O.BEDROCK; continue; }
    if (!open[i]) {
      const t = nR.fbm(x / 58, y / 58, 3);
      L.obj[i] = t > 0.11 ? O.ANDESITE : t < -0.15 ? O.GRANITE : O.ROCK;
      continue;
    }
    if (room[i]) continue;
    // 지하 호수
    if (nW.fbm(x / 22 + 50, y / 22 + 50, 2) < -0.36) { L.ground[i] = G.WATER; continue; }
    const r = hash2(x, y, seed + 31);
    let o = O.NONE;
    if (r < 0.016) o = O.STALAGMITE;
    else if (r < 0.04) o = O.PEBBLE;
    else if (r < 0.05) o = O.GLOWSHROOM;
    else if (r < 0.056) o = O.MUSHROOM;
    L.obj[i] = o;
  }

  // 광맥: 무작위 걸음으로 벽 속에 덩어리를 만든다
  const base = (o) => o === O.ROCK || o === O.ANDESITE || o === O.GRANITE;
  const veins = (type, count, minLen, maxLen) => {
    for (let n = 0; n < count; n++) {
      let x = B + 1 + ((rnd() * (W - 2 * B - 2)) | 0), y = B + 1 + ((rnd() * (H - 2 * B - 2)) | 0);
      const len = minLen + ((rnd() * (maxLen - minLen + 1)) | 0);
      for (let k = 0; k < len; k++) {
        const i = y * W + x;
        if (base(L.obj[i])) L.obj[i] = type;
        if (rnd() < 0.45) { const j = (y + ((rnd() * 3) | 0) - 1) * W + x + ((rnd() * 3) | 0) - 1; if (base(L.obj[j])) L.obj[j] = type; }
        x = clamp(x + ((rnd() * 3) | 0) - 1, B + 1, W - B - 2);
        y = clamp(y + ((rnd() * 3) | 0) - 1, B + 1, H - B - 2);
      }
    }
  };
  veins(O.COAL_ORE, 1150, 5, 12);
  veins(O.IRON_ORE, 760, 4, 9);
  veins(O.COPPER_ORE, 620, 4, 8);
  veins(O.GOLD_ORE, 180, 2, 5);

  // 수정: 벽 옆 빈 바닥에 드물게
  for (let n = 0; n < 2600; n++) {
    const x = B + 2 + ((rnd() * (W - 2 * B - 4)) | 0), y = B + 2 + ((rnd() * (H - 2 * B - 4)) | 0), i = y * W + x;
    if (!open[i] || room[i] || L.obj[i] !== O.NONE || L.ground[i] === G.WATER) continue;
    if (OBJ[L.obj[i - 1]].wall || OBJ[L.obj[i + 1]].wall || OBJ[L.obj[i - W]].wall) L.obj[i] = O.CRYSTAL;
  }

  for (const e of world.entrances) {
    L.obj[e.y * W + e.x] = O.LADDER;
    L.ground[e.y * W + e.x] = G.CAVE;
  }
}
