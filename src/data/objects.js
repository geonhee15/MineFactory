// 타일 위에 놓이는 오브젝트(나무, 광석 벽, 설치물, 작물…) 정의
export const O = {
  NONE: 0, TREE_OAK: 1, TREE_PINE: 2, TREE_BIRCH: 3, TREE_APPLE: 4, BUSH: 5,
  FLOWER_R: 6, FLOWER_Y: 7, FLOWER_B: 8, FLOWER_W: 9, TALLGRASS: 10, PEBBLE: 11, BOULDER: 12, TWIG: 13,
  WILD_CARROT: 14, MUSHROOM: 15, CACTUS: 16, DEADBUSH: 17, CAVE_IN: 18, LADDER: 19,
  ROCK: 20, ANDESITE: 21, GRANITE: 22, COAL_ORE: 23, IRON_ORE: 24, COPPER_ORE: 25, GOLD_ORE: 26, BEDROCK: 27,
  STALAGMITE: 28, GLOWSHROOM: 29, CRYSTAL: 30,
  WORKBENCH: 31, FURNACE: 32, CHEST: 33, TORCH: 34, WOOD_WALL: 35, STONE_BRICK: 36, DOOR: 37, BED: 38,
  SAPLING: 39, WHEAT: 40, CARROT: 41, FLAG: 42,
};

// 재질별 파티클 색
const PC = {
  wood: [0x7a5536, 0x96693f, 0xc49a5c],
  leaf: [0x3f9a3e, 0x58b548, 0x2e7b36],
  stone: [0x8a8f99, 0xa3a8b1, 0x5a5e68],
  plant: [0x62b246, 0x7cc653, 0x4c9a3d],
  dirt: [0x9c6b43, 0x855837, 0xb48152],
};

export const OBJ = [];
const def = (id, d) => {
  OBJ[id] = {
    id, name: '', solid: false, wall: false, spr: null, n: 1, byMeta: 0, frames: 0,
    tool: null, tier: 0, hard: 1, drops: null, mat: 'plant', pcol: PC.plant,
    light: null, use: null, map: -1, tall: false, replace: false, canBreak: true, ...d,
  };
};

def(O.NONE, { canBreak: false });

// ── 지상 자연물 ─────────────────────────────────────────────
const treeDrops = (sap, logMin, logMax) => [['log', logMin, logMax], [sap, 1, 2, 0.75], ['stick', 1, 2, 0.5]];
def(O.TREE_OAK, { name: '참나무', solid: true, spr: 'o_oak', n: 2, tool: 'axe', hard: 3.2, drops: treeDrops('sapling_oak', 3, 5), mat: 'wood', pcol: PC.wood, map: 0x2e7b36, tall: true, tree: true });
def(O.TREE_PINE, { name: '소나무', solid: true, spr: 'o_pine', n: 2, tool: 'axe', hard: 3.4, drops: treeDrops('sapling_pine', 3, 5), mat: 'wood', pcol: PC.wood, map: 0x1f6045, tall: true, tree: true });
def(O.TREE_BIRCH, { name: '자작나무', solid: true, spr: 'o_birch', n: 2, tool: 'axe', hard: 2.8, drops: treeDrops('sapling_birch', 2, 4), mat: 'wood', pcol: [0xe8e4d8, 0xbdb8aa, 0xc49a5c], map: 0x5f9a3a, tall: true, tree: true });
def(O.TREE_APPLE, {
  name: '사과나무', solid: true, spr: 'o_apple', byMeta: 2, tool: 'axe', hard: 3.2, mat: 'wood', pcol: PC.wood, map: 0x34843a, tall: true, tree: true,
  drops: (m) => [['log', 3, 4], ['sapling_apple', 1, 1, 0.8], ...(m ? [['apple', 2, 3]] : [])],
  use: 'harvest', harvest: { item: 'apple', min: 2, max: 3, regrow: [200, 320] },
});
def(O.BUSH, {
  name: '산딸기 덤불', solid: true, spr: 'o_bush', byMeta: 2, tool: 'axe', hard: 1.0, mat: 'plant', pcol: PC.leaf, map: 0x3f9a3e,
  drops: (m) => [['bush', 1, 1], ...(m ? [['berry', 2, 3]] : [])],
  use: 'harvest', harvest: { item: 'berry', min: 2, max: 4, regrow: [150, 260] },
});
const flower = (id, name, spr, item, col) => def(id, { name, spr, n: 2, hard: 0.15, drops: [[item, 1, 1]], pcol: [col, 0x62b246], map: col });
flower(O.FLOWER_R, '튤립', 'o_flower_r', 'flower_r', 0xe2504a);
flower(O.FLOWER_Y, '민들레', 'o_flower_y', 'flower_y', 0xf6cf3f);
flower(O.FLOWER_B, '수레국화', 'o_flower_b', 'flower_b', 0x5a86e6);
flower(O.FLOWER_W, '데이지', 'o_flower_w', 'flower_w', 0xf4f1e6);
def(O.TALLGRASS, { name: '수풀', spr: 'o_tallgrass', n: 3, hard: 0.12, drops: [['fiber', 1, 1, 0.7], ['wheat_seed', 1, 1, 0.35]], replace: true });
def(O.PEBBLE, { name: '돌멩이', spr: 'o_pebble', n: 2, hard: 0.25, drops: [['stone', 1, 1]], mat: 'stone', pcol: PC.stone });
def(O.BOULDER, { name: '바위', solid: true, spr: 'o_boulder', n: 2, tool: 'pick', tier: 1, hard: 4, drops: [['stone', 3, 5], ['coal', 1, 1, 0.25]], mat: 'stone', pcol: PC.stone, map: 0x70757f });
def(O.TWIG, { name: '나뭇가지', spr: 'o_twig', n: 2, hard: 0.2, drops: [['stick', 1, 2]], mat: 'wood', pcol: PC.wood });
def(O.WILD_CARROT, { name: '야생 당근', spr: 'o_wildcarrot', hard: 0.3, drops: [['carrot', 1, 2]], mat: 'dirt', pcol: PC.dirt });
def(O.MUSHROOM, { name: '버섯', spr: 'o_mushroom', n: 2, hard: 0.15, drops: [['mushroom', 1, 1]], pcol: [0xd9583b, 0xf2e6d0] });
def(O.CACTUS, { name: '선인장', solid: true, spr: 'o_cactus', n: 2, hard: 1.4, tool: 'axe', drops: [['cactus', 1, 2]], pcol: [0x4d9b52, 0x6fbf62], map: 0x4d9b52 });
def(O.DEADBUSH, { name: '마른 덤불', spr: 'o_deadbush', hard: 0.3, drops: [['stick', 1, 3]], mat: 'wood', pcol: PC.wood });
def(O.CAVE_IN, { name: '동굴 입구', solid: true, spr: 'o_cave', canBreak: false, use: 'cave', map: 0x1d1a24, mat: 'stone' });

