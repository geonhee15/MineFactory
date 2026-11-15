// 저장: IndexedDB(브라우저 저장소) + 자동 백업 + 파일 내보내기/불러오기 + 손님 프로필
// 타일 배열이 커서(수 MB) 쿠키나 localStorage가 아니라 IndexedDB를 쓴다.
import { SAVE_VERSION, MAP_W, MAP_H, DAY_LENGTH } from './config.js';
import { World } from './world/world.js';

const DB = 'minefactory', STORE = 'saves';
// 주소에 ?slot=이름 을 붙이면 다른 저장 칸을 쓴다 (테스트할 때 실제 저장을 덮어쓰지 않도록)
export const SLOT = new URLSearchParams(location.search).get('slot') || 'slot1';
const INDEX = SLOT + ':index';
const N = MAP_W * MAP_H;
const ARR = ['ground', 'obj', 'meta', 'seen', 'roof'];
const MAX_BACKUPS = 6;                 // 백업은 최근 6개까지 보관
const BACKUP_EVERY = 10 * 60 * 1000;   // 자동 백업 간격(10분)

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
    t.onabort = () => { db.close(); rej(t.error); };
  });
}
const get = (k) => tx('readonly', (s) => s.get(k));
const put = (k, v) => tx('readwrite', (s) => s.put(v, k));
const del = (k) => tx('readwrite', (s) => s.delete(k));

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const dayOf = (d) => Math.floor((d.time || 0) / DAY_LENGTH) + 1;

// ── 게임 ↔ 저장 데이터 ──────────────────────────────────────
export function serialize(game) {
  const w = game.world;
  const ent = (e) => (e.type === 'furnace'
    ? { type: e.type, slots: e.slots, burn: e.burn, burnMax: e.burnMax, prog: e.prog }
    : { type: e.type, slots: e.slots });
  return {
    v: SAVE_VERSION, savedAt: Date.now(),
    id: w.id, seed: w.seed, time: game.time, layer: game.layer, hotbar: game.hotbar, quest: game.quest,
    player: { x: game.player.x, y: game.player.y, dir: game.player.dir, hunger: game.player.hunger },
    inv: game.inv.slots, stats: game.stats,
    layers: w.layers, ents: w.ents.map((m) => [...m].map(([i, e]) => [i, ent(e)])), grow: w.grow.map((m) => [...m]),
    entrances: w.entrances, spawn: w.spawn,
    drops: game.drops.map((d) => ({ id: d.id, n: d.n, x: d.x, y: d.y, layer: d.layer, age: d.age })),
    mobs: game.mobs.serialize(),        // 동물 [종류, x, y, 체력]
  };
}

export function restoreWorld(data) {
  const w = new World(data.seed);
  w.id = data.id || newId();
  for (let l = 0; l < 2; l++) {
    for (const k of ARR) if (data.layers[l][k]) w.layers[l][k].set(data.layers[l][k]);
    w.ents[l] = new Map(data.ents[l]);
    w.grow[l] = new Map(data.grow[l]);
  }
  w.entrances = data.entrances; w.spawn = data.spawn;
  w.rescan();
  return w;
}

// ── 현재 세이브 ─────────────────────────────────────────────
let lastBackup = 0;
export async function writeSave(data) {
  await put(SLOT, data);
  protect();
  if (!lastBackup) { const idx = await listBackups(); lastBackup = idx.length ? idx[0].at : 1; }
  if (Date.now() - lastBackup > BACKUP_EVERY) await backup(data, 'auto');
}
export const saveGame = (game) => writeSave(serialize(game));
export async function loadSave() {
  try {
    const d = await get(SLOT);
    return d && d.v === SAVE_VERSION ? d : null;
  } catch (e) { console.warn('저장 데이터를 읽지 못했습니다', e); return null; }
}
export const deleteSave = () => del(SLOT);

