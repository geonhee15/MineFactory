// 아이템 아이콘 + 플레이어 캐릭터 도트
import { Pix, shade, mix } from './pix.js';
import { mulberry32 } from '../rng.js';

const K = 0x241a2b;

function art(rows, pal, w = 16) {
  for (const r of rows) if (r.length !== w) console.warn(`도트 행 길이 오류(${r.length}≠${w}):`, r);
  return new Pix(w, rows.length).ascii(rows, pal);
}
function fromAtlas(atlas, name) {
  const s = atlas.get(name);
  const d = atlas.ctx.getImageData(s.x, s.y, s.w, s.h).data;
  const p = new Pix(s.w, s.h);
  for (let i = 0; i < s.w * s.h; i++) {
    if (d[i * 4 + 3] === 255) p.set(i % s.w, (i / s.w) | 0, (d[i * 4] << 16) | (d[i * 4 + 1] << 8) | d[i * 4 + 2]);
  }
  return p; // 반투명 그림자는 버린다
}
// 여백을 잘라내고 size 안에 맞춰 넣기
function fit(src, size = 16) {
  let x0 = src.w, y0 = src.h, x1 = -1, y1 = -1;
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    if (src.get(x, y) < 0) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const w = x1 - x0 + 1, h = y1 - y0 + 1, sc = Math.min(1, size / w, size / h);
  const dw = Math.max(1, Math.round(w * sc)), dh = Math.max(1, Math.round(h * sc));
  const p = new Pix(size, size), ox = ((size - dw) / 2) | 0, oy = size - dh - (((size - dh) / 2) | 0);
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    p.set(ox + x, oy + y, src.get(x0 + Math.min(w - 1, Math.floor((x + 0.5) / sc)), y0 + Math.min(h - 1, Math.floor((y + 0.5) / sc))));
  }
  return p;
}

const CHUNK = [
  '................',
  '................',
  '................',
  '.....kkkkk......',
  '...kklllllkk....',
  '..kllllbbbbbk...',
  '.kllbbbbbbbbdk..',
  '.klbbbbbbbbbddk.',
  '.kbbbbbbbbbdddk.',
  '.kbbbbbbbbddddk.',
  '.kbbbbbbddddddk.',
  '..kbbddddddddk..',
  '...kkddddddkk...',
  '.....kkkkkk.....',
  '................',
  '................',
];
const chunk = (l, b, d, k = K) => art(CHUNK, { k, l, b, d });
function oreChunk(o) {
  const p = chunk(0xa3a8b1, 0x8a8f99, 0x70757f);
  for (const [x, y, w] of [[4, 6, 2], [8, 5, 2], [7, 8, 3], [11, 7, 2], [4, 9, 2], [9, 10, 3]]) {
    for (let i = 0; i < w; i++) { p.set(x + i, y, o.b); p.set(x + i, y + 1, i === w - 1 ? o.d : o.b); }
    p.set(x, y, o.l);
  }
  return p;
}
function speckChunk(g, seed) {
  const p = chunk(g.l, g.b, g.d), r = mulberry32(seed);
  for (let y = 4; y < 13; y++) for (let x = 2; x < 14; x++) {
    const c = p.get(x, y);
    if (c < 0 || c === K) continue;
    const v = r();
    if (v < 0.16) p.set(x, y, g.l); else if (v < 0.3) p.set(x, y, g.dd);
  }
  return p;
}
const INGOT = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '...kkkkkkkkkkk..',
  '..khhhhhhhhhhkk.',
  '.khhhhhhhhhhkdk.',
  '.kkkkkkkkkkkkdk.',
  '.kllllllllllkdk.',
  '.kbbbbbbbbbbkdk.',
  '.kbbbbbbbbbbkk..',
  '.kkkkkkkkkkkk...',
  '................',
  '................',
  '................',
];
const ingot = (h, l, b, d) => { const p = art(INGOT, { k: K, h, l, b, d }); p.set(3, 7, 0xffffff); p.set(4, 6, 0xffffff); return p; };

