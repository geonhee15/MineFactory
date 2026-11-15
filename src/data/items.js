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
item('gear', '톱니바퀴', '기계의 기본 부품. 컨베이어 벨트와 압축기에 들어간다.');
item('copper_wire', '구리선', '전기를 나르는 선. 압축기 같은 공장 설비에 쓰인다.');
item('machine_frame', '기계 틀', '철로 짠 튼튼한 뼈대. 공장 기계를 만들 때 바탕이 된다.');
item('piston', '피스톤', '힘껏 밀어 누르는 부품. 압축기의 심장.');
// 압축기로 눌러 만든 판 (쓸 곳은 앞으로 늘어난다)
item('granite_plate', '화강암 판', '화강암을 눌러 만든 단단한 판.');
item('andesite_plate', '안산암 판', '안산암을 눌러 만든 매끈한 판.');
item('iron_plate', '철판', '철 주괴를 눌러 편 판. 튼튼한 설비의 재료.');
item('gold_plate', '금 판', '금 주괴를 눌러 편 판. 얇고 반짝인다.');
item('copper_plate', '구리 판', '구리 주괴를 눌러 편 판. 열과 전기가 잘 통한다.');

// ── 동물에게서 얻는 것 ── (지금은 양털만 쓸 곳이 있다. 고기는 아직 먹을 수 없다)
item('beef', '소고기', '소에게서 얻은 고기. 아직은 먹는 방법을 모른다.');
item('pork', '돼지고기', '돼지에게서 얻은 고기. 아직은 먹는 방법을 모른다.');
item('mutton', '양고기', '양에게서 얻은 고기. 아직은 먹는 방법을 모른다.');
item('chicken', '닭고기', '닭에게서 얻은 고기. 아직은 먹는 방법을 모른다.');
item('leather', '가죽', '질기고 튼튼한 소가죽. 컨베이어 벨트의 띠로 쓰면 풀섬유보다 훨씬 많이 만들 수 있다.');
item('wool', '양털', '폭신한 양털. 양모 침대의 재료.');
item('feather', '깃털', '가벼운 닭 깃털. 언젠가 쓸모가 있을 것 같다.');
item('egg', '달걀', '닭에게서 얻은 달걀. 언젠가 쓸모가 있을 것 같다.');

// ── 먹을 것 ──
item('berry', '산딸기', '새콤달콤한 열매.', { food: 8 });
item('apple', '사과', '아삭한 사과.', { food: 14 });
item('carrot', '당근', '먹어도 되고, 경작지에 심어도 된다. 손에 들고 있으면 돼지가 따라온다.', { food: 12, seed: { obj: O.CARROT } });
item('mushroom', '버섯', '구우면 더 맛있다.', { food: 7 });
item('baked_mushroom', '구운 버섯', '고소하게 구운 버섯.', { food: 18 });
item('wheat', '밀', '빵의 재료. 손에 들고 있으면 소와 양이 따라온다.');
item('bread', '빵', '든든한 한 끼.', { food: 35 });

