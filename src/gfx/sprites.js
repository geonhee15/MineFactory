// 모든 도트 그래픽을 코드로 그려 아틀라스에 담는다 (지형 · 벽 · 자연물 · 설치물)
import { Pix, Atlas, shade, mix } from './pix.js';
import { mulberry32, clamp } from '../rng.js';
import { buildItemSprites } from './sprites_items.js';
import { FLAG_COLORS } from '../data/objects.js';

export const K = 0x241a2b; // 기본 외곽선 색

export const PAL = {
  grass: { hi: 0x8fd45e, l: 0x7cc653, b: 0x62b246, d: 0x4c9a3d, dd: 0x3b8236 },
  dirt: { l: 0xb48152, b: 0x9c6b43, d: 0x855837, dd: 0x6d4529, p: 0xc79a6b },
  sand: { l: 0xf2e0a8, b: 0xe6cf8e, d: 0xd4b974, dd: 0xbd9f5e },
  water: { hi: 0xc9ecff, l: 0x6cb4e8, b: 0x3d8ed4, d: 0x2f78c0, dd: 0x2867ab },
  deep: { hi: 0x6cb4e8, l: 0x3f80c9, b: 0x2a66b3, d: 0x21559c, dd: 0x1b4786 },
  stone: { hi: 0xb9bec8, l: 0xa3a8b1, b: 0x8a8f99, d: 0x70757f, dd: 0x5a5e68, k: 0x44474f },
  cave: { l: 0x5d5564, b: 0x4d4654, d: 0x3f3946, dd: 0x322d38, p: 0x6e6676 },
  gravel: { l: 0x847d8c, b: 0x6a6470, d: 0x544f5a, dd: 0x433f48 },
  farm: { l: 0x86603e, b: 0x6e4a2e, d: 0x573823, dd: 0x452b1a },
  plank: { hi: 0xdab676, l: 0xcfa468, b: 0xb8894f, d: 0x96693a, dd: 0x6e4a28 },
  bark: { l: 0x96693f, b: 0x7a5536, d: 0x5a3d26, o: 0x3a2618 },
  birch: { l: 0xf3f0e6, b: 0xdcd8ca, d: 0xb5b0a2, o: 0x4a4550 },
  oak: { hi: 0x7fd05a, l: 0x58b548, b: 0x3f9a3e, d: 0x2e7b36, o: 0x1e5a2e },
  pine: { hi: 0x4fae78, l: 0x379462, b: 0x2a7a52, d: 0x1f6045, o: 0x14443a },
  birchLeaf: { hi: 0xc6e06a, l: 0xa3cf52, b: 0x7fb843, d: 0x5f9a3a, o: 0x3f7431 },
  apple: { hi: 0x8ed862, l: 0x66bf4e, b: 0x48a343, d: 0x34843a, o: 0x225f30 },
};

const ri = (r, n) => (r() * n) | 0;

// ── 지형 텍스처 ─────────────────────────────────────────────
function texGrass(seed) {
  const p = new Pix(16, 16), r = mulberry32(seed), g = PAL.grass;
  p.fill(g.b);
  for (let i = 0; i < 5; i++) { const x = ri(r, 15), y = ri(r, 16); p.set(x, y, g.d); p.set(x + 1, y, g.d); }
  for (let i = 0; i < 8; i++) { const x = ri(r, 16), y = ri(r, 15); p.set(x, y, g.l); p.set(x, y + 1, g.d); }
  for (let i = 0; i < 4; i++) p.set(ri(r, 16), ri(r, 16), g.l);
  if (seed % 3 === 0) { const x = 2 + ri(r, 12), y = 2 + ri(r, 12); p.set(x, y, g.hi); }
  return p;
}
function texDirt(seed) {
  const p = new Pix(16, 16), r = mulberry32(seed), g = PAL.dirt;
  p.fill(g.b);
  for (let i = 0; i < 7; i++) { const x = ri(r, 15), y = ri(r, 16); p.set(x, y, g.d); p.set(x + 1, y, g.d); }
  for (let i = 0; i < 5; i++) { const x = ri(r, 15), y = ri(r, 16); p.set(x, y, g.l); p.set(x + 1, y, g.l); }
  for (let i = 0; i < 3; i++) { const x = ri(r, 15), y = ri(r, 15); p.set(x, y, g.p); p.set(x, y + 1, g.dd); }
  return p;
}
function texSand(seed) {
  const p = new Pix(16, 16), r = mulberry32(seed), g = PAL.sand;
  p.fill(g.b);
  for (let i = 0; i < 4; i++) { const x = ri(r, 12), y = ri(r, 16), w = 2 + ri(r, 3); for (let k = 0; k < w; k++) p.set(x + k, y, g.d); }
  for (let i = 0; i < 6; i++) p.set(ri(r, 16), ri(r, 16), g.l);
  for (let i = 0; i < 3; i++) p.set(ri(r, 16), ri(r, 16), g.dd);
  return p;
}
function texWater(seed, frame, g) {
  const p = new Pix(16, 16), r = mulberry32(seed);
  p.fill(g.b);
  for (let i = 0; i < 4; i++) {
    const x = ri(r, 16), y = ri(r, 16), w = 3 + ri(r, 3), sp = r() < 0.5 ? 1 : -1;
    const off = frame * sp;
    for (let k = 0; k < w; k++) p.set((x + k + off + 32) % 16, y, g.d);
  }
  for (let i = 0; i < 3; i++) {
    const x = ri(r, 16), y = ri(r, 16), w = 2 + ri(r, 3), ph = ri(r, 4);
    const len = [w, w - 1, Math.max(1, w - 2), w - 1][(frame + ph) % 4];
    for (let k = 0; k < len; k++) p.set((x + k + frame) % 16, y, g.l);
  }
  const sx = ri(r, 16), sy = ri(r, 16), sp = ri(r, 4);
  if ((frame + sp) % 4 === 0) p.set(sx, sy, g.hi);
  return p;
}
function texStone(seed) {
  const p = new Pix(16, 16), r = mulberry32(seed), g = PAL.stone;
  p.fill(g.b);
  for (let i = 0; i < 4; i++) {
    const x = ri(r, 12), y = ri(r, 13), w = 3 + ri(r, 3), h = 2 + ri(r, 2);
    p.rect(x, y, w, h, g.l);
    for (let k = 0; k < w; k++) p.set(x + k, y + h, g.d);
  }
  for (let i = 0; i < 6; i++) p.set(ri(r, 16), ri(r, 16), g.d);
  for (let i = 0; i < 2; i++) { const x = ri(r, 13), y = ri(r, 13); p.line(x, y, x + 2, y + 2, g.dd); }
  return p;
}
function texCave(seed, g = PAL.cave) {
  const p = new Pix(16, 16), r = mulberry32(seed);
  p.fill(g.b);
  for (let i = 0; i < 6; i++) { const x = ri(r, 14), y = ri(r, 15); p.rect(x, y, 2 + ri(r, 2), 1, g.d); }
  for (let i = 0; i < 4; i++) { const x = ri(r, 15), y = ri(r, 15); p.set(x, y, g.l); p.set(x + 1, y, g.l); p.set(x, y + 1, g.dd); p.set(x + 1, y + 1, g.dd); }
  for (let i = 0; i < 3; i++) p.set(ri(r, 16), ri(r, 16), g.p ?? g.l);
  return p;
}
function texGravel(seed) {
  const p = new Pix(16, 16), r = mulberry32(seed), g = PAL.gravel;
  p.fill(g.d);
  for (let i = 0; i < 16; i++) {
    const x = ri(r, 15), y = ri(r, 15), c = r() < 0.5 ? g.b : g.l;
    p.set(x, y, c); p.set(x + 1, y, c); p.set(x, y + 1, g.b); p.set(x + 1, y + 1, g.dd);
  }
  return p;
}
function texFarm(seed) {
  const p = new Pix(16, 16), r = mulberry32(seed), g = PAL.farm;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const m = y % 4;
    let c = m === 0 ? g.dd : m === 1 ? g.d : m === 2 ? g.b : g.l;
    if (r() < 0.12) c = m < 2 ? g.d : g.b;
    p.set(x, y, c);
  }
  return p;
}
function texPlank(seed) {
  const p = new Pix(16, 16), r = mulberry32(seed), g = PAL.plank;
  for (let row = 0; row < 4; row++) {
    const base = [g.b, g.l, g.b, mix(g.b, g.d, 0.4)][(row + seed) % 4];
    const seam = (row * 7 + seed * 5) % 16;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 16; x++) {
      let c = base;
      if (y === 0) c = mix(base, g.hi, 0.35);
      if (y === 3) c = g.dd;
      else if (x === seam) c = g.d;
      else if (r() < 0.06) c = mix(base, g.d, 0.5);
      p.set(x, row * 4 + y, c);
    }
    p.set((seam + 1) % 16, row * 4 + 1, g.dd); p.set((seam + 15) % 16, row * 4 + 1, g.dd);
  }
  return p;
}

