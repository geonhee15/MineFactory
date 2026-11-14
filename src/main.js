// 마인 팩토리 — 진입점
import { TILE, MAP_W, MAP_H } from './config.js';
import { buildSprites } from './gfx/sprites.js';
import { Renderer } from './gfx/render.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { UI } from './ui.js';
import { Game } from './game.js';
import { loadSave, shelve, backup, writeSave, serialize } from './save.js';

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

// 파비콘도 도트로
{
  const link = document.createElement('link');
  link.rel = 'icon'; link.href = atlas.url('i_iron_pickaxe');
  document.head.append(link);
}

const randomSeed = () => (Math.random() * 0xffffffff) >>> 0;
function parseSeed(str) {
  if (!str) return randomSeed();
  if (/^\d+$/.test(str)) return Number(str) >>> 0;
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return h >>> 0;
}

let save = null;
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
// 타이틀 화면으로: 배경용 세계를 새로 만들고 저장 상태를 다시 읽는다
async function toTitle(keepWorld) {
  ui.togglePause(false);
  game.state = 'title';
  if (!keepWorld) { game.newWorld(randomSeed()); freshWorld = true; }
  game.layer = 0;           // 타이틀 배경은 항상 지상
  save = await loadSave();
  audio.setScene('title');
  ui.showTitle(!!save);
}

ui.on.new = (seedStr) => {
  const go = async () => {
    // 이전 세계는 지우지 않고 백업으로 옮겨 둔다 (세이브 관리에서 되돌릴 수 있다)
    if (save) { try { await shelve('new'); } catch (e) { console.warn(e); } save = null; }
    // 시드를 지정하지 않았다면 타이틀 화면에 보이던 바로 그 세계에서 시작한다
    if (seedStr || !freshWorld) {
      ui.loading(true);
      await new Promise((r) => setTimeout(r, 30));
      game.newWorld(parseSeed(seedStr));
      ui.loading(false);
    }
    startPlay();
    ui.banner('마인 팩토리');
    ui.toast('나무에 마우스를 대고 길게 눌러 보세요', 'good');
    game.save();
  };
  if (save) ui.confirm('저장된 세계가 있어요. 새로 시작할까요?<br>이전 세계는 백업으로 옮겨 두니, <b>세이브 관리</b>에서 되돌릴 수 있어요.', go);
  else go();
};
ui.on.continue = () => {
  if (!save) return;
  game.loadFrom(save);
  startPlay();
  ui.banner(`${game.day}일차`);
};
ui.on.title = async () => {
  if (game.net.isGuest) { await game.save(); game.net.leave(); return toTitle(false); }
  if (game.net.on) game.net.closeRoom();
  await game.save();
  save = serialize(game);
  return toTitle(true);
};
// 백업이나 세이브 파일로 되돌리기. 지금 세이브는 먼저 백업으로 옮긴다
ui.on.restore = async (data, reason) => {
  try {
    if (game.state === 'play' && game.net.on) { if (game.net.isGuest) game.net.leave(); else game.net.closeRoom(); }
    const cur = await loadSave();
    if (cur) await backup(cur, reason);
    await writeSave(data);
    save = data;
    game.loadFrom(data);
    ui.togglePause(false);
    startPlay();
    ui.banner(`${game.day}일차`);
    ui.toast('세계를 불러왔어요', 'good');
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
  save = await loadSave();
  game.newWorld(randomSeed());
  freshWorld = true;
  game.state = 'title';
  ui.showTitle(!!save);
  // 초대 링크(?join=코드)로 들어왔으면 참가 창을 바로 띄운다
  const code = new URLSearchParams(location.search).get('join');
  if (code) { ui.showPanel('join'); ui.$('j-code').value = code.toUpperCase().slice(0, 6); }
  requestAnimationFrame(frame);
})();
