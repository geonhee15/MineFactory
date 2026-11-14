// 바닥(지형) 타일 정의
export const G = {
  NONE: 0, GRASS: 1, DIRT: 2, SAND: 3, WATER: 4, DEEP: 5,
  STONE: 6, FARM: 7, CAVE: 8, PLANK: 9, GRAVEL: 10, PATH: 11,
};

export const GROUND = [];
const def = (id, d) => { GROUND[id] = { id, n: 1, walk: true, edge: true, frames: 0, ...d }; };

// prio: 높은 쪽이 낮은 쪽 타일 위로 가장자리를 덮는다
def(G.NONE, { name: '', spr: null, prio: -1, walk: false, edge: false, color: 0x000000 });
// pave: 삽으로 다져서 길로 만들 수 있는 땅
def(G.GRASS, { name: '풀밭', spr: 'g_grass', n: 4, prio: 60, color: 0x62b246, step: 'grass', till: true, soil: true, pave: true });
def(G.DIRT, { name: '흙', spr: 'g_dirt', n: 3, prio: 40, color: 0x9c6b43, step: 'dirt', till: true, soil: true, pave: true });
def(G.SAND, { name: '모래', spr: 'g_sand', n: 3, prio: 30, color: 0xe6cf8e, step: 'sand', pave: true });
def(G.WATER, { name: '물', spr: 'g_water', n: 2, frames: 4, prio: 10, walk: false, color: 0x3d8ed4, water: true });
def(G.DEEP, { name: '깊은 물', spr: 'g_deep', n: 2, frames: 4, prio: 5, walk: false, color: 0x2a66b3, water: true });
def(G.STONE, { name: '돌바닥', spr: 'g_stone', n: 3, prio: 50, color: 0x8a8f99, step: 'stone' });
def(G.FARM, { name: '경작지', spr: 'g_farm', n: 2, prio: 20, color: 0x6e4a2e, step: 'dirt', pave: true });
def(G.CAVE, { name: '동굴 바닥', spr: 'g_cave', n: 4, prio: 45, color: 0x4d4654, step: 'stone' });
def(G.PLANK, { name: '나무 바닥', spr: 'g_plank', n: 2, prio: 99, edge: false, color: 0xb8894f, step: 'wood' });
def(G.GRAVEL, { name: '자갈', spr: 'g_gravel', n: 3, prio: 35, color: 0x6a6470, step: 'stone', pave: true });
// 삽으로 다진 길. 풀밭보다 낮아서 풀이 가장자리를 살짝 덮는다
def(G.PATH, { name: '길', spr: 'g_path', n: 3, prio: 42, color: 0xc7a878, step: 'dirt' });