// ── 지하 ────────────────────────────────────────────────────
def(O.LADDER, { name: '사다리', solid: true, spr: 'o_ladder', canBreak: false, use: 'ladder', map: 0xffe27a, light: { r: 4.2, c: 'day' }, mat: 'wood' });
const rock = (id, name, spr, item, tier, hard, map, extra = {}) =>
  def(id, { name, solid: true, wall: true, spr, n: 3, tool: 'pick', tier, hard, drops: [[item, 1, 1]], mat: 'stone', pcol: PC.stone, map, ...extra });
rock(O.ROCK, '돌', 'w_rock', 'stone', 1, 4.5, 0x70757f);
rock(O.ANDESITE, '안산암', 'w_andesite', 'andesite', 1, 5.5, 0x8e908c, { pcol: [0x8e908c, 0xb5b7b0, 0x6c6e69] });
rock(O.GRANITE, '화강암', 'w_granite', 'granite', 1, 6.5, 0xa9705f, { pcol: [0xa9705f, 0xc9917c, 0x82524a] });
rock(O.COAL_ORE, '석탄 광석', 'w_coal', 'coal', 1, 5.5, 0x2c2c33, { drops: [['coal', 1, 2]], pcol: [0x26262b, 0x55555f, 0x8a8f99], ore: true });
rock(O.IRON_ORE, '철광석', 'w_iron', 'iron_ore', 2, 7.5, 0xc98d5e, { pcol: [0xc98d5e, 0xe8b58c, 0x8a8f99], ore: true });
rock(O.COPPER_ORE, '구리 광석', 'w_copper', 'copper_ore', 2, 7, 0xd9773a, { pcol: [0xd9773a, 0x4fb39a, 0x8a8f99], ore: true });
rock(O.GOLD_ORE, '금광석', 'w_gold', 'gold_ore', 3, 9.5, 0xf2c53d, { pcol: [0xf2c53d, 0xfff1a0, 0x8a8f99], ore: true });
def(O.BEDROCK, { name: '기반암', solid: true, wall: true, spr: 'w_bedrock', n: 2, canBreak: false, map: 0x26232c, mat: 'stone' });
def(O.STALAGMITE, { name: '석순', solid: true, spr: 'o_stalagmite', n: 2, tool: 'pick', hard: 2.5, drops: [['stone', 1, 2]], mat: 'stone', pcol: PC.stone });
def(O.GLOWSHROOM, { name: '빛버섯', spr: 'o_glowshroom', n: 2, hard: 0.15, drops: [['glowshroom', 1, 1]], pcol: [0x62e6d0, 0xb8fff2], light: { r: 2.4, c: 'cool' }, map: 0x62e6d0 });
def(O.CRYSTAL, { name: '수정', solid: true, spr: 'o_crystal', n: 2, tool: 'pick', tier: 2, hard: 6, drops: [['crystal', 1, 2]], mat: 'stone', pcol: [0x9fd8ff, 0xe4f6ff, 0x5a9be0], light: { r: 3, c: 'cool' }, map: 0x9fd8ff });

