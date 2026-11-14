// 아이템 · 레시피 · 제련 · 연료
import { O } from './objects.js';
import { G } from './ground.js';

export const ITEMS = Object.create(null);
const item = (id, name, desc, d = {}) => { ITEMS[id] = { id, name, desc, stack: 99, icon: 'i_' + id, ...d }; };

// ── 재료 ──
item('log', '원목', '나무를 베어 얻은 통나무. 모든 것의 시작.', { fuel: 10 });
item('plank', '판자', '원목을 켜서 만든 널빤지.', { fuel: 5 });
item('stick', '막대기', '도구 손잡이로 쓰기 좋다.', { fuel: 2.5 });
item('fiber', '풀섬유', '수풀에서 얻은 질긴 섬유.', { fuel: 1 });
item('stone', '돌', '단단한 돌. 다시 놓아 벽으로 쌓을 수 있다.', { place: { obj: O.ROCK } });
item('andesite', '안산암', '회색 반점이 있는 화산암.', { place: { obj: O.ANDESITE } });
item('granite', '화강암', '붉은빛이 도는 단단한 암석.', { place: { obj: O.GRANITE } });
item('coal', '석탄', '오래 타는 훌륭한 연료.', { fuel: 40 });
item('charcoal', '숯', '원목을 구워 만든 연료.', { fuel: 30 });
item('iron_ore', '철광석', '화로에서 제련하면 철 주괴가 된다.');
item('copper_ore', '구리 광석', '화로에서 제련하면 구리 주괴가 된다.');
item('gold_ore', '금광석', '깊은 곳에서 드물게 나오는 귀한 광석.');
item('iron_ingot', '철 주괴', '튼튼한 도구와 기계의 재료.');
item('copper_ingot', '구리 주괴', '전기가 잘 통하는 금속.');
item('gold_ingot', '금 주괴', '반짝이는 귀금속.');
item('crystal', '수정', '은은하게 빛나는 결정. 언젠가 쓸모가 있을 것 같다.');
item('gear', '톱니바퀴', '기계의 기본 부품. 공장 시대의 첫걸음!');
item('copper_wire', '구리선', '전기를 나르는 선. 공장 설비에 쓰인다.');

// ── 먹을 것 ──
item('berry', '산딸기', '새콤달콤한 열매.', { food: 8 });
item('apple', '사과', '아삭한 사과.', { food: 14 });
item('carrot', '당근', '먹어도 되고, 경작지에 심어도 된다.', { food: 12, seed: { obj: O.CARROT } });
item('mushroom', '버섯', '구우면 더 맛있다.', { food: 7 });
item('baked_mushroom', '구운 버섯', '고소하게 구운 버섯.', { food: 18 });
item('wheat', '밀', '빵의 재료.');
item('bread', '빵', '든든한 한 끼.', { food: 35 });

// ── 씨앗 · 묘목 · 식물 ──
item('wheat_seed', '밀 씨앗', '괭이로 간 경작지에 심는다.', { seed: { obj: O.WHEAT } });
item('sapling_oak', '참나무 묘목', '풀밭이나 흙에 심으면 나무로 자란다.', { place: { obj: O.SAPLING, meta: 0, on: 'soil' }, fuel: 2 });
item('sapling_pine', '소나무 묘목', '풀밭이나 흙에 심으면 나무로 자란다.', { place: { obj: O.SAPLING, meta: 1, on: 'soil' }, fuel: 2 });
item('sapling_birch', '자작나무 묘목', '풀밭이나 흙에 심으면 나무로 자란다.', { place: { obj: O.SAPLING, meta: 2, on: 'soil' }, fuel: 2 });
item('sapling_apple', '사과나무 묘목', '다 자라면 사과가 열린다.', { place: { obj: O.SAPLING, meta: 3, on: 'soil' }, fuel: 2 });
item('bush', '산딸기 덤불', '옮겨 심을 수 있다. 시간이 지나면 열매가 열린다.', { place: { obj: O.BUSH, meta: 0, on: 'soil', grow: true } });
item('flower_r', '튤립', '빨간 꽃.', { place: { obj: O.FLOWER_R, on: 'soil' } });
item('flower_y', '민들레', '노란 꽃.', { place: { obj: O.FLOWER_Y, on: 'soil' } });
item('flower_b', '수레국화', '파란 꽃.', { place: { obj: O.FLOWER_B, on: 'soil' } });
item('flower_w', '데이지', '하얀 꽃.', { place: { obj: O.FLOWER_W, on: 'soil' } });
item('cactus', '선인장', '모래에 심을 수 있다. 따가우니 조심!', { place: { obj: O.CACTUS, on: 'sand' } });
item('glowshroom', '빛버섯', '어둠 속에서 빛나는 버섯. 바닥에 놓으면 주변을 밝힌다.', { place: { obj: O.GLOWSHROOM } });