// 높은 우선순위 지형이 이웃 타일 위로 번지는 가장자리 조각
function addEdges(atlas, key, tex, rim, seed) {
  const put = (p, side, i, j, c, a = 255) => {
    if (side === 'N') p.set(i, j, c, a); else if (side === 'S') p.set(i, 15 - j, c, a);
    else if (side === 'W') p.set(j, i, c, a); else p.set(15 - j, i, c, a);
  };
  const at = (side, i, j) => (side === 'N' ? tex.get(i, j) : side === 'S' ? tex.get(i, 15 - j) : side === 'W' ? tex.get(j, i) : tex.get(15 - j, i));
  for (let v = 0; v < 2; v++) {
    const r = mulberry32(seed + v * 131);
    for (const side of ['N', 'E', 'S', 'W']) {
      const p = new Pix(16, 16);
      let d = 3;
      for (let i = 0; i < 16; i++) {
        if (i === 0 || i === 15) d = 3;
        else if (i % 2 === 0) d = clamp(d + ri(r, 3) - 1, 2, 4);
        if (i === 14 && d === 2) d = 3;
        for (let j = 0; j < d; j++) put(p, side, i, j, at(side, i, j));
        put(p, side, i, d, rim);
      }
      atlas.add(`${key}_e${side}${v}`, p);
    }
  }
  // 대각선 모서리 (둥근 1/4 원)
  for (const [name, fx, fy] of [['NW', 0, 0], ['NE', 1, 0], ['SW', 0, 1], ['SE', 1, 1]]) {
    const p = new Pix(16, 16);
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
      const d2 = i * i + j * j;
      const x = fx ? 15 - i : i, y = fy ? 15 - j : j;
      if (d2 <= 9) p.set(x, y, tex.get(x, y));
      else if (d2 <= 17) p.set(x, y, rim);
    }
    atlas.add(`${key}_c${name}`, p);
  }
}

// 물가 거품
function addFoam(atlas) {
  for (let f = 0; f < 2; f++) for (const side of ['N', 'E', 'S', 'W']) {
    const p = new Pix(16, 16), r = mulberry32(900 + f * 7 + side.charCodeAt(0));
    for (let i = 0; i < 16; i++) {
      if (r() < 0.3) continue;
      const j = 5 + f + (r() < 0.3 ? 1 : 0);
      const c = 0xdff4ff, a = 190;
      if (side === 'N') p.set(i, j, c, a); else if (side === 'S') p.set(i, 15 - j, c, a);
      else if (side === 'W') p.set(j, i, c, a); else p.set(15 - j, i, c, a);
    }
    atlas.add(`foam_${side}${f}`, p);
  }
}

// ── 벽 블록 (위로 솟은 16x22) ────────────────────────────────
function texRock(seed, g) {
  const p = new Pix(16, 16), r = mulberry32(seed);
  p.fill(g.b);
  for (let i = 0; i < 5; i++) {
    const x = ri(r, 12), y = ri(r, 13), w = 3 + ri(r, 3), h = 2 + ri(r, 2);
    p.rect(x, y, w, h, g.l);
    p.set(x, y, g.hi ?? g.l);
    for (let k = 0; k < w; k++) p.set(x + k, y + h, g.d);
    for (let k = 0; k < h; k++) p.set(x + w, y + k, g.d);
  }
  for (let i = 0; i < 7; i++) p.set(ri(r, 16), ri(r, 16), g.d);
  for (let i = 0; i < 3; i++) p.set(ri(r, 16), ri(r, 16), g.dd);
  return p;
}
function texSpeckle(seed, g) {
  const p = new Pix(16, 16), r = mulberry32(seed);
  p.fill(g.b);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const v = r();
    if (v < 0.17) p.set(x, y, g.l); else if (v < 0.33) p.set(x, y, g.d); else if (v < 0.37) p.set(x, y, g.dd);
  }
  return p;
}
function addOre(p, seed, o) {
  const r = mulberry32(seed);
  const cells = [[2, 2], [8, 1], [12, 5], [4, 7], [9, 9], [2, 12], [12, 12], [7, 5]];
  for (let i = cells.length - 1; i > 0; i--) { const j = ri(r, i + 1); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  for (let n = 0; n < 5; n++) {
    const [cx, cy] = cells[n];
    const x = cx + ri(r, 2), y = cy + ri(r, 2), w = 2 + ri(r, 2), h = 2;
    p.rect(x, y, w, h, o.b);
    p.set(x, y, o.l);
    p.set(x + w - 1, y + h - 1, o.d);
    if (r() < 0.6) p.set(x + w, y + 1, o.b);
    for (let k = 0; k < w; k++) p.tint(x + k, y + h, 0x000000, 0.35);
  }
  return p;
}
function wallFrom(top, front = top) {
  const p = new Pix(16, 22);
  p.blit(top, 0, 0);
  for (let y = 0; y < 6; y++) for (let x = 0; x < 16; x++) {
    const c = front.get(x, 10 + y);
    p.set(x, 16 + y, shade(c, y === 0 ? 0.82 : y === 5 ? 0.45 : 0.62));
  }
  return p;
}
function texBrick(seed) {
  const p = new Pix(16, 16), r = mulberry32(seed);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const row = y >> 2, off = row % 2 ? 4 : 0;
    const mortar = y % 4 === 3 || (x + off) % 8 === 7;
    let c = mortar ? 0x5f646e : 0x9aa0aa;
    if (!mortar && y % 4 === 0) c = 0xb4b9c2;
    if (!mortar && r() < 0.1) c = 0x878d97;
    p.set(x, y, c);
  }
  return p;
}
function texWoodWall() {
  const p = new Pix(16, 16), g = PAL.plank;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const m = x % 4;
    p.set(x, y, m === 3 ? g.dd : m === 0 ? g.l : (x * 3 + y * 5) % 11 === 0 ? g.d : g.b);
  }
  p.rect(0, 0, 16, 1, g.hi); p.rect(0, 15, 16, 1, g.d);
  return p;
}