const PICK = [
  '................',
  '......kkkkkk....',
  '....kkmmmmmmk...',
  '...kmmMMMMmmmk..',
  '...kMkkkkkwMmmk.',
  '....k....kwkMmk.',
  '........kwk.kMmk',
  '.......kwk..kMmk',
  '......kwk....kMk',
  '.....kwk.....kk.',
  '....kwk.........',
  '...kwk..........',
  '..kwk...........',
  '.kWk............',
  '.kk.............',
  '................',
];
const AXE = [
  '................',
  '.........kk.....',
  '........kwwk....',
  '.......kwwkkkk..',
  '......kwwkmmmmk.',
  '.....kwwkmmMMmmk',
  '....kwwk.kmMMMmk',
  '...kwwk..kmMMmk.',
  '..kwwk....kmmk..',
  '.kwwk......kk...',
  'kWwk............',
  'kkk.............',
  '................',
  '................',
  '................',
  '................',
];
const HOE = [
  '................',
  '......kkkkkkk...',
  '.....kmmmmmmwk..',
  '.....kmMkkkwwk..',
  '.....kmk..kwk...',
  '.....kk..kwk....',
  '........kwk.....',
  '.......kwk......',
  '......kwk.......',
  '.....kwk........',
  '....kwk.........',
  '...kwk..........',
  '..kWk...........',
  '..kk............',
  '................',
  '................',
];
const HEADS = { wood: [0xcfa468, 0x96693a], stone: [0xb9bec8, 0x70757f], iron: [0xeef2f7, 0xa4adbd] };

const LOG = [
  '................',
  '................',
  '................',
  '................',
  '..kkkkkkkkkkkk..',
  '.khhhhhhhhhkllk.',
  '.kbbbbbbbbbkldlk',
  '.kbbBbbbbBbkldlk',
  '.kbbbbbbbbbkldlk',
  '.kBbbbBbbbbkldlk',
  '.kBBBBBBBBBkllk.',
  '..kkkkkkkkkkkk..',
  '................',
  '................',
  '................',
  '................',
];
const PLANK = [
  '................',
  '................',
  '................',
  '...kkkkkkkkkkkk.',
  '...khhhhhhhhhhk.',
  '...kllllldllllk.',
  '...kkkkkkkkkkkk.',
  '.kkkkkkkkkkkk...',
  '.khhhhhhhhhhk...',
  '.klllldlllllk...',
  '.kbbbbbbbbbbk...',
  '.kkkkkkkkkkkk...',
  '................',
  '................',
  '................',
  '................',
];
const STICK = [
  '................',
  '................',
  '................',
  '...........kk...',
  '..........kllk..',
  '.........klbk...',
  '........klbk....',
  '.......klbk.....',
  '......klbk......',
  '.....klbk.......',
  '....klbk........',
  '...klbk.........',
  '..klbk..........',
  '..kbk...........',
  '...k............',
  '................',
];
const TORCH = [
  '................',
  '.......kk.......',
  '......kook......',
  '.....koyyok.....',
  '.....koyyok.....',
  '......kyok......',
  '......kddk......',
  '......klbk......',
  '......klbk......',
  '......klbk......',
  '......klbk......',
  '......klbk......',
  '......klbk......',
  '.......kk.......',
  '................',
  '................',
];

function shadeBlob(p, cx, cy, rx, ry, g, r) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const dx = (x - cx) / rx, dy = (y - cy) / ry;
    if (dx * dx + dy * dy > 1) continue;
    const v = -dx * 0.55 - dy * 0.85 + (r ? (r() - 0.5) * 0.2 : 0);
    p.set(x, y, v > 0.6 ? g.hi : v > 0.1 ? g.l : v > -0.5 ? g.b : g.d);
  }
}
function blockIcon(tex, frontH = 4) {
  const p = new Pix(16, 16), top = 14 - frontH - 9;
  for (let y = 0; y < 9; y++) for (let x = 0; x < 12; x++) p.set(2 + x, top + y, tex.get(x + 2, y + 2));
  for (let y = 0; y < frontH; y++) for (let x = 0; x < 12; x++) p.set(2 + x, top + 9 + y, shade(tex.get(x + 2, 11 + y), y === 0 ? 0.8 : 0.6));
  for (let x = 0; x < 12; x++) p.tint(2 + x, top, 0xffffff, 0.25);
  p.outline(K);
  return p;
}