// ── 설치물 ──
item('workbench', '제작대', '설치하고 우클릭하면 더 많은 것을 만들 수 있다.', { place: { obj: O.WORKBENCH } });
item('furnace', '화로', '광석을 녹이고 음식을 굽는다. 연료가 필요하다.', { place: { obj: O.FURNACE } });
item('chest', '상자', '아이템 27칸을 보관한다.', { place: { obj: O.CHEST } });
item('torch', '횃불', '어둠을 밝힌다. 손에 들고만 있어도 밝다.', { place: { obj: O.TORCH }, light: 8 });
item('wood_wall', '나무 벽', '집을 지을 때 쓰는 벽.', { place: { obj: O.WOOD_WALL } });
item('stone_brick', '돌 벽돌', '단단한 건축용 벽.', { place: { obj: O.STONE_BRICK } });
item('plank_floor', '나무 바닥', '바닥에 깐다.', { place: { ground: G.PLANK } });
item('door', '문', '우클릭으로 여닫는다.', { place: { obj: O.DOOR } });
item('bed', '침대', '밤에 우클릭하면 아침까지 잔다.', { place: { obj: O.BED } });
item('roof', '지붕', '벽과 방 위를 덮는 천장. 밖에서는 안이 보이지 않고, 문을 열거나 안에 들어가면 비쳐 보인다.', { roof: true });
item('flag', '깃발', '세우고 색을 고르면 지도에 깃발로 표시된다. 멀리서도 화살표로 방향을 알려 준다.', { place: { obj: O.FLAG } });

// ── 도구 ──
const TIERS = [['wood', '나무', 1], ['stone', '돌', 2], ['iron', '철', 3]];
for (const [mat, ko, tier] of TIERS) {
  item(`${mat}_pickaxe`, `${ko} 곡괭이`, '돌과 광석을 캔다.', { stack: 1, tool: 'pick', tier });
  item(`${mat}_axe`, `${ko} 도끼`, '나무를 빠르게 벤다.', { stack: 1, tool: 'axe', tier });
  item(`${mat}_hoe`, `${ko} 괭이`, '풀밭이나 흙을 갈아 경작지로 만든다.', { stack: 1, tool: 'hoe', tier });
}

// 도구 등급별 채굴 속도 배수 (0 = 맨손)
export const TOOL_SPEED = [1, 2.6, 4.2, 6.8];

// ── 레시피 ──  station: null(맨손) | 'workbench'
export const RECIPES = [];
const R = (out, n, ins, station = null, cat = 'basic') => RECIPES.push({ out, n, in: ins, station, cat });
R('plank', 4, { log: 1 });
R('stick', 4, { plank: 2 });
R('workbench', 1, { plank: 4 });
R('torch', 4, { stick: 1, coal: 1 });
R('torch', 4, { stick: 1, charcoal: 1 });
R('flag', 1, { stick: 2, fiber: 3 });

R('wood_pickaxe', 1, { plank: 3, stick: 2 }, 'workbench', 'tool');
R('wood_axe', 1, { plank: 3, stick: 2 }, 'workbench', 'tool');
R('wood_hoe', 1, { plank: 2, stick: 2 }, 'workbench', 'tool');
R('stone_pickaxe', 1, { stone: 3, stick: 2 }, 'workbench', 'tool');
R('stone_axe', 1, { stone: 3, stick: 2 }, 'workbench', 'tool');
R('stone_hoe', 1, { stone: 2, stick: 2 }, 'workbench', 'tool');
R('iron_pickaxe', 1, { iron_ingot: 3, stick: 2 }, 'workbench', 'tool');
R('iron_axe', 1, { iron_ingot: 3, stick: 2 }, 'workbench', 'tool');
R('iron_hoe', 1, { iron_ingot: 2, stick: 2 }, 'workbench', 'tool');

R('furnace', 1, { stone: 8 }, 'workbench', 'build');
R('chest', 1, { plank: 8 }, 'workbench', 'build');
R('wood_wall', 2, { plank: 2 }, 'workbench', 'build');
R('plank_floor', 4, { plank: 2 }, 'workbench', 'build');
R('stone_brick', 2, { stone: 2 }, 'workbench', 'build');
R('door', 1, { plank: 6 }, 'workbench', 'build');
R('roof', 4, { plank: 2 }, 'workbench', 'build');
R('bed', 1, { plank: 6, fiber: 8 }, 'workbench', 'build');

R('bread', 1, { wheat: 3 }, 'workbench', 'food');
R('gear', 1, { iron_ingot: 2 }, 'workbench', 'part');
R('copper_wire', 2, { copper_ingot: 1 }, 'workbench', 'part');

export const CATEGORY_NAMES = { basic: '기본', tool: '도구', build: '건축', food: '음식', part: '부품' };

// ── 화로 ──
export const SMELT = {
  iron_ore: { out: 'iron_ingot', time: 8 },
  copper_ore: { out: 'copper_ingot', time: 8 },
  gold_ore: { out: 'gold_ingot', time: 10 },
  log: { out: 'charcoal', time: 5 },
  mushroom: { out: 'baked_mushroom', time: 4 },
};

export const itemName = (id) => (ITEMS[id] ? ITEMS[id].name : id);
