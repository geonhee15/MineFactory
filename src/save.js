// 저장: IndexedDB(브라우저 저장소) + 세계 여러 개 + 세계마다 자동 백업 + 파일 내보내기/불러오기 + 손님 프로필
// 타일 배열이 커서(수 MB) 쿠키나 localStorage가 아니라 IndexedDB를 쓴다.
//
// 저장소의 열쇠(key):
//   <SLOT>:worlds        세계 목록 [{ key, name, createdAt, savedAt, day, seed }]
//   <세계 key>           그 세계의 지금 세이브   (새 세계는 '<SLOT>:w:<번호>', 세계가 하나뿐이던 때의 세이브는 '<SLOT>' 그대로)
//   <세계 key>:index     그 세계의 백업 목록
//   <세계 key>:bak:<시각> 백업 하나
//   guest:<세계 id>      멀티플레이 손님으로 들어간 남의 세계에서의 내 가방 · 진행도
import { SAVE_VERSION, MAP_W, MAP_H, DAY_LENGTH } from './config.js';
import { World } from './world/world.js';
import { MOB_VERSION } from './mobs.js';

const DB = 'minefactory', STORE = 'saves';
// 주소에 ?slot=이름 을 붙이면 다른 저장 칸을 쓴다 (테스트할 때 실제 저장을 덮어쓰지 않도록)
export const SLOT = new URLSearchParams(location.search).get('slot') || 'slot1';
const WORLDS = SLOT + ':worlds';
const N = MAP_W * MAP_H;
const ARR = ['ground', 'obj', 'meta', 'seen', 'roof', 'rot'];
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
  const ent = (e) => (e.type !== 'chest'      // 화로 · 압축기
    ? { type: e.type, slots: e.slots, burn: e.burn, burnMax: e.burnMax, prog: e.prog }
    : { type: e.type, slots: e.slots });
  return {
    v: SAVE_VERSION, savedAt: Date.now(), name: game.worldName || '',
    id: w.id, seed: w.seed, time: game.time, layer: game.layer, hotbar: game.hotbar, quest: game.quest,
    player: { x: game.player.x, y: game.player.y, dir: game.player.dir, hunger: game.player.hunger, groggy: game.player.groggy, bed: game.player.bed },
    inv: game.inv.slots, stats: game.stats,
    layers: w.layers, ents: w.ents.map((m) => [...m].map(([i, e]) => [i, ent(e)])), grow: w.grow.map((m) => [...m]),
    entrances: w.entrances, spawn: w.spawn,
    drops: game.drops.map((d) => ({ id: d.id, n: d.n, x: d.x, y: d.y, layer: d.layer, age: d.age })),
    mobs: game.mobs.serialize(),        // 동물 [종류, x, y, 체력]
    mobV: MOB_VERSION,                  // 동물 수 규칙의 버전
    signs: w.signs.map((m) => [...m]),  // 표지판 글 [idx, 글]
    oreV: w.oreV,                       // 광맥을 만든 규칙의 버전
  };
}

export function restoreWorld(data) {
  const w = new World(data.seed);
  w.id = data.id || newId();
  for (let l = 0; l < 2; l++) {
    for (const k of ARR) if (data.layers[l][k]) w.layers[l][k].set(data.layers[l][k]);
    w.ents[l] = new Map(data.ents[l]);
    w.grow[l] = new Map(data.grow[l]);
    w.signs[l] = new Map(((data.signs && data.signs[l]) || []).filter((e) => Array.isArray(e) && typeof e[1] === 'string'));
  }
  w.entrances = data.entrances; w.spawn = data.spawn;
  w.rescan();
  return w;
}