// ── 씨앗 · 묘목 · 식물 ──
item('wheat_seed', '밀 씨앗', '괭이로 간 경작지에 심는다. 손에 들고 있으면 닭이 따라온다.', { seed: { obj: O.WHEAT } });
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
item('chest', '상자', '아이템 27칸을 보관한다. 두 개를 나란히 놓으면 54칸짜리 큰 상자가 된다.', { place: { obj: O.CHEST } });
item('torch', '횃불', '어둠을 밝힌다. 손에 들고만 있어도 밝다.', { place: { obj: O.TORCH }, light: 8 });
item('wood_wall', '나무 벽', '집을 지을 때 쓰는 벽.', { place: { obj: O.WOOD_WALL } });
item('stone_brick', '돌 벽돌', '단단한 건축용 벽.', { place: { obj: O.STONE_BRICK } });
item('plank_floor', '나무 바닥', '바닥에 깐다.', { place: { ground: G.PLANK } });
item('door', '문', '우클릭으로 여닫는다.', { place: { obj: O.DOOR } });
item('bed', '침대', '밤에 우클릭하면 아침까지 잔다. 우클릭한 침대는 쓰러졌을 때 다시 일어나는 리스폰 지점이 된다.', { place: { obj: O.BED } });
item('wool_bed', '양모 침대', '자고 일어나면 포만감이 가득 찬다. 낮에 우클릭하면 저녁까지 낮잠을 잔다. 우클릭하면 리스폰 지점이 된다.', { place: { obj: O.WOOL_BED } });
item('fence', '울타리', '사람도 동물도 넘지 못하는 낮은 담. 나란히 놓으면 서로 이어진다.', { place: { obj: O.FENCE } });
item('fence_gate', '울타리 문', '우클릭으로 여닫는다. 동물은 열지 못한다.', { place: { obj: O.GATE } });
item('sign', '표지판', '땅에 세우고 글을 쓴다. 블록에 대고 놓으면 그 블록에 나무 판으로 붙는다.', { place: { obj: O.SIGN }, sign: true });
item('belt', '컨베이어 벨트', '놓인 방향으로 그 위의 아이템을(올라서면 사람도) 실어 나른다. 앞에 붙은 상자 · 기계에는 물건을 넣고, 뒤에 붙은 상자 · 기계에서는 물건을 꺼낸다.', { place: { obj: O.BELT } });
item('compressor', '압축기', '연료를 태워 재료 3개를 판 하나로 눌러 만든다. 화강암 · 안산암 · 철 · 금 · 구리.', { place: { obj: O.COMPRESSOR } });
item('roof', '지붕', '벽과 방 위를 덮는 천장. 밖에서는 안이 보이지 않고, 문을 열거나 안에 들어가면 비쳐 보인다.', { roof: true });
item('flag', '깃발', '세우고 색을 고르면 지도에 깃발로 표시된다. 멀리서도 화살표로 방향을 알려 준다.', { place: { obj: O.FLAG } });

// ── 도구 ──
const TIERS = [['wood', '나무', 1], ['stone', '돌', 2], ['iron', '철', 3]];
for (const [mat, ko, tier] of TIERS) {
  item(`${mat}_pickaxe`, `${ko} 곡괭이`, '돌과 광석을 캔다.', { stack: 1, tool: 'pick', tier });
  item(`${mat}_axe`, `${ko} 도끼`, '나무를 빠르게 벤다.', { stack: 1, tool: 'axe', tier });
  item(`${mat}_hoe`, `${ko} 괭이`, '풀밭이나 흙을 갈아 경작지로 만든다.', { stack: 1, tool: 'hoe', tier });
  item(`${mat}_sword`, `${ko} 검`, '동물을 사냥하는 무기. 맨손이나 다른 도구보다 훨씬 세다.', { stack: 1, tool: 'sword', tier });
  item(`${mat}_shovel`, `${ko} 삽`, '땅을 다져 길로 만든다. 누른 채 끌면 이어서 다져지고, 길을 누르면 다시 흙으로 돌아간다.', { stack: 1, tool: 'shovel', tier });
}
// 삽 등급별 한 칸 다지는 간격(초)
export const SHOVEL_COOL = [0.3, 0.26, 0.18, 0.11];

// 검 등급별 공격력. 다른 도구로 때리면 2, 맨손이나 그 밖의 물건으로는 1
export const SWORD_DMG = [1, 4, 5, 7];
export const attackDamage = (id) => { const it = ITEMS[id]; return it && it.tool === 'sword' ? SWORD_DMG[it.tier] : it && it.tool ? 2 : 1; };

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
R('wood_shovel', 1, { plank: 1, stick: 2 }, 'workbench', 'tool');
R('wood_sword', 1, { plank: 2, stick: 1 }, 'workbench', 'tool');
R('stone_pickaxe', 1, { stone: 3, stick: 2 }, 'workbench', 'tool');
R('stone_axe', 1, { stone: 3, stick: 2 }, 'workbench', 'tool');
R('stone_hoe', 1, { stone: 2, stick: 2 }, 'workbench', 'tool');
R('stone_shovel', 1, { stone: 1, stick: 2 }, 'workbench', 'tool');
R('stone_sword', 1, { stone: 2, stick: 1 }, 'workbench', 'tool');
R('iron_pickaxe', 1, { iron_ingot: 3, stick: 2 }, 'workbench', 'tool');
R('iron_axe', 1, { iron_ingot: 3, stick: 2 }, 'workbench', 'tool');
R('iron_hoe', 1, { iron_ingot: 2, stick: 2 }, 'workbench', 'tool');
R('iron_shovel', 1, { iron_ingot: 1, stick: 2 }, 'workbench', 'tool');
R('iron_sword', 1, { iron_ingot: 2, stick: 1 }, 'workbench', 'tool');