export function buildItemSprites(atlas, { texs }) {
  const I = (id, p) => atlas.add('i_' + id, p);
  const P = { bark: { l: 0x96693f, b: 0x7a5536, d: 0x5a3d26 }, plank: { hi: 0xdab676, l: 0xcfa468, b: 0xb8894f, d: 0x96693a } };

  I('log', art(LOG, { k: K, h: P.bark.l, b: P.bark.b, B: P.bark.d, l: 0xdcb777, d: 0xb98d52 }));
  I('plank', art(PLANK, { k: K, h: P.plank.hi, l: P.plank.l, d: P.plank.d, b: P.plank.b }));
  I('stick', art(STICK, { k: K, l: P.bark.l, b: P.bark.b }));
  { // 풀섬유
    const p = new Pix(16, 16);
    p.line(4, 3, 7, 13, 0x7cc653); p.line(6, 2, 8, 13, 0x62b246); p.line(10, 2, 8, 13, 0x4c9a3d); p.line(12, 4, 9, 13, 0x7cc653); p.line(8, 2, 8, 13, 0x8fd45e);
    p.rect(6, 8, 5, 2, 0xc79a6b); p.rect(6, 9, 5, 1, 0x9c6b43);
    I('fiber', p.outline(0x2a5f2e));
  }
  I('stone', chunk(0xb9bec8, 0x8a8f99, 0x70757f));
  I('andesite', speckChunk({ l: 0xb5b7b0, b: 0x8e908c, d: 0x6c6e69, dd: 0x55574f }, 5));
  I('granite', speckChunk({ l: 0xc9917c, b: 0xa9705f, d: 0x82524a, dd: 0x5e3c38 }, 6));
  { const p = chunk(0x55555f, 0x2c2c33, 0x17171b); p.set(5, 6, 0x8a8a96); p.set(6, 6, 0x8a8a96); p.set(9, 8, 0x55555f); I('coal', p); }
  { const p = chunk(0x5c4a40, 0x372c28, 0x1f1917); p.line(5, 6, 8, 10, 0x1f1917); p.line(9, 6, 11, 9, 0x1f1917); p.set(6, 6, 0x8a7060); I('charcoal', p); }
  I('iron_ore', oreChunk({ l: 0xf0c49c, b: 0xc98d5e, d: 0x9a6238 }));
  I('copper_ore', oreChunk({ l: 0xffab6b, b: 0xd9773a, d: 0x3f9c86 }));
  I('gold_ore', oreChunk({ l: 0xfff1a0, b: 0xf2c53d, d: 0xc08f1a }));
  I('iron_ingot', ingot(0xeef2f7, 0xc5ccd8, 0xa4adbd, 0x7f8898));
  I('copper_ingot', ingot(0xffc08a, 0xe8894a, 0xc96a30, 0x9a4c20));
  I('gold_ingot', ingot(0xfff6b8, 0xf7d354, 0xe0ae2a, 0xb07f14));
  I('crystal', fit(fromAtlas(atlas, 'o_crystal_0')));
  { // 톱니바퀴
    const p = new Pix(16, 16);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const dx = x - 7.5, dy = y - 7.5, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const tooth = Math.cos(a * 8) > 0.25;
      if (r < 2) continue;
      if (r <= 5.2 || (tooth && r <= 7.3)) {
        const v = (-dx - dy) / 10;
        p.set(x, y, r < 3 ? 0x7f8898 : v > 0.25 ? 0xe2e7ee : v > -0.2 ? 0xb9c1cf : 0x929bab);
      }
    }
    I('gear', p.outline(K));
  }
  { // 구리선
    const p = new Pix(16, 16);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const dx = (x - 7.5) / 6, dy = (y - 8.5) / 4.6, r = Math.hypot(dx, dy);
      if (r <= 1 && r >= 0.42) p.set(x, y, (x + y) % 3 === 0 ? 0xffb37a : (x + y) % 3 === 1 ? 0xe8894a : 0xc96a30);
    }
    p.line(12, 6, 14, 2, 0xe8894a); p.set(14, 2, 0xffb37a);
    I('copper_wire', p.outline(K));
  }

  // 먹을 것
  { // 산딸기
    const p = new Pix(16, 16), g = { hi: 0xffa0aa, l: 0xf0606f, b: 0xd9405a, d: 0xa82848 };
    shadeBlob(p, 5.5, 8.5, 2.8, 2.8, g); shadeBlob(p, 10.5, 7.5, 2.8, 2.8, g); shadeBlob(p, 8.5, 11.5, 2.8, 2.8, g);
    p.rect(7, 4, 3, 1, 0x4c9a3d); p.set(8, 3, 0x62b246); p.set(6, 5, 0x4c9a3d); p.set(10, 4, 0x62b246);
    I('berry', p.outline(K));
  }
  { // 사과
    const p = new Pix(16, 16), g = { hi: 0xff9a8a, l: 0xf0564a, b: 0xd93a36, d: 0xa82a34 };
    shadeBlob(p, 6.5, 9.5, 4, 4.4, g); shadeBlob(p, 9.5, 9.5, 4, 4.4, g);
    p.set(5, 7, 0xffffff); p.set(8, 5, g.d);
    p.rect(8, 2, 1, 3, 0x6b4a2f); p.rect(9, 2, 3, 2, 0x58b548); p.set(11, 2, 0x7fd05a); p.set(9, 3, 0x3f9a3e);
    I('apple', p.outline(K));
  }
  { // 당근
    const p = new Pix(16, 16);
    for (let t = 0; t <= 9; t++) { const rr = 2.4 * (1 - t / 10) + 0.5; p.disc(10.5 - t * 0.85, 5.5 + t * 0.85, rr, t < 5 ? 0xf08a2e : 0xe07420); }
    for (let t = 0; t <= 8; t++) p.set(Math.round(9.6 - t * 0.85), Math.round(4.6 + t * 0.85), 0xffb05a);
    p.set(8, 9, 0xc85f18); p.set(6, 10, 0xc85f18); p.set(10, 8, 0xc85f18);
    p.line(11, 4, 13, 1, 0x58b548); p.line(11, 4, 11, 1, 0x3f9a3e); p.line(12, 4, 15, 3, 0x7fd05a); p.set(12, 2, 0x58b548);
    I('carrot', p.outline(K));
  }
  I('mushroom', fromAtlas(atlas, 'o_mushroom_0'));
  I('baked_mushroom', fromAtlas(atlas, 'o_mushroom_0').map((c) => (c === 0xd9583b ? 0x9a6238 : c === 0xf07a5a ? 0xc08552 : c === 0xfff1e0 ? 0xe0b070 : c === 0xf2e6d0 ? 0xe8c890 : c === 0xcdbfa6 ? 0xb8925a : c)));
  { // 밀
    const p = new Pix(16, 16);
    for (const [x0, x1] of [[6, 4], [8, 8], [10, 12]]) {
      p.line(x0, 14, x1, 6, 0xc9a23a);
      for (let k = 0; k < 5; k++) { const y = 6 - k, x = x1 + (x1 < 8 ? -(k > 2) : x1 > 8 ? (k > 2) : 0); p.set(x, y, 0xf2cf52); p.set(x + (k % 2 ? 1 : -1), y, 0xd9a82e); }
    }
    p.rect(6, 11, 5, 1, 0xb04430); p.rect(6, 12, 5, 1, 0x8a3324);
    I('wheat', p.outline(0x6b4a1a));
  }
  { // 빵
    const p = new Pix(16, 16), g = { hi: 0xf4d79a, l: 0xe0aa5c, b: 0xc98a3e, d: 0x9a6226 };
    shadeBlob(p, 7.5, 9, 6.4, 4.2, g);
    for (const x of [4, 7, 10]) { p.line(x, 6, x + 2, 9, 0xf4d79a); p.line(x + 1, 6, x + 3, 9, 0x9a6226); }
    I('bread', p.outline(K));
  }
  { // 밀 씨앗
    const p = new Pix(16, 16);
    for (const [x, y] of [[4, 6], [9, 5], [6, 10], [11, 9], [8, 12]]) { p.rect(x, y, 2, 2, 0xd9c08a); p.set(x, y, 0xf2e2b4); p.set(x + 1, y + 1, 0xa88a52); }
    I('wheat_seed', p.outline(0x5a4424));
  }

  // 식물 · 묘목
  ['oak', 'pine', 'birch', 'apple'].forEach((n, k) => I('sapling_' + n, fromAtlas(atlas, `o_sapling_${k}`)));
  I('bush', fromAtlas(atlas, 'o_bush_1'));
  for (const c of ['r', 'y', 'b', 'w']) I('flower_' + c, fromAtlas(atlas, `o_flower_${c}_1`));
  I('cactus', fit(fromAtlas(atlas, 'o_cactus_1')));
  I('glowshroom', fromAtlas(atlas, 'o_glowshroom_0'));

  // 설치물
  I('workbench', fit(fromAtlas(atlas, 'o_workbench_0')));
  I('furnace', fit(fromAtlas(atlas, 'o_furnace_0')));
  I('chest', fit(fromAtlas(atlas, 'o_chest_0')));
  I('torch', art(TORCH, { k: K, o: 0xe2541e, y: 0xffd95a, d: 0x5a3d26, l: P.bark.l, b: P.bark.b }));
  I('wood_wall', blockIcon(fromAtlas(atlas, 'w_wood_0')));
  I('stone_brick', blockIcon(fromAtlas(atlas, 'w_brick_0')));
  I('plank_floor', blockIcon(texs.g_plank, 2));
  { // 문
    const p = new Pix(16, 16), g = P.plank;
    p.rect(4, 1, 8, 14, g.b); p.rect(4, 1, 8, 1, g.hi); p.rect(7, 2, 1, 13, g.d);
    p.rect(4, 4, 8, 1, 0x8a8f99); p.rect(4, 11, 8, 1, 0x8a8f99); p.set(10, 8, 0xf2c53d); p.set(10, 7, 0xfff1a0);
    I('door', p.outline(K));
  }
  { // 침대
    const p = new Pix(16, 16), g = P.plank;
    p.rect(1, 5, 2, 9, g.d); p.rect(1, 5, 1, 9, g.l);
    p.rect(3, 10, 12, 2, g.b); p.rect(13, 12, 2, 2, g.d); p.rect(3, 12, 2, 2, g.d);
    p.rect(3, 8, 12, 2, 0xf2efe6); p.rect(3, 7, 4, 2, 0xffffff); p.rect(8, 7, 7, 3, 0xd9583b); p.rect(8, 7, 7, 1, 0xf07a5a);
    I('bed', p.outline(K));
  }

  I('roof', blockIcon(texs.roof, 2));
  { // 깃발
    const p = new Pix(16, 16), c = 0xe2504a;
    for (let cx = 0; cx < 9; cx++) {
      const yo = Math.round(Math.sin((cx / 8) * Math.PI * 1.5) * 1);
      for (let cy = 0; cy < 6; cy++) p.set(6 + cx, 3 + cy + yo, cy === 5 ? shade(c, 0.72) : cx < 3 ? shade(c, 1.2) : cx > 6 ? shade(c, 0.85) : c);
    }
    for (let y = 2; y < 15; y++) { p.set(4, y, 0xf0f0f5); p.set(5, y, 0x9aa0aa); }
    p.set(4, 1, 0xfff1a0); p.set(5, 1, 0xf2c53d);
    I('flag', p.outline(K));
  }

  // 도구
  for (const mat of ['wood', 'stone', 'iron']) {
    const [m, M] = HEADS[mat], pal = { k: K, m, M, w: 0x96693f, W: 0x5a3d26 };
    I(`${mat}_pickaxe`, art(PICK, pal));
    I(`${mat}_axe`, art(AXE, pal));
    I(`${mat}_hoe`, art(HOE, pal));
  }

  buildPlayer(atlas);

  // 드롭 아이템/플레이어 그림자
  { const p = new Pix(10, 4); p.ellipse(4.5, 1.5, 4.5, 1.6, 0x000000, 70); atlas.add('shadow_s', p); }
  { const p = new Pix(14, 5); p.ellipse(6.5, 2, 6.5, 2.2, 0x000000, 80); atlas.add('shadow_p', p); }
  // 조명용 방사형 그라디언트는 렌더러에서 캔버스로 만든다
}

