// 마인 팩토리 — 진입점
import { TILE, MAP_W, MAP_H } from './config.js';
import { buildSprites } from './gfx/sprites.js';
import { Renderer } from './gfx/render.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { UI } from './ui.js';
import { Game } from './game.js';
import { listWorlds, createWorld, setWorld, loadWorld, backup, writeSave } from './save.js';

const canvas = document.getElementById('game');
const atlas = buildSprites();
const audio = new AudioSys();
const input = new Input(canvas);
const ui = new UI(document.getElementById('ui'), atlas, audio);
const game = new Game({ audio, input, ui });
const renderer = new Renderer(canvas, atlas);
game.renderer = renderer;
ui.attach(game, renderer);
window.MF = { game, renderer, ui, audio, atlas };   // 콘솔 디버깅용

const randomSeed = () => (Math.random() * 0xffffffff) >>> 0;
function parseSeed(str) {
  if (!str) return randomSeed();
  if (/^\d+$/.test(str)) return Number(str) >>> 0;
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return h >>> 0;
}

let worlds = [];           // 저장된 세계 목록 (최근에 플레이한 것이 앞)
let freshWorld = false;   // 타이틀 배경으로 만든, 아직 플레이하지 않은 세계인가
let titleAngle = Math.random() * 6.28;

// 첫 입력에서 오디오 잠금 해제
const unlock = () => { audio.unlock(); if (game.state === 'title') audio.setScene('title'); };
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

function startPlay() {
  freshWorld = false;
  game.state = 'play'; game.paused = false; game.scene = '';
  ui.hideTitle();
  game.updateSeen();
}
// 타이틀 화면으로: 배경용 세계를 새로 만들고 세계 목록을 다시 읽는다
async function toTitle(keepWorld) {
  ui.togglePause(false);
  game.state = 'title';
  if (!keepWorld) { game.newWorld(randomSeed()); freshWorld = true; }
  game.layer = 0;           // 타이틀 배경은 항상 지상
  worlds = await listWorlds();
  audio.setScene('title');
  ui.showTitle(worlds);
}
// 멀티플레이 중이면 먼저 방에서 나온다
const leaveRoom = () => { if (game.state === 'play' && game.net.on) { if (game.net.isGuest) game.net.leave(); else game.net.closeRoom(); } };

// 새 세계: 이름을 붙여 목록에 올리고 시작한다. 다른 세계는 그대로 남는다
ui.on.new = async (name, seedStr) => {
  ui.loading(true);
  await new Promise((r) => setTimeout(r, 30));
  try {
    // 시드를 지정하지 않았다면 타이틀 화면에 보이던 바로 그 세계에서 시작한다
    if (seedStr || !freshWorld) game.newWorld(parseSeed(seedStr));
    const w = await createWorld(name, game.world.seed);
    setWorld(w.key); game.worldName = w.name;
    startPlay();
    ui.banner(w.name);
    ui.toast('나무에 마우스를 대고 길게 눌러 보세요', 'good');
    await game.save();
  } catch (e) { console.warn(e); ui.toast('세계를 만들지 못했어요'); }
  ui.loading(false);
};
// 저장된 세계를 골라 플레이
ui.on.play = async (key) => {
  const w = (await listWorlds()).find((x) => x.key === key), d = await loadWorld(key);
  if (!w || !d) { ui.toast('이 세계를 불러오지 못했어요'); return; }
  setWorld(key);
  game.loadFrom(d); game.worldName = w.name;
  startPlay();
  ui.banner(`${w.name} · ${game.day}일차`);
};
ui.on.continue = () => { if (worlds.length) ui.on.play(worlds[0].key); };
ui.on.worldsChanged = async () => { worlds = await listWorlds(); if (game.state === 'title') ui.showTitle(worlds); };
ui.on.title = async () => {
  if (game.net.isGuest) { await game.save(); game.net.leave(); return toTitle(false); }
  if (game.net.on) game.net.closeRoom();
  await game.save();
  return toTitle(true);
};
// 백업으로 되돌리기: 그 세계의 지금 세이브는 먼저 백업으로 옮긴다
ui.on.restore = async (key, data) => {
  try {
    leaveRoom();
    const w = (await listWorlds()).find((x) => x.key === key);
    if (!w) throw new Error('world');
    const cur = await loadWorld(key);
    if (cur) await backup(cur, 'restore', key);
    data.name = w.name;
    await writeSave(data, key);
    setWorld(key);
    game.loadFrom(data); game.worldName = w.name;
    ui.togglePause(false);
    startPlay();
    ui.banner(`${w.name} · ${game.day}일차`);
    ui.toast('백업으로 되돌렸어요', 'good');
  } catch (e) { console.warn(e); ui.toast('되돌리지 못했어요'); }
};
// 세이브 파일 불러오기: 새 세계로 목록에 더한다 (다른 세계를 덮어쓰지 않는다)
ui.on.import = async (data) => {
  try {
    if (game.state === 'play') await game.save();
    leaveRoom();
    const w = await createWorld(data.name || '불러온 세계', data.seed);
    data.name = w.name;
    await writeSave(data, w.key);
    setWorld(w.key);
    game.loadFrom(data); game.worldName = w.name;
    ui.togglePause(false);
    startPlay();
    ui.banner(`${w.name} · ${game.day}일차`);
    ui.toast('세이브 파일을 새 세계로 불러왔어요', 'good');
  } catch (e) { console.warn(e); ui.toast('불러오지 못했어요'); }
};
// 친구 방에 참가
ui.on.join = async (name, code) => {
  game.net.setName(name);
  ui.joinStatus('방장에게 연결하는 중…');
  try {
    await game.net.join(code, (p) => ui.joinStatus(`세계를 받는 중… ${Math.round(p * 100)}%`));
    startPlay();
    ui.banner('친구의 세계');
    ui.toast('방에 들어왔어요. Enter 키로 대화할 수 있어요', 'good');
    game.save();
  } catch (e) { console.warn('참가 실패', e); ui.joinFailed(e); }
};
game.onDisconnected = () => {
  ui.toast('방장과의 연결이 끊어졌어요. 내 가방은 저장했어요');
  toTitle(false);
};

document.addEventListener('visibilitychange', () => { if (document.hidden) game.save(); });
window.addEventListener('beforeunload', () => { game.save(); if (game.net.isGuest) game.net.leave(); else game.net.closeRoom(); });

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  ui.handleKeys(input);
  if (input.hit('Minus')) renderer.setZoom(-1);
  if (input.hit('Equal')) renderer.setZoom(1);
  if (game.state === 'title' && game.world) {
    // 타이틀 배경: 시작 지점 주변을 천천히 돈다
    titleAngle += dt * 0.04;
    const s = game.world.spawn;
    renderer.cam.x = Math.max(0, Math.min(MAP_W * TILE, s.x * TILE + Math.cos(titleAngle) * 150));
    renderer.cam.y = Math.max(0, Math.min(MAP_H * TILE, s.y * TILE + Math.sin(titleAngle * 1.3) * 110));
  }
  game.update(dt);
  renderer.render(game, dt);
  ui.update(dt);
  input.endFrame();
  requestAnimationFrame(frame);
}

(async function boot() {
  worlds = await listWorlds();
  game.newWorld(randomSeed());
  freshWorld = true;
  game.state = 'title';
  ui.showTitle(worlds);
  // 초대 링크(?join=코드)로 들어왔으면 참가 창을 바로 띄운다
  const code = new URLSearchParams(location.search).get('join');
  if (code) { ui.showPanel('join'); ui.$('j-code').value = code.toUpperCase().slice(0, 6); }
  requestAnimationFrame(frame);
})();