// ── 나무 ───────────────────────────────────────────────────
function trunk(p, x, y, w, h, g) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const c = i === 0 || i === w - 1 ? g.o : i === 1 ? g.l : i >= w - 2 ? g.d : g.b;
    p.set(x + i, y + j, c);
  }
  p.set(x - 1, y + h - 1, g.o); p.set(x + w, y + h - 1, g.o);
  p.set(x - 1, y + h - 2, g.o); p.set(x + w, y + h - 2, g.o);
  p.set(x, y + h - 1, g.d); p.set(x + w - 1, y + h - 1, g.d);
  for (let i = 0; i < w; i++) p.set(x + i, y + h, g.o);
}
function canopy(p, blobs, g, r) {
  const inside = (x, y) => blobs.some(([cx, cy, rad]) => (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad + rad * 0.6);
  for (const [cx, cy, rad] of blobs) {
    for (let y = Math.floor(cy - rad - 1); y <= cy + rad + 1; y++) for (let x = Math.floor(cx - rad - 1); x <= cx + rad + 1; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy > rad * rad + rad * 0.6) continue;
      let v = (dx * -0.55 + dy * -0.85) / rad + (r() - 0.5) * 0.45;
      p.set(x, y, v > 0.62 ? g.hi : v > 0.12 ? g.l : v > -0.5 ? g.b : g.d);
    }
  }
  // 잎 뭉치 사이 그늘
  for (let n = 0; n < 12; n++) {
    const [cx, cy, rad] = blobs[ri(r, blobs.length)];
    const x = Math.round(cx + (r() - 0.5) * rad * 1.4), y = Math.round(cy + (r() - 0.2) * rad);
    if (inside(x - 2, y) && inside(x + 2, y) && inside(x, y + 2)) { p.set(x - 1, y, g.d); p.set(x, y + 1, g.d); p.set(x + 1, y, g.d); p.set(x, y - 1, g.l); }
  }
  // 안쪽 외곽선
  const edge = [];
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    if (!inside(x, y)) continue;
    if (!inside(x + 1, y) || !inside(x - 1, y) || !inside(x, y + 1) || !inside(x, y - 1)) edge.push(x, y);
  }
  for (let i = 0; i < edge.length; i += 2) p.set(edge[i], edge[i + 1], g.o);
}
function treeRound(seed, leaf, bark, fruit = false) {
  const p = new Pix(32, 40), r = mulberry32(seed);
  p.ellipse(16, 36.5, 10, 3, 0x000000, 60);
  trunk(p, 13, 23, 6, 15, bark);
  const j = () => ri(r, 3) - 1;
  canopy(p, [[16, 19, 7], [9 + j(), 16, 6], [23 + j(), 16, 6], [16, 13, 10], [11 + j(), 9 + j(), 6], [21 + j(), 9 + j(), 6], [16 + j(), 7, 6]], leaf, r);
  if (fruit) {
    for (const [x, y] of [[9, 12], [15, 8], [22, 11], [12, 19], [20, 18], [25, 16], [17, 14]]) {
      p.set(x, y, 0xe03c3c); p.set(x + 1, y, 0xc22f36); p.set(x, y + 1, 0xc22f36); p.set(x + 1, y + 1, 0x9a2430); p.set(x, y, 0xff8a7a);
    }
  }
  return p;
}
function treePine(seed) {
  const p = new Pix(24, 44), r = mulberry32(seed), g = PAL.pine;
  p.ellipse(12, 40.5, 8, 2.5, 0x000000, 60);
  trunk(p, 10, 33, 4, 9, PAL.bark);
  const tiers = [[3, 2, 9, 5], [10, 3, 11, 7], [18, 4, 12, 9], [26, 5, 11, 10]]; // yTop, 시작 반폭, 높이, 끝 반폭
  for (let t = tiers.length - 1; t >= 0; t--) {
    const [y0, w0, h, w1] = tiers[t];
    for (let j = 0; j < h; j++) {
      const hw = Math.round(w0 * 0.3 + (w1 - w0 * 0.3) * (j / (h - 1)));
      for (let i = -hw; i <= hw; i++) {
        const x = 12 + i, y = y0 + j;
        if (j === h - 1 && (i + t) % 3 === 0 && Math.abs(i) < hw) continue; // 들쭉날쭉한 아랫단
        const v = -i / (hw + 1) + (r() - 0.5) * 0.5 - (j / h) * 0.3;
        let c = v > 0.45 ? g.hi : v > 0 ? g.l : v > -0.55 ? g.b : g.d;
        if (Math.abs(i) === hw || j === h - 1) c = g.o;
        p.set(x, y, c);
      }
    }
  }
  p.set(12, 2, g.o); p.set(12, 3, g.l);
  return p;
}