// ── 백업 ───────────────────────────────────────────────────
// reason: 'auto'(자동) | 'new'(새 게임 시작 전) | 'restore'(되돌리기 전) | 'import'(파일 불러오기 전)
export async function backup(data, reason = 'auto') {
  if (!data) return;
  const at = Date.now(), key = `${SLOT}:bak:${at}`;
  await put(key, data);
  const idx = (await get(INDEX)) || [];
  idx.unshift({ key, at, savedAt: data.savedAt || at, day: dayOf(data), reason });
  while (idx.length > MAX_BACKUPS) { const old = idx.pop(); await del(old.key); }
  await put(INDEX, idx);
  lastBackup = at;
}
export async function listBackups() { try { return (await get(INDEX)) || []; } catch { return []; } }
export const loadBackup = (key) => get(key);
// 지금 세이브를 지우기 전에 백업으로 옮긴다
export async function shelve(reason) {
  const cur = await loadSave();
  if (cur) await backup(cur, reason);
  await deleteSave();
}

// ── 브라우저가 멋대로 지우지 못하게 ───────────────────────────
let asked = false;
export function protect() {
  if (asked || !navigator.storage || !navigator.storage.persist) return;
  asked = true;
  navigator.storage.persist().catch(() => {});
}
export async function storageInfo() {
  const st = navigator.storage;
  let persisted = false, usage = 0;
  try { persisted = !!(st && st.persisted && (await st.persisted())); } catch { /* 지원 안 함 */ }
  try { const e = st && st.estimate ? await st.estimate() : null; usage = e ? e.usage || 0 : 0; } catch { /* 지원 안 함 */ }
  return { persisted, usage };
}

// ── 파일 형식(.mfsave): 'MFSV' + 헤더(JSON) + 타일 배열들, 전체를 gzip ──
export function pack(data) {
  const head = { ...data, layers: null, n: N, arr: ARR };
  const hj = new TextEncoder().encode(JSON.stringify(head));
  const out = new Uint8Array(12 + hj.length + 2 * ARR.length * N);
  out.set([0x4d, 0x46, 0x53, 0x56]);
  const dv = new DataView(out.buffer);
  dv.setUint32(4, 1); dv.setUint32(8, hj.length);
  out.set(hj, 12);
  let o = 12 + hj.length;
  for (let l = 0; l < 2; l++) for (const k of ARR) { const a = data.layers[l][k]; if (a) out.set(a, o); o += N; }
  return out;
}
export function unpack(bytes) {
  if (bytes.length < 12 || bytes[0] !== 0x4d || bytes[1] !== 0x46 || bytes[2] !== 0x53 || bytes[3] !== 0x56) throw new Error('format');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const hl = dv.getUint32(8);
  const head = JSON.parse(new TextDecoder().decode(bytes.subarray(12, 12 + hl)));
  const arr = head.arr || ARR;
  if (head.n !== N || bytes.length < 12 + hl + 2 * arr.length * N) throw new Error('size');
  const layers = [{}, {}];
  let o = 12 + hl;
  for (let l = 0; l < 2; l++) for (const k of arr) { layers[l][k] = bytes.slice(o, o + N); o += N; }
  delete head.n; delete head.arr;
  return { ...head, layers };
}
async function pipe(bytes, ts) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(ts)).arrayBuffer());
}
export const gzip = (b) => (typeof CompressionStream === 'function' ? pipe(b, new CompressionStream('gzip')) : Promise.resolve(b));
export const gunzip = (b) => (b[0] === 0x1f && b[1] === 0x8b ? pipe(b, new DecompressionStream('gzip')) : Promise.resolve(b));
export function b64enc(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function b64dec(str) {
  const s = atob(str), out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function exportBlob(data) { return new Blob([await gzip(pack(data))], { type: 'application/octet-stream' }); }
export async function importFile(file) {
  const data = unpack(await gunzip(new Uint8Array(await file.arrayBuffer())));
  if (data.v !== SAVE_VERSION || !Array.isArray(data.inv) || !data.player) throw new Error('version');
  return data;
}
export function fileName(data) {
  const d = new Date(data.savedAt || Date.now()), p = (n) => String(n).padStart(2, '0');
  return `MineFactory-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}-day${dayOf(data)}.mfsave`;
}

// ── 멀티플레이 손님: 남의 세계에서의 내 가방·진행도 ─────────────
export const saveProfile = (worldId, profile) => put(`guest:${worldId}`, profile);
export async function loadProfile(worldId) { try { return (await get(`guest:${worldId}`)) || null; } catch { return null; } }