// ── 세계 목록 ───────────────────────────────────────────────
let CUR = null;          // 지금 플레이하는 세계의 key (저장은 여기에 한다)
let lastBackup = 0;
export const currentWorld = () => CUR;
export function setWorld(key) { CUR = key; lastBackup = 0; }
const cleanName = (n, fallback) => String(n ?? '').replace(/\s+/g, ' ').trim().slice(0, 20) || fallback;
// 최근에 플레이한 세계가 앞에 온다
export async function listWorlds() {
  let list = null;
  try { list = await get(WORLDS); } catch (e) { console.warn('세계 목록을 읽지 못했습니다', e); return []; }
  if (!Array.isArray(list)) {
    // 세계가 하나뿐이던 때의 세이브가 있으면, 옮기거나 고치지 않고 그 자리 그대로 첫 세계로 올린다
    list = [];
    const old = await get(SLOT);
    if (old && old.v === SAVE_VERSION) {
      const at = old.savedAt || Date.now();
      list.push({ key: SLOT, name: cleanName(old.name, '나의 첫 세계'), createdAt: at, savedAt: at, day: dayOf(old), seed: old.seed });
    }
    await put(WORLDS, list);
  }
  return list.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
}
export async function createWorld(name, seed) {
  const list = await listWorlds(), at = Date.now();
  const w = { key: `${SLOT}:w:${newId()}`, name: cleanName(name, `세계 ${list.length + 1}`), createdAt: at, savedAt: at, day: 1, seed };
  list.unshift(w);
  await put(WORLDS, list);
  return w;
}
export async function renameWorld(key, name) {
  const list = await listWorlds(), w = list.find((x) => x.key === key);
  if (!w) return null;
  w.name = cleanName(name, w.name);
  await put(WORLDS, list);
  return w;
}
// 세계와 그 백업을 모두 지운다 (되돌릴 수 없다 — 부르기 전에 꼭 확인을 받는다)
export async function deleteWorld(key) {
  const list = await listWorlds(), k = list.findIndex((x) => x.key === key);
  if (k < 0) return;
  for (const b of await listBackups(key)) await del(b.key);
  await del(key + ':index');
  await del(key);
  list.splice(k, 1);
  await put(WORLDS, list);
  if (CUR === key) CUR = null;
}
async function touchWorld(key, data) {
  const list = await listWorlds(), w = list.find((x) => x.key === key);
  if (!w) return;
  w.savedAt = data.savedAt || Date.now(); w.day = dayOf(data); w.seed = data.seed;
  await put(WORLDS, list);
}

// ── 세이브 ──────────────────────────────────────────────────
export async function writeSave(data, key = CUR) {
  if (!key) return;                      // 고른 세계가 없으면(손님으로만 놀았다든지) 저장할 곳이 없다
  await put(key, data);
  await touchWorld(key, data);
  protect();
  if (key !== CUR) return;
  if (!lastBackup) { const idx = await listBackups(key); lastBackup = idx.length ? idx[0].at : 1; }
  if (Date.now() - lastBackup > BACKUP_EVERY) await backup(data, 'auto', key);
}
export const saveGame = (game) => writeSave(serialize(game));
export async function loadWorld(key) {
  try {
    const d = key ? await get(key) : null;
    return d && d.v === SAVE_VERSION ? d : null;
  } catch (e) { console.warn('저장 데이터를 읽지 못했습니다', e); return null; }
}

// ── 백업 (세계마다 따로) ──────────────────────────────────────
// reason: 'auto'(자동) | 'restore'(되돌리기 전) | 'new' · 'import'(예전 방식: 새 게임 · 파일 불러오기로 덮어쓰기 전)
export async function backup(data, reason = 'auto', key = CUR) {
  if (!data || !key) return;
  const at = Date.now(), bk = `${key}:bak:${at}`;
  await put(bk, data);
  const idx = (await get(key + ':index')) || [];
  idx.unshift({ key: bk, at, savedAt: data.savedAt || at, day: dayOf(data), reason });
  while (idx.length > MAX_BACKUPS) { const old = idx.pop(); await del(old.key); }
  await put(key + ':index', idx);
  if (key === CUR) lastBackup = at;
}
export async function listBackups(key = CUR) { try { return (key && (await get(key + ':index'))) || []; } catch { return []; } }
export const loadBackup = (key) => get(key);

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
  const nm = String(data.name || '').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 20);
  return `MineFactory-${nm ? nm + '-' : ''}${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}-day${dayOf(data)}.mfsave`;
}

// ── 멀티플레이 손님: 남의 세계에서의 내 가방·진행도 ─────────────
export const saveProfile = (worldId, profile) => put(`guest:${worldId}`, profile);
export async function loadProfile(worldId) { try { return (await get(`guest:${worldId}`)) || null; } catch { return null; } }
