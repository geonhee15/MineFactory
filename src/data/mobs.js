// 동물 정의
//  hp 체력 · speed 걷는 속도(px/초) · hw 몸 반폭(충돌) · w, h 그림 크기(가리킬 때 쓰는 범위)
//  drops [아이템, 최소, 최대, 확률] · herd 한 무리의 마릿수 · voice 울음소리 · pcol 맞았을 때 튀는 색
//  push 사람에게 떠밀릴 때의 가장 빠른 속도(px/초). 무거울수록 느리다 (사람은 72로 걷는다)
//  lure 좋아하는 먹이: 가까이에서 이것을 손에 들고 있는 사람을 따라온다 (아이템 목록, 또는 'seed' = 씨앗류)
import { ITEMS } from './items.js';

export const MOBS = {
  cow: {
    name: '소', hp: 10, speed: 14, hw: 6, w: 22, h: 17, herd: [2, 4], voice: 'moo', lure: ['wheat'], push: 44,
    drops: [['beef', 1, 3], ['leather', 1, 2, 0.5]], pcol: [0xf4f1e8, 0x2f2a35, 0xd2ccbd],
  },
  pig: {
    name: '돼지', hp: 8, speed: 16, hw: 5, w: 18, h: 13, herd: [2, 4], voice: 'oink', lure: ['carrot'], push: 58,
    drops: [['pork', 1, 3]], pcol: [0xf2a3ab, 0xd9808e, 0xffc4c8],
  },
  sheep: {
    name: '양', hp: 8, speed: 15, hw: 5, w: 20, h: 15, herd: [2, 4], voice: 'baa', lure: ['wheat'], push: 58,
    drops: [['mutton', 1, 2], ['wool', 1, 2, 0.6]], pcol: [0xf6f2e6, 0xd6cfbd, 0xffffff],
  },
  chicken: {
    name: '닭', hp: 4, speed: 19, hw: 3, w: 13, h: 12, herd: [3, 5], voice: 'cluck', lure: 'seed', push: 76,
    drops: [['chicken', 1, 1], ['feather', 1, 2, 0.5], ['egg', 1, 1, 0.3]], pcol: [0xfbf8f0, 0xd9d3c2, 0xe2504a],
  },
};
export const MOB_KEYS = Object.keys(MOBS);
// 이 동물이 이 아이템을 든 사람을 따라오는가. 씨앗류 = 심는 것 가운데 먹을 것이 아닌 것 (당근은 돼지의 몫)
export const lures = (k, id) => {
  const l = MOBS[k].lure, it = ITEMS[id];
  if (!l || !it) return false;
  return l === 'seed' ? !!it.seed && !it.food : l.includes(id);
};