// ── 플레이어: 노란 안전모를 쓴 꼬마 광부 ─────────────────────
function buildPlayer(atlas) {
  const pal = {
    k: K, y: 0xf4c430, Y: 0xffe27a, o: 0xc9952a, l: 0xfffbe0, L: 0x8a8f99,
    s: 0xf2b58b, S: 0xd9936c, h: 0x6b3f2a, e: 0x2a1f2d, m: 0xb86a50,
    b: 0x3f6fb5, B: 0x2f548c, r: 0xd9583b, R: 0xb04430, g: 0x5a3d26,
  };
  const HELM = [
    '....kkkkkkkk....',
    '...kYYYYyyyyk...',
  ];
  const bodyD = [
    ...HELM,
    '..kYYyLllLyyok..',
    '..kYyyLllLyyok..',
    '.kyyyyyyyyyyook.',
    '.kooooooooooook.',
    '..khsssssssshk..',
    '..kssessssessk..',
    '..kssessssessk..',
    '..kSssssssssSk..',
    '...kSssmmssSk...',
    '..kkrrbrrbrrkk..',
    '.krrrbbrrbbrrrk.',
    '.krRbbbbbbbbRrk.',
    '.kskbbbbbbbbksk.',
    '..kkbbbbbbbbkk..',
  ];
  const bodyU = [
    ...HELM,
    '..kYYyyyyyyyok..',
    '..kYyyyyyyyyok..',
    '.kyyyyyyyyyyook.',
    '.kooooooooooook.',
    '..khhhhhhhhhhk..',
    '..khhhhhhhhhhk..',
    '..kshhhhhhhhsk..',
    '..kSsshhhhssSk..',
    '...kSssssssSk...',
    '..kkrrbbbbrrkk..',
    '.krrrbbbbbbrrrk.',
    '.krRbbbbbbbbRrk.',
    '.kskbbbbbbbbksk.',
    '..kkbbbbbbbbkk..',
  ];
  const bodyR = [
    ...HELM,
    '..kYYyyyyyyoLlk.',
    '..kYyyyyyyyoLlk.',
    '..kyyyyyyyyyook.',
    '..kooooooooooook',
    '..khhsssssssk...',
    '..khssssssesk...',
    '..khssssssesk...',
    '..kSsssssssssk..',
    '...kSssssssk....',
    '...kkrrrbrkk....',
    '...krrrrbbrk....',
    '...kbbrRbbbk....',
    '...kbbsSbbbk....',
    '...kkbbbbbkk....',
  ];
  const legsFront = [
    ['...kbbBkkBbbk...', '...kbbk..kbbk...', '...kggk..kggk...', '...kkkk..kkkk...'],
    ['...kbbBkkBbbk...', '...kggk..kbbk...', '...kkkk..kggk...', '.........kkkk...'],
    ['...kbbBkkBbbk...', '...kbbk..kggk...', '...kggk..kkkk...', '...kkkk.........'],
  ];
  const legsSide = [
    ['....kbbBbbk.....', '....kbbkbbk.....', '....kggkgggk....', '....kkkkkkkk....'],
    ['....kbbBbbk.....', '...kbbk.kbbk....', '..kggk...kggk...', '..kkkk...kkkk...'],
    ['....kbbBbbk.....', '.....kbbbk......', '.....kgggk......', '.....kkkkk......'],
  ];
  const compose = (body, legs, bob) => {
    const p = new Pix(16, 20);
    p.blit(art(legs, pal), 0, 16);
    p.blit(art(body, pal), 0, bob);
    return p;
  };
  // 걷기 4프레임: 서기 → 왼발 → 서기 → 오른발
  const seqFront = [[0, 0], [1, 1], [0, 0], [2, 1]];
  const seqSide = [[0, 0], [1, 1], [2, 0], [1, 1]];
  for (let f = 0; f < 4; f++) {
    atlas.add(`p_d_${f}`, compose(bodyD, legsFront[seqFront[f][0]], seqFront[f][1]), -8, -18);
    atlas.add(`p_u_${f}`, compose(bodyU, legsFront[seqFront[f][0]], seqFront[f][1]), -8, -18);
    const side = compose(bodyR, legsSide[seqSide[f][0]], seqSide[f][1]);
    atlas.add(`p_r_${f}`, side, -8, -18);
    atlas.add(`p_l_${f}`, side.flip(), -8, -18);
  }
}

export { mix };