// ── 작은 자연물 ─────────────────────────────────────────────
function bush(seed, berries) {
  const p = new Pix(16, 16), r = mulberry32(seed);
  p.ellipse(8, 14, 7, 2, 0x000000, 50);
  canopy(p, [[8, 9, 5], [4, 10, 4], [12, 10, 4], [8, 6, 4]], PAL.oak, r);
  if (berries) for (const [x, y] of [[4, 8], [8, 5], [11, 8], [7, 11], [12, 12], [3, 12]]) { p.set(x, y, 0xe8455a); p.set(x + 1, y, 0xb82f4a); p.set(x, y + 1, 0xb82f4a); p.set(x, y, 0xff9aa5); }
  return p;
}
function flowerSprite(seed, petal, center, kind) {
  const p = new Pix(16, 16), r = mulberry32(seed);
  const spots = seed % 2 ? [[4, 12], [11, 14], [8, 8]] : [[5, 9], [11, 11], [7, 14]];
  for (const [x, y] of spots) {
    const h = 3 + ri(r, 2);
    for (let k = 0; k < h; k++) p.set(x, y - k, 0x3b8236);
    p.set(x + (r() < 0.5 ? 1 : -1), y - 1, 0x4c9a3d);
    const hy = y - h;
    if (kind === 'tulip') {
      p.set(x - 1, hy, petal); p.set(x, hy, shade(petal, 0.8)); p.set(x + 1, hy, petal);
      p.set(x - 1, hy - 1, petal); p.set(x, hy - 1, petal); p.set(x + 1, hy - 1, petal);
      p.set(x - 1, hy - 2, shade(petal, 1.2)); p.set(x + 1, hy - 2, shade(petal, 1.2));
    } else if (kind === 'puff') {
      p.rect(x - 1, hy - 1, 3, 2, petal); p.set(x, hy - 2, petal); p.set(x - 1, hy - 1, shade(petal, 1.15)); p.set(x + 1, hy, shade(petal, 0.8));
    } else {
      p.set(x, hy - 2, petal); p.set(x - 1, hy - 1, petal); p.set(x + 1, hy - 1, petal); p.set(x, hy, petal);
      p.set(x, hy - 1, center);
    }
  }
  return p;
}
function tallGrass(seed) {
  const p = new Pix(16, 16), r = mulberry32(seed), g = PAL.grass;
  for (let x = 1; x < 15; x += 1 + ri(r, 2)) {
    const h = 4 + ri(r, 6), lean = ri(r, 3) - 1;
    for (let k = 0; k < h; k++) {
      const xx = x + (k > h * 0.6 ? lean : 0);
      p.set(xx, 15 - k, k === h - 1 ? g.hi : k > h / 2 ? g.l : g.d);
    }
    p.set(x, 15, g.dd);
  }
  return p;
}
function rockBlob(p, cx, cy, rx, ry, g, r) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const dx = (x - cx) / rx, dy = (y - cy) / ry;
    if (dx * dx + dy * dy > 1) continue;
    const v = -dx * 0.5 - dy * 0.9 + (r() - 0.5) * 0.3;
    p.set(x, y, v > 0.55 ? g.hi : v > 0.1 ? g.l : v > -0.45 ? g.b : g.d);
  }
}
function pebble(seed) {
  const p = new Pix(16, 16), r = mulberry32(seed);
  rockBlob(p, 7, 11, 3.2, 2.2, PAL.stone, r);
  if (seed % 2) rockBlob(p, 11.5, 12.5, 2, 1.5, PAL.stone, r);
  p.outline(PAL.stone.k);
  return p;
}
function boulder(seed) {
  const p = new Pix(16, 18), r = mulberry32(seed);
  p.ellipse(8, 15.5, 7, 2, 0x000000, 60);
  rockBlob(p, 8, 9.5, 6.4, 5.6, PAL.stone, r);
  rockBlob(p, 4.5, 12, 3, 2.6, PAL.stone, r);
  if (seed % 2) rockBlob(p, 12, 12.5, 2.6, 2.2, PAL.stone, r);
  p.line(7, 6, 9, 9, PAL.stone.d); p.line(9, 9, 8, 12, PAL.stone.d);
  p.outline(PAL.stone.k);
  return p;
}
function twig(seed) {
  const p = new Pix(16, 16), b = PAL.bark;
  if (seed % 2) { p.line(3, 13, 12, 8, b.b); p.line(7, 11, 9, 13, b.b); p.line(9, 10, 8, 7, b.b); p.set(4, 12, b.l); p.set(8, 10, b.l); }
  else { p.line(4, 8, 12, 13, b.b); p.line(8, 10, 11, 8, b.b); p.set(5, 9, b.l); p.set(9, 11, b.l); }
  p.outline(b.o);
  return p;
}
function wildCarrot() {
  const p = new Pix(16, 16), g = PAL.grass;
  for (const [x, h, l] of [[5, 6, -1], [7, 8, 0], [9, 7, 1], [11, 5, 1], [6, 4, -1]]) {
    for (let k = 0; k < h; k++) p.set(x + (k > 3 ? l : 0), 13 - k, k % 2 ? g.l : g.d);
    p.set(x + l, 13 - h, g.hi);
  }
  p.rect(7, 13, 3, 1, 0xf08a2e); p.set(8, 14, 0xd06a1e);
  p.outline(g.dd);
  return p;
}
function mushroom(seed, cap = 0xd9583b, capL = 0xf07a5a, dot = 0xfff1e0) {
  const p = new Pix(16, 16);
  const draw = (x, y, s) => {
    p.rect(x - 1, y - 2, 2 + (s > 1 ? 1 : 0), 3, 0xf2e6d0);
    p.set(x + (s > 1 ? 1 : 0), y, 0xcdbfa6);
    p.ellipse(x + (s > 1 ? 0 : -0.5), y - 4, 2 + s, 1.6 + s * 0.4, cap);
    p.set(x - 1, y - 5, capL); p.set(x, y - 5, capL);
    p.set(x - 2, y - 4, dot); p.set(x + 1, y - 5, dot); if (s > 1) p.set(x + 2, y - 3, dot);
  };
  if (seed % 2) { draw(6, 13, 2); draw(11, 14, 1); } else { draw(9, 13, 2); draw(4, 14, 1); }
  p.outline(K);
  return p;
}
function cactus(seed) {
  const p = new Pix(16, 22), c = { l: 0x7fcf6e, b: 0x4d9b52, d: 0x34753f };
  p.ellipse(8, 20, 6, 1.6, 0x000000, 55);
  const col = (x, y0, y1) => { for (let y = y0; y <= y1; y++) { p.set(x, y, c.l); p.set(x + 1, y, c.b); p.set(x + 2, y, c.b); p.set(x + 3, y, c.d); } };
  col(6, 3, 19);
  p.set(7, 2, c.l); p.set(8, 2, c.b);
  if (seed % 2) { p.rect(2, 9, 4, 2, c.b); p.rect(2, 6, 2, 4, c.b); p.set(2, 6, c.l); p.set(2, 7, c.l); p.rect(10, 12, 4, 2, c.b); p.rect(12, 8, 2, 5, c.b); p.set(13, 8, c.d); p.set(13, 9, c.d); }
  else { p.rect(10, 8, 4, 2, c.b); p.rect(12, 5, 2, 4, c.b); p.set(13, 5, c.d); p.rect(3, 12, 3, 2, c.b); p.rect(3, 10, 2, 3, c.b); p.set(3, 10, c.l); }
  for (let y = 4; y < 19; y += 3) { p.set(7, y, 0xe8f5c8); p.set(9, y + 1, 0x2a5f35); }
  if (seed % 2) p.set(7, 1, 0xff8fb0), p.set(8, 1, 0xff5f93);
  p.outline(0x1f4a2b);
  return p;
}
function deadBush() {
  const p = new Pix(16, 16), b = { b: 0x9a7650, l: 0xb8946a };
  p.line(8, 15, 8, 9, b.b); p.line(8, 11, 4, 6, b.b); p.line(8, 10, 12, 5, b.b); p.line(6, 8, 3, 9, b.b); p.line(10, 7, 13, 8, b.b); p.line(8, 9, 8, 5, b.l); p.line(5, 7, 5, 4, b.l);
  p.outline(0x5a3d26);
  return p;
}
function caveEntrance() {
  const p = new Pix(32, 30), r = mulberry32(77), g = PAL.stone;
  p.ellipse(16, 27, 15, 3, 0x000000, 60);
  rockBlob(p, 16, 16, 14.5, 12.5, g, r);
  rockBlob(p, 5, 22, 5, 5.5, g, r); rockBlob(p, 27, 22, 5, 5.5, g, r);
  rockBlob(p, 10, 8, 6, 5, g, r); rockBlob(p, 22, 8, 6, 5, g, r);
  p.line(6, 12, 9, 16, g.d); p.line(24, 11, 22, 15, g.d); p.line(15, 3, 17, 6, g.d);
  // 어두운 구멍
  for (let y = 12; y < 28; y++) for (let x = 9; x < 23; x++) {
    const dx = (x - 15.5) / 6.5, dy = (y - 20) / 8.5;
    if (dx * dx + dy * dy <= 1 || (y >= 20 && Math.abs(dx) <= 1)) {
      const depth = clamp((y - 12) / 15, 0, 1);
      p.set(x, y, mix(0x0b0810, 0x2a2233, depth * 0.8));
    }
  }
  for (let y = 12; y < 28; y++) for (let x = 8; x < 24; x++) {       // 구멍 테두리
    const c = p.get(x, y);
    const dark = (v) => v >= 0 && ((v >> 16) & 255) < 0x30;
    if (!dark(c) && (dark(p.get(x + 1, y)) || dark(p.get(x - 1, y)) || dark(p.get(x, y + 1)))) p.set(x, y, g.k);
  }
  p.rect(10, 27, 12, 1, 0x3f3946); p.rect(12, 28, 8, 1, 0x4d4654);
  p.set(4, 17, 0x4c9a3d); p.set(5, 16, 0x62b246); p.set(27, 16, 0x4c9a3d); p.set(26, 17, 0x62b246); p.set(12, 4, 0x62b246); p.set(13, 3, 0x4c9a3d);
  p.outline(g.k);
  return p;
}
function ladder() {
  const p = new Pix(16, 30), b = PAL.plank;
  p.ellipse(8, 27, 7, 2.4, 0xfff3c0, 70);
  for (let y = 0; y < 28; y++) {
    const a = y < 8 ? Math.round(255 * (y / 8)) : 255;
    p.set(4, y, b.d, a); p.set(5, y, b.l, a); p.set(10, y, b.b, a); p.set(11, y, b.d, a);
    if (y % 5 === 3) for (let x = 6; x < 10; x++) { p.set(x, y, b.l, a); p.set(x, y + 1, b.dd, a); }
  }
  return p;
}
function stalagmite(seed) {
  const p = new Pix(16, 20), r = mulberry32(seed), g = PAL.stone;
  p.ellipse(8, 18, 6, 1.6, 0x000000, 60);
  const cone = (cx, base, h, w) => {
    for (let j = 0; j < h; j++) {
      const hw = Math.max(0, Math.round((w * (j + 1)) / h / 2));
      for (let i = -hw; i <= hw; i++) p.set(cx + i, base - h + j + 1, i < -hw * 0.3 ? g.l : i > hw * 0.4 ? g.d : g.b);
    }
    p.set(cx, base - h + 1, g.hi);
  };
  cone(8, 17, 13 + ri(r, 3), 8);
  cone(seed % 2 ? 12 : 4, 17, 6 + ri(r, 2), 5);
  p.outline(g.k);
  return p;
}
function glowshroom(seed) {
  const p = mushroom(seed, 0x3fc7b8, 0xb8fff2, 0xe6fffb);
  p.map((c) => (c === 0xf2e6d0 ? 0xc8f2ea : c === 0xcdbfa6 ? 0x8fd6c8 : c === K ? 0x1c4a50 : c));
  return p;
}
function crystal(seed) {
  const p = new Pix(16, 20), c = { hi: 0xf2fbff, l: 0xbfe6ff, b: 0x86c4f5, d: 0x5a9be0, o: 0x2f5aa0 };
  p.ellipse(8, 18, 6, 1.6, 0x000000, 60);
  const shard = (x, top, bot, w) => {
    for (let y = top; y <= bot; y++) {
      const t = Math.min(1, (y - top) / 3), hw = Math.round((w / 2) * t);
      for (let i = -hw; i <= hw; i++) p.set(x + i, y, i < 0 ? c.l : i === 0 ? c.b : c.d);
    }
    p.set(x, top, c.hi); p.set(x - 1, top + 3, c.hi);
  };
  shard(8, 2, 17, 5); shard(seed % 2 ? 4 : 12, 8, 17, 3); shard(seed % 2 ? 12 : 4, 11, 17, 3);
  p.outline(c.o);
  return p;
}