R('furnace', 1, { stone: 8 }, 'workbench', 'build');
R('chest', 1, { plank: 8 }, 'workbench', 'build');
R('wood_wall', 2, { plank: 2 }, 'workbench', 'build');
R('plank_floor', 4, { plank: 2 }, 'workbench', 'build');
R('stone_brick', 2, { stone: 2 }, 'workbench', 'build');
R('door', 1, { plank: 6 }, 'workbench', 'build');
R('roof', 4, { plank: 2 }, 'workbench', 'build');
R('bed', 1, { plank: 6, fiber: 8 }, 'workbench', 'build');
R('wool_bed', 1, { plank: 6, wool: 3 }, 'workbench', 'build');
R('fence', 4, { plank: 2, stick: 4 }, 'workbench', 'build');
R('fence_gate', 1, { plank: 2, stick: 2 }, 'workbench', 'build');
R('sign', 2, { plank: 3, stick: 1 }, 'workbench', 'build');

R('bread', 1, { wheat: 3 }, 'workbench', 'food');
R('gear', 1, { iron_ingot: 2 }, 'workbench', 'part');
R('copper_wire', 2, { copper_ingot: 1 }, 'workbench', 'part');
R('machine_frame', 1, { iron_ingot: 4, stone_brick: 2 }, 'workbench', 'part');
R('piston', 1, { iron_ingot: 2, stick: 2 }, 'workbench', 'part');

// 공장: 벨트의 띠는 풀섬유를 엮거나(4개) 가죽으로(8개) 만든다
R('belt', 4, { iron_ingot: 1, gear: 1, fiber: 6 }, 'workbench', 'factory');
R('belt', 8, { iron_ingot: 1, gear: 1, leather: 2 }, 'workbench', 'factory');
// 압축기 = 뼈대 + 누르는 피스톤 + 힘을 전하는 톱니바퀴 + 불을 때는 화로 + 구리선
R('compressor', 1, { machine_frame: 1, piston: 1, gear: 2, copper_wire: 4, furnace: 1 }, 'workbench', 'factory');

export const CATEGORY_NAMES = { basic: '기본', tool: '도구', build: '건축', food: '음식', part: '부품', factory: '공장' };

// ── 화로 ──
export const SMELT = {
  iron_ore: { out: 'iron_ingot', time: 8 },
  copper_ore: { out: 'copper_ingot', time: 8 },
  gold_ore: { out: 'gold_ingot', time: 10 },
  log: { out: 'charcoal', time: 5 },
  mushroom: { out: 'baked_mushroom', time: 4 },
};

// ── 압축기 ── (재료 n개를 눌러 판 하나로. 화로처럼 연료가 필요하다)
export const PRESS = {
  granite: { out: 'granite_plate', n: 3, time: 6 },
  andesite: { out: 'andesite_plate', n: 3, time: 6 },
  iron_ingot: { out: 'iron_plate', n: 3, time: 8 },
  gold_ingot: { out: 'gold_plate', n: 3, time: 8 },
  copper_ingot: { out: 'copper_plate', n: 3, time: 8 },
};
// 연료를 태워 재료를 바꾸는 기계: 종류 → 조합법 (칸은 [재료, 연료, 결과])
export const MACHINE = { furnace: SMELT, compressor: PRESS };

export const itemName = (id) => (ITEMS[id] ? ITEMS[id].name : id);
