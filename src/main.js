// 마인 팩토리 — 진입점
import { TILE, MAP_W, MAP_H } from './config.js';
import { buildSprites } from './gfx/sprites.js';
import { Renderer } from './gfx/render.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { UI } from './ui.js';
import { Game } from './game.js';
import { loadSave, deleteSave, serialize } from './save.js';

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

ui.on.new = (seedStr) => {
  const go = async () => {
    if (save) { try { await deleteSave(); } catch (e) { console.warn(e); } save = null; }
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
  if (save) ui.confirm('저장된 세계가 있어요.<br>새로 시작하면 이전 세계는 사라집니다.', go);
  else go();
};
ui.on.continue = () => {
  if (!save) return;
  game.loadFrom(save);
  startPlay();
  ui.banner(`${game.day}일차`);
};
ui.on.title = async () => {
  await game.save();
  save = serialize(game);
  ui.togglePause(false);
  game.state = 'title';
  game.layer = 0;           // 타이틀 배경은 항상 지상
  audio.setScene('title');
  ui.showTitle(true);
};

document.addEventListener('visibilitychange', () => { if (document.hidden) game.save(); });
window.addEventListener('beforeunload', () => { game.save(); });

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
  requestAnimationFrame(frame);
})();