// ── 설치물 ─────────────────────────────────────────────────
function workbench() {
  const p = new Pix(16, 20), g = PAL.plank;
  p.ellipse(8, 18.5, 7.5, 1.5, 0x000000, 55);
  p.rect(1, 4, 14, 7, g.l);                      // 상판
  p.rect(1, 4, 14, 1, g.hi);
  for (let x = 4; x < 15; x += 4) p.rect(x, 5, 1, 6, g.b);
  p.rect(1, 11, 14, 3, g.d); p.rect(1, 11, 14, 1, g.b);   // 앞판
  p.rect(1, 14, 3, 5, g.d); p.rect(12, 14, 3, 5, g.d);     // 다리
  p.rect(2, 14, 1, 5, g.b); p.rect(13, 14, 1, 5, g.b);
  p.rect(4, 15, 8, 1, g.dd);
  // 망치와 톱
  p.rect(3, 6, 3, 2, 0x8a8f99); p.set(3, 6, 0xb9bec8); p.rect(4, 8, 1, 2, 0x7a5536);
  p.rect(8, 7, 5, 1, 0xb9bec8); p.rect(8, 8, 5, 1, 0x70757f); p.rect(12, 6, 2, 3, 0x7a5536);
  p.outline(K);
  return p;
}
function furnace(lit, frame = 0) {
  const p = new Pix(16, 20), g = PAL.stone;
  p.ellipse(8, 18.5, 7.5, 1.5, 0x000000, 55);
  p.rect(1, 3, 14, 5, g.l); p.rect(1, 3, 14, 1, g.hi);      // 윗면
  p.rect(5, 4, 6, 3, g.dd); p.rect(6, 5, 4, 1, lit ? 0xff9a3a : 0x2a2a30);
  p.rect(1, 8, 14, 11, g.b);                                 // 앞면
  for (let y = 8; y < 19; y += 4) for (let x = 1; x < 15; x++) p.set(x, y, g.d);
  for (let y = 8; y < 19; y++) { const off = ((y - 8) >> 2) % 2 ? 4 : 0; for (let x = 1 + off; x < 15; x += 8) p.set(x, y, g.d); }
  p.rect(4, 11, 8, 6, g.k); p.rect(5, 10, 6, 1, g.k);       // 아궁이
  if (lit) {
    p.rect(5, 12, 6, 5, 0xd9461e); p.rect(6, 13, 4, 4, 0xff8a2a); p.rect(7, 14 + (frame % 2), 2, 3 - (frame % 2), 0xffd95a);
    p.set(5 + frame * 2, 12, 0xff8a2a); p.set(10 - frame, 11, 0xd9461e);
  } else { p.rect(5, 12, 6, 5, 0x1c1a20); p.rect(6, 15, 4, 2, 0x35323a); }
  p.outline(K);
  return p;
}
function chest() {
  const p = new Pix(16, 18), g = PAL.plank;
  p.ellipse(8, 16.5, 7.5, 1.5, 0x000000, 55);
  p.rect(1, 3, 14, 5, g.l); p.rect(1, 3, 14, 1, g.hi); p.rect(1, 7, 14, 1, g.d);   // 뚜껑
  p.rect(1, 8, 14, 9, g.b); p.rect(1, 16, 14, 1, g.d);
  for (let x = 5; x < 15; x += 5) p.rect(x, 9, 1, 7, g.d);
  p.rect(1, 3, 2, 14, 0x70757f); p.rect(13, 3, 2, 14, 0x70757f); p.rect(1, 3, 1, 14, 0xa3a8b1); p.rect(13, 3, 1, 14, 0xa3a8b1);
  p.rect(1, 8, 14, 1, 0x5a5e68);
  p.rect(7, 7, 2, 4, 0xf2c53d); p.set(7, 7, 0xfff1a0); p.set(8, 10, 0xb98a1e);
  p.outline(K);
  return p;
}
function torch(frame) {
  const p = new Pix(16, 20), b = PAL.bark;
  p.ellipse(8, 18.5, 3, 1.2, 0x000000, 60);
  p.rect(7, 9, 2, 10, b.b); p.rect(7, 9, 1, 10, b.l); p.rect(6, 8, 4, 2, b.d);
  const f = [[0, 0], [1, -1], [-1, 0]][frame];
  p.ellipse(8 + f[0] * 0.5, 5, 2.6, 3.4, 0xe2541e);
  p.ellipse(8, 5.6, 1.8, 2.5, 0xff9a2a);
  p.ellipse(8, 6.4, 1, 1.5, 0xffe27a);
  p.set(8 + f[0], 1 + (frame === 1 ? 0 : 1), 0xe2541e);
  p.set(8 - f[0], 0 + frame, 0xff9a2a, 180);
  p.outline(K);
  return p;
}
function door(open) {
  const p = new Pix(16, 24), g = PAL.plank;
  if (!open) {
    p.rect(1, 2, 14, 21, g.b);
    for (let x = 1; x < 15; x++) p.set(x, 2, g.hi);
    for (const x of [5, 10]) p.rect(x, 3, 1, 20, g.d);
    p.rect(1, 7, 14, 2, 0x70757f); p.rect(1, 17, 14, 2, 0x70757f); p.rect(1, 7, 14, 1, 0xa3a8b1); p.rect(1, 17, 14, 1, 0xa3a8b1);
    p.rect(11, 12, 2, 2, 0xf2c53d); p.set(11, 12, 0xfff1a0);
    p.rect(1, 22, 14, 1, g.dd);
  } else {
    p.rect(1, 2, 3, 21, g.b); p.rect(1, 2, 1, 21, g.l); p.rect(3, 2, 1, 21, g.d);
    p.rect(1, 7, 3, 2, 0x70757f); p.rect(1, 17, 3, 2, 0x70757f);
    p.rect(12, 2, 3, 21, g.d); p.rect(12, 2, 1, 21, g.b); p.rect(4, 2, 8, 1, g.d);
  }
  p.outline(K);
  return p;
}
function bed() {
  const p = new Pix(16, 30), g = PAL.plank;
  p.ellipse(8, 28.5, 7.5, 1.5, 0x000000, 55);
  p.rect(1, 2, 14, 4, g.d); p.rect(1, 2, 14, 1, g.l);                 // 머리판
  p.rect(1, 6, 14, 20, 0xf2efe6);                                     // 매트리스
  p.rect(3, 7, 10, 5, 0xffffff); p.rect(3, 11, 10, 1, 0xd8d4c8);       // 베개
  p.rect(1, 13, 14, 13, 0xd9583b); p.rect(1, 13, 14, 2, 0xf07a5a);     // 이불
  for (let y = 16; y < 26; y += 3) p.rect(1, y, 14, 1, 0xb04430);
  p.rect(1, 26, 14, 3, g.b); p.rect(1, 26, 14, 1, g.l); p.rect(1, 28, 14, 1, g.dd);
  p.outline(K);
  return p;
}
function sapling(kind) {
  const p = new Pix(16, 16);
  const leaf = [PAL.oak, PAL.pine, PAL.birchLeaf, PAL.apple][kind];
  p.rect(8, 10, 1, 5, kind === 2 ? PAL.birch.b : PAL.bark.b);
  if (kind === 1) { for (let j = 0; j < 7; j++) { const hw = (j / 2) | 0; for (let i = -hw; i <= hw; i++) p.set(8 + i, 4 + j, i < 0 ? leaf.l : leaf.b); } }
  else { p.ellipse(8, 7, 3.4, 3, leaf.b); p.ellipse(7, 6, 2, 1.6, leaf.l); p.set(6, 5, leaf.hi); p.set(10, 9, leaf.d); p.set(9, 9, leaf.d); }
  if (kind === 3) p.set(10, 7, 0xe03c3c);
  p.outline(leaf.o);
  p.set(7, 15, 0x6d4529); p.set(9, 15, 0x6d4529);
  return p;
}
function wheat(stage) {
  const p = new Pix(16, 18), g = PAL.grass;
  const xs = [2, 5, 8, 11, 13];
  if (stage === 0) { for (const x of [3, 7, 11]) { p.set(x, 16, 0xd9c08a); p.set(x + 1, 15, 0x7cc653); } return p; }
  for (let n = 0; n < xs.length; n++) {
    const x = xs[n], h = [0, 4, 8, 11][stage] + (n % 2);
    const stem = stage === 3 ? 0xc9a23a : stage === 2 ? g.b : g.l;
    for (let k = 0; k < h; k++) p.set(x + (k > h - 3 && n % 2 ? 1 : 0), 17 - k, k % 3 === 2 ? shade(stem, 0.85) : stem);
    if (stage >= 2) {
      const top = 17 - h, hx = x + (n % 2 ? 1 : 0), c = stage === 3 ? 0xf2cf52 : 0x9fcf5a, c2 = stage === 3 ? 0xd9a82e : 0x7ab548;
      p.set(hx, top, c); p.set(hx, top - 1, c); p.set(hx - 1, top, c2); p.set(hx + 1, top - 1, c2); p.set(hx, top - 2, c2);
      if (stage === 3) { p.set(hx, top - 3, 0xfff1a0); p.set(hx - 1, top - 2, c); }
    }
  }
  return p;
}
function carrotCrop(stage) {
  const p = new Pix(16, 18), g = PAL.grass;
  if (stage === 0) { for (const x of [4, 8, 12]) { p.set(x, 16, 0xd9c08a); p.set(x, 15, 0x7cc653); } return p; }
  for (const x of [4, 9, 13]) {
    const h = [0, 3, 5, 7][stage];
    for (let k = 0; k < h; k++) { p.set(x, 15 - k, g.b); if (k > 0) { p.set(x - 1 - (k > 3 ? 1 : 0), 15 - k, g.l); p.set(x + 1 + (k > 4 ? 1 : 0), 15 - k, g.d); } }
    p.set(x, 15 - h, g.hi);
    if (stage === 3) { p.rect(x - 1, 16, 3, 1, 0xf08a2e); p.set(x, 17, 0xd06a1e); p.set(x - 1, 16, 0xffb05a); }
  }
  return p;
}

