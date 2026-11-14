// IndexedDB 저장/불러오기 (타일 배열이 커서 localStorage 대신 사용)
import { SAVE_VERSION } from './config.js';
import { World } from './world/world.js';

const DB = 'minefactory', STORE = 'saves';
// 주소에 ?slot=이름 을 붙이면 다른 저장 칸을 쓴다 (테스트할 때 실제 저장을 덮어쓰지 않도록)
const KEY = new URLSearchParams(location.search).get('slot') || 'slot1';

function open() {
  return new Promise((res, rej) => {
    const rq = indexedDB.open(DB, 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore(STORE);
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}
async function tx(mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const rq = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); res(rq.result); };
    t.onerror = () => { db.close(); rej(t.error); };
  });
}

export function serialize(game) {
  const w = game.world;
  return {
    v: SAVE_VERSION, savedAt: Date.now(),
    seed: w.seed, time: game.time, layer: game.layer, hotbar: game.hotbar, quest: game.quest,
    player: { x: game.player.x, y: game.player.y, dir: game.player.dir, hunger: game.player.hunger },
    inv: game.inv.slots, stats: game.stats,
    layers: w.layers, ents: w.ents.map((m) => [...m]), grow: w.grow.map((m) => [...m]),
    entrances: w.entrances, spawn: w.spawn, drops: game.drops,
  };
}

export function restoreWorld(data) {
  const w = new World(data.seed);
  for (let l = 0; l < 2; l++) {
    for (const k of ['ground', 'obj', 'meta', 'seen', 'roof']) if (data.layers[l][k]) w.layers[l][k].set(data.layers[l][k]);
    w.ents[l] = new Map(data.ents[l]);
    w.grow[l] = new Map(data.grow[l]);
  }
  w.entrances = data.entrances; w.spawn = data.spawn;
  w.rescan();
  return w;
}

export const saveGame = (game) => tx('readwrite', (s) => s.put(serialize(game), KEY));
export async function loadSave() {
  try {
    const d = await tx('readonly', (s) => s.get(KEY));
    return d && d.v === SAVE_VERSION ? d : null;
  } catch (e) { console.warn('저장 데이터를 읽지 못했습니다', e); return null; }
}
export const deleteSave = () => tx('readwrite', (s) => s.delete(KEY));