// ── 설치물 ──────────────────────────────────────────────────
def(O.WORKBENCH, { name: '제작대', solid: true, spr: 'o_workbench', tool: 'axe', hard: 1.2, drops: [['workbench', 1, 1]], mat: 'wood', pcol: PC.wood, use: 'workbench', map: 0xc49a5c });
def(O.FURNACE, { name: '화로', solid: true, spr: 'o_furnace', byMeta: 2, tool: 'pick', hard: 2, drops: [['furnace', 1, 1]], mat: 'stone', pcol: PC.stone, use: 'furnace', map: 0x5a5e68, lightIf: { r: 4.2, c: 'warm' } });
def(O.CHEST, { name: '상자', solid: true, spr: 'o_chest', tool: 'axe', hard: 1.2, drops: [['chest', 1, 1]], mat: 'wood', pcol: PC.wood, use: 'chest', map: 0xa87f47 });
def(O.TORCH, { name: '횃불', spr: 'o_torch', frames: 3, hard: 0.1, drops: [['torch', 1, 1]], mat: 'wood', pcol: [0xffb347, 0x7a5536], light: { r: 7, c: 'warm' }, map: 0xffb347 });
def(O.WOOD_WALL, { name: '나무 벽', solid: true, wall: true, spr: 'w_wood', tool: 'axe', hard: 1.6, drops: [['wood_wall', 1, 1]], mat: 'wood', pcol: PC.wood, map: 0x96693a });
def(O.STONE_BRICK, { name: '돌 벽돌', solid: true, wall: true, spr: 'w_brick', tool: 'pick', tier: 1, hard: 3.5, drops: [['stone_brick', 1, 1]], mat: 'stone', pcol: PC.stone, map: 0x9aa0aa });
def(O.DOOR, { name: '문', solid: true, spr: 'o_door', byMeta: 2, tool: 'axe', hard: 1.2, drops: [['door', 1, 1]], mat: 'wood', pcol: PC.wood, use: 'door', map: 0x7a5536 });
def(O.BED, { name: '침대', solid: true, spr: 'o_bed', tool: 'axe', hard: 1.2, drops: [['bed', 1, 1]], mat: 'wood', pcol: PC.wood, use: 'bed', map: 0xd9583b });

// ── 자라는 것들 ─────────────────────────────────────────────
export const SAPLING_ITEMS = ['sapling_oak', 'sapling_pine', 'sapling_birch', 'sapling_apple'];
export const SAPLING_TREES = [O.TREE_OAK, O.TREE_PINE, O.TREE_BIRCH, O.TREE_APPLE];
def(O.SAPLING, { name: '묘목', spr: 'o_sapling', byMeta: 4, hard: 0.2, drops: (m) => [[SAPLING_ITEMS[m] || 'sapling_oak', 1, 1]], grow: [260, 420] });
def(O.WHEAT, {
  name: '밀', spr: 'o_wheat', byMeta: 4, hard: 0.15, pcol: [0xe2c04a, 0x7cc653], crop: true, grow: [70, 110],
  drops: (m) => (m >= 3 ? [['wheat', 1, 2], ['wheat_seed', 1, 2]] : [['wheat_seed', 1, 1]]),
});
def(O.CARROT, {
  name: '당근', spr: 'o_carrot', byMeta: 4, hard: 0.15, pcol: [0xf08a2e, 0x7cc653], crop: true, grow: [80, 120],
  drops: (m) => (m >= 3 ? [['carrot', 2, 3]] : [['carrot', 1, 1]]),
});

// ── 깃발 ── (meta = 색 번호. 지도에 같은 색 깃발로 표시된다)
export const FLAG_COLORS = [
  { name: '빨강', c: 0xe2504a }, { name: '주황', c: 0xf08a2e }, { name: '노랑', c: 0xf6cf3f }, { name: '초록', c: 0x58b548 },
  { name: '하늘', c: 0x4fc3e8 }, { name: '파랑', c: 0x4a6fe0 }, { name: '보라', c: 0x9a5fd6 }, { name: '분홍', c: 0xf07ab0 },
];
def(O.FLAG, { name: '깃발', spr: 'o_flag', byMeta: FLAG_COLORS.length, frames: 3, tall: true, hard: 0.3, drops: [['flag', 1, 1]], mat: 'wood', pcol: PC.wood, use: 'flag' });

export const isWall = (o) => OBJ[o].wall;