// ── 지붕 · 깃발 ─────────────────────────────────────────────
const ROOF = { hi: 0xd68060, l: 0xc4664a, b: 0xa8503a, d: 0x86392c, dd: 0x6a2a22 };
function texRoof(seed) {
  const p = new Pix(16, 16), r = mulberry32(seed);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const row = y >> 2, ly = y & 3, lx = (x + (row % 2 ? 2 : 0)) & 3;       // 4x4 기와가 한 줄씩 엇갈린다
    let c = ly === 0 ? ROOF.l : ly === 3 ? ROOF.dd : ROOF.b;
    if (lx === 3 && ly !== 3) c = ROOF.d;
    if (ly === 0 && lx === 0) c = ROOF.hi;
    if (ly === 2 && lx < 3 && r() < 0.14) c = ROOF.d;
    p.set(x, y, c);
  }
  return p;
}
function flagSprite(color, frame) {
  const p = new Pix(16, 26), l = shade(color, 1.22), d = shade(color, 0.72);
  for (let cx = 0; cx < 10; cx++) {
    const ph = (cx / 9) * Math.PI * 1.6 - frame * 2.1;
    const yo = Math.round(Math.sin(ph) * (cx / 9) * 1.6), sh = Math.cos(ph);
    for (let cy = 0; cy < 7; cy++) p.set(6 + cx, 3 + cy + yo, cy === 6 ? d : sh > 0.45 ? l : sh < -0.45 ? d : color);
  }
  for (let y = 2; y < 25; y++) { p.set(4, y, 0xf0f0f5); p.set(5, y, 0x9aa0aa); }
  p.set(4, 1, 0xfff1a0); p.set(5, 1, 0xf2c53d);
  p.outline(K);
  const out = new Pix(16, 26);
  out.ellipse(4.5, 24.2, 4, 1.4, 0x000000, 60);
  return out.blit(p);
}

// ── 오버레이 ───────────────────────────────────────────────
function crackSprite(stage) {
  const p = new Pix(16, 16);
  const segs = [
    [8, 8, 6, 5], [6, 5, 4, 5], [8, 8, 11, 10], [11, 10, 13, 9],
    [8, 8, 9, 4], [9, 4, 11, 2], [8, 8, 5, 11], [5, 11, 5, 14],
    [6, 5, 5, 2], [11, 10, 12, 13], [9, 4, 7, 1], [5, 11, 2, 11], [13, 9, 15, 10], [4, 5, 1, 6],
  ];
  const n = [3, 6, 10, 14][stage];
  for (let i = 0; i < n; i++) { const [a, b, c, d] = segs[i]; p.line(a, b, c, d, 0x000000, 170); }
  return p;
}

// ─────────────────────────────────────────────────────────────
export function buildSprites() {
  const atlas = new Atlas(1024, 1024);
  const A = (n, p, ox = 0, oy = 0) => atlas.add(n, p, ox, oy);
  // 타일 아래 가운데 정렬: 스프라이트 바닥이 타일 바닥에 닿도록
  const anchored = (n, p) => A(n, p, Math.round((16 - p.w) / 2), 16 - p.h);

  // 지형
  const texs = {};
  const ground = (key, n, fn) => { for (let v = 0; v < n; v++) { const t = fn(v); if (v === 0) texs[key] = t; A(`${key}_${v}`, t); } };
  ground('g_grass', 4, (v) => texGrass(101 + v * 3));
  ground('g_dirt', 3, (v) => texDirt(201 + v));
  ground('g_sand', 3, (v) => texSand(301 + v));
  ground('g_stone', 3, (v) => texStone(401 + v));
  ground('g_farm', 2, (v) => texFarm(501 + v));
  ground('g_cave', 4, (v) => texCave(601 + v));
  ground('g_plank', 2, (v) => texPlank(701 + v));
  ground('g_gravel', 3, (v) => texGravel(801 + v));
  for (let v = 0; v < 2; v++) for (let f = 0; f < 4; f++) {
    const w = texWater(1001 + v * 13, f, PAL.water), d = texWater(1101 + v * 13, f, PAL.deep);
    if (!v && !f) { texs.g_water = w; texs.g_deep = d; }
    A(`g_water_${v}_${f}`, w); A(`g_deep_${v}_${f}`, d);
  }
  addEdges(atlas, 'g_grass', texs.g_grass, PAL.grass.dd, 11);
  addEdges(atlas, 'g_dirt', texs.g_dirt, PAL.dirt.dd, 12);
  addEdges(atlas, 'g_sand', texs.g_sand, PAL.sand.dd, 13);
  addEdges(atlas, 'g_stone', texs.g_stone, PAL.stone.dd, 14);
  addEdges(atlas, 'g_cave', texs.g_cave, PAL.cave.dd, 15);
  addEdges(atlas, 'g_gravel', texs.g_gravel, PAL.gravel.dd, 16);
  addEdges(atlas, 'g_farm', texs.g_farm, PAL.farm.dd, 17);
  addEdges(atlas, 'g_water', texs.g_water, PAL.water.l, 18);
  addFoam(atlas);

  // 벽 블록
  const rockPal = PAL.stone;
  const wall = (key, n, fn) => { for (let v = 0; v < n; v++) A(`${key}_${v}`, wallFrom(fn(v)), 0, -6); };
  wall('w_rock', 3, (v) => texRock(2001 + v, rockPal));
  wall('w_andesite', 3, (v) => texSpeckle(2101 + v, { b: 0x8e908c, l: 0xb5b7b0, d: 0x6c6e69, dd: 0x55574f }));
  wall('w_granite', 3, (v) => texSpeckle(2201 + v, { b: 0xa9705f, l: 0xc9917c, d: 0x82524a, dd: 0x5e3c38 }));
  wall('w_coal', 3, (v) => addOre(texRock(2301 + v, rockPal), 31 + v, { l: 0x55555f, b: 0x26262b, d: 0x121216 }));
  wall('w_iron', 3, (v) => addOre(texRock(2401 + v, rockPal), 41 + v, { l: 0xf0c49c, b: 0xc98d5e, d: 0x9a6238 }));
  wall('w_copper', 3, (v) => addOre(texRock(2501 + v, rockPal), 51 + v, { l: 0xffab6b, b: 0xd9773a, d: 0x3f9c86 }));
  wall('w_gold', 3, (v) => addOre(texRock(2601 + v, rockPal), 61 + v, { l: 0xfff1a0, b: 0xf2c53d, d: 0xc08f1a }));
  wall('w_bedrock', 2, (v) => texRock(2701 + v, { hi: 0x4a4652, l: 0x413d49, b: 0x35323c, d: 0x26232c, dd: 0x1a1820 }));
  wall('w_dark', 2, (v) => { const p = new Pix(16, 16).fill(0x15121b); const r = mulberry32(2801 + v); for (let i = 0; i < 9; i++) p.set(ri(r, 16), ri(r, 16), 0x1c1924); return p; });
  A('w_wood_0', wallFrom(texWoodWall()), 0, -6);
  A('w_brick_0', wallFrom(texBrick(2901)), 0, -6);

  // 벽 테두리 & 그림자
  { const p = new Pix(16, 22); p.rect(0, 0, 16, 1, 0x000000, 150); p.rect(0, 1, 16, 1, 0xffffff, 55); A('rim_N', p, 0, -6); }
  { const p = new Pix(16, 22); p.rect(0, 0, 1, 22, 0x000000, 130); A('rim_W', p, 0, -6); }
  { const p = new Pix(16, 22); p.rect(15, 0, 1, 22, 0x000000, 130); A('rim_E', p, 0, -6); }
  { const p = new Pix(16, 5); [95, 70, 48, 28, 12].forEach((a, y) => p.rect(0, y, 16, 1, 0x000000, a)); A('shadow_S', p); }
  for (let s = 0; s < 4; s++) A(`crack_${s}`, crackSprite(s));

  // 나무
  for (let v = 0; v < 2; v++) {
    anchored(`o_oak_${v}`, treeRound(3001 + v * 9, PAL.oak, PAL.bark));
    anchored(`o_birch_${v}`, treeRound(3101 + v * 9, PAL.birchLeaf, PAL.birch));
    anchored(`o_pine_${v}`, treePine(3201 + v * 9));
    anchored(`o_apple_${v}`, treeRound(3301, PAL.apple, PAL.bark, v === 1));
    anchored(`o_bush_${v}`, bush(3401, v === 1));
  }
  // 작은 자연물
  for (let v = 0; v < 2; v++) {
    A(`o_flower_r_${v}`, flowerSprite(10 + v, 0xe2504a, 0xf6cf3f, 'tulip'));
    A(`o_flower_y_${v}`, flowerSprite(12 + v, 0xf6cf3f, 0xe89a1e, 'puff'));
    A(`o_flower_b_${v}`, flowerSprite(14 + v, 0x5a86e6, 0xf6e27a, 'star'));
    A(`o_flower_w_${v}`, flowerSprite(16 + v, 0xf8f5ec, 0xf6cf3f, 'star'));
    A(`o_pebble_${v}`, pebble(20 + v));
    anchored(`o_boulder_${v}`, boulder(22 + v));
    A(`o_twig_${v}`, twig(24 + v));
    A(`o_mushroom_${v}`, mushroom(26 + v));
    anchored(`o_cactus_${v}`, cactus(28 + v));
    anchored(`o_stalagmite_${v}`, stalagmite(30 + v));
    A(`o_glowshroom_${v}`, glowshroom(32 + v));
    anchored(`o_crystal_${v}`, crystal(34 + v));
  }
  for (let v = 0; v < 3; v++) A(`o_tallgrass_${v}`, tallGrass(40 + v));
  A('o_wildcarrot_0', wildCarrot());
  A('o_deadbush_0', deadBush());
  anchored('o_cave_0', caveEntrance());
  anchored('o_ladder_0', ladder());

  // 설치물
  anchored('o_workbench_0', workbench());
  anchored('o_furnace_0', furnace(false));
  anchored('o_furnace_1', furnace(true, 0));
  anchored('o_furnace_1b', furnace(true, 1));
  anchored('o_chest_0', chest());
  for (let f = 0; f < 3; f++) anchored(`o_torch_0_${f}`, torch(f));
  anchored('o_door_0', door(false)); anchored('o_door_1', door(true));
  anchored('o_bed_0', bed());
  for (let k = 0; k < 4; k++) {
    A(`o_sapling_${k}`, sapling(k));
    anchored(`o_wheat_${k}`, wheat(k));
    anchored(`o_carrot_${k}`, carrotCrop(k));
  }

  // 지붕: 벽보다 높이 떠 있다 (그리는 위치는 렌더러가 ROOF_LIFT로 정한다)
  for (let v = 0; v < 2; v++) { const t = texRoof(4001 + v); if (!v) texs.roof = t; A(`r_roof_${v}`, t, 0, -6); }
  { const p = new Pix(16, 2); p.rect(0, 0, 16, 1, 0x000000, 160); p.rect(0, 1, 16, 1, 0xffffff, 60); A('r_rim_N', p, 0, -6); }
  { const p = new Pix(1, 16); p.rect(0, 0, 1, 16, 0x000000, 150); A('r_rim_W', p, 0, -6); A('r_rim_E', p, 15, -6); }
  { const p = new Pix(16, 6); p.rect(0, 0, 16, 1, ROOF.dd); p.rect(0, 1, 16, 2, shade(ROOF.dd, 0.7)); p.rect(0, 3, 16, 1, 0x000000, 120); p.rect(0, 4, 16, 1, 0x000000, 70); p.rect(0, 5, 16, 1, 0x000000, 30); A('r_rim_S', p, 0, 4); }
  // 깃발: 색 8가지 x 펄럭임 3프레임
  FLAG_COLORS.forEach((fc, m) => { for (let f = 0; f < 3; f++) anchored(`o_flag_${m}_${f}`, flagSprite(fc.c, f)); });

  buildItemSprites(atlas, { texs });
  return atlas;
}
