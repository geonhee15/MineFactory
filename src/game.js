// 게임 상태와 규칙: 이동, 채굴, 설치, 농사, 화로, 동굴 이동
import { TILE, MAP_W, MAP_H, SURFACE, CAVE, DAY_LENGTH, REACH, INV_SIZE, HOTBAR, WALL_LIFT, ROOF_LIFT } from './config.js';
import { G, GROUND } from './data/ground.js';
import { O, OBJ, SAPLING_TREES } from './data/objects.js';
import { ITEMS, TOOL_SPEED, SHOVEL_COOL, SMELT, attackDamage } from './data/items.js';
import { MOBS } from './data/mobs.js';
import { World } from './world/world.js';
import { generate } from './world/gen.js';
import { Inventory, maxStack } from './inventory.js';
import { checkQuests } from './quests.js';
import { saveGame, restoreWorld, saveProfile, newId } from './save.js';
import { Net } from './net.js';
import { Mobs } from './mobs.js';

const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const DIRS = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
const ATTACK_REACH = 2.5 * TILE;   // 동물을 때릴 수 있는 거리
const EVENING = DAY_LENGTH * (13 / 24);   // 저녁 7시 (하루는 아침 6시에 시작한다)
const USE_TEXT = {
  workbench: '제작대 사용', furnace: '화로 열기', chest: '상자 열기', cave: '동굴로 들어가기',
  ladder: '지상으로 올라가기', door: '문 여닫기', bed: '잠자기', flag: '깃발 색 바꾸기', gate: '울타리 문 여닫기',
};
// 지붕은 타일 오브젝트가 아니라 별도 층이라, 캘 때 쓰는 정의를 따로 둔다
const ROOF_DEF = { name: '지붕', canBreak: true, wall: false, tool: 'axe', tier: 0, hard: 0.7, mat: 'wood', pcol: [0xa8503a, 0xc4664a, 0x86392c] };

export class Game {
  constructor({ audio, input, ui }) {
    this.audio = audio; this.input = input; this.ui = ui;
    this.renderer = null;
    this.state = 'title';       // 'title' | 'play'
    this.paused = false;
    this.world = null;
    this.onDisconnected = () => {};   // 방장과 연결이 끊겼을 때 (main.js가 채운다)
    this.mobs = new Mobs(this);
    this.reset();
    this.net = new Net(this);
  }

  reset() {
    this.layer = SURFACE;
    this.time = DAY_LENGTH * (2 / 24);   // 아침 8시에 시작
    this.player = { x: 0, y: 0, dir: 'd', moving: false, anim: 0, hunger: 100, swing: 0, stepT: 0 };
    this.inv = new Inventory(INV_SIZE);
    this.inv.onChange = () => { this.ui.dirty = true; };
    this.hotbar = 0;
    this.drops = [];
    this.dropSeq = 1;
    this.mobs.clear();
    this.mobT = null;           // 가리키고 있는 동물 { m, inReach }
    this.atkCool = 0;
    this.particles = [];
    this.mining = null;
    this.shake = null;
    this.target = { x: 0, y: 0, inReach: false };
    this.targetDirect = this.target;
    this.cursor = this.target;
    this.roofT = null;          // 마우스가 가리키는 지붕 높이의 칸
    this.roofMode = 'place';
    this.frameNo = 0;
    this.cool = 0;
    this.lastAct = -1;
    this.fade = null;           // { t, dur, phase, cb }
    this.fadeAlpha = 0;
    this.stats = { got: {}, crafted: {}, placed: {}, smelted: {}, flags: {} };
    this.quest = 0;
    this.simAcc = 0; this.seenAcc = 1; this.saveAcc = 0;
    this.scene = '';
    this.prompt = null;
  }

  newWorld(seed) {
    this.reset();
    this.world = generate(new World(seed));
    this.world.id = newId();
    const s = this.world.spawn;
    this.player.x = s.x * TILE + 8; this.player.y = s.y * TILE + 10;
    this.mobs.populate();
    this.hook();
  }
  loadFrom(d) {
    this.reset();
    this.world = restoreWorld(d);
    this.time = d.time; this.layer = d.layer; this.hotbar = d.hotbar || 0; this.quest = d.quest || 0;
    Object.assign(this.player, d.player);
    d.inv.forEach((s, i) => { this.inv.slots[i] = s && ITEMS[s.id] ? { id: s.id, n: s.n } : null; });
    this.stats = { got: {}, crafted: {}, placed: {}, smelted: {}, flags: {}, ...d.stats };
    this.drops = (d.drops || []).filter((x) => ITEMS[x.id]).map((x) => ({ vx: 0, vy: 0, z: 0, vz: 0, t: 1, age: 0, ...x, uid: this.dropSeq++ }));
    if (Array.isArray(d.mobs)) this.mobs.load(d.mobs); else this.mobs.populate();   // 동물이 생기기 전의 세이브에는 새로 뿌려 준다
    this.hook();
  }
  // 손님: 방장에게서 받은 세계에 들어간다. 가방·진행도는 내 브라우저에 저장해 둔 것을 쓴다
  joinWorld(world, data, profile) {
    this.reset();
    this.world = world;
    this.time = data.time;
    this.drops = (data.drops || []).filter((x) => ITEMS[x.id]).map((x) => ({ vx: 0, vy: 0, z: 0, vz: 0, t: 1, age: 0, ...x }));
    const s = world.spawn;
    this.player.x = s.x * TILE + 8 + rand(-12, 12); this.player.y = s.y * TILE + 10;
    if (profile) {
      this.layer = profile.layer ? 1 : 0; this.hotbar = profile.hotbar || 0; this.quest = profile.quest || 0;
      Object.assign(this.player, profile.player);
      (profile.inv || []).forEach((sl, i) => { if (i < this.inv.slots.length) this.inv.slots[i] = sl && ITEMS[sl.id] ? { id: sl.id, n: sl.n } : null; });
      this.stats = { got: {}, crafted: {}, placed: {}, smelted: {}, flags: {}, ...profile.stats };
      if (profile.seen) profile.seen.forEach((a, l) => { if (a && a.length === world.layers[l].seen.length) world.layers[l].seen.set(a); });
    }
    this.hook();
  }
  profile() {
    const p = this.player;
    return {
      savedAt: Date.now(), layer: this.layer, hotbar: this.hotbar, quest: this.quest,
      player: { x: p.x, y: p.y, dir: p.dir, hunger: p.hunger }, inv: this.inv.slots, stats: this.stats,
      seen: this.world.layers.map((L) => L.seen),
    };
  }
  hook() {
    this.world.onChange = (l, x, y) => { this.ui.mapDirty[l] = true; this.net.mark(l, y * MAP_W + x); };
    this.ui.mapDirty = [true, true];
    this.ui.dirty = true;
  }
  save(manual = false) {
    if (this.state !== 'play') return Promise.resolve();
    // 손님은 세계가 아니라 '내 가방과 진행도'만 저장한다 (세계는 방장의 것)
    const job = this.net.isGuest ? saveProfile(this.world.id, this.profile()) : saveGame(this);
    return job.then(() => { if (manual) this.ui.toast('저장했어요', 'good'); })
      .catch((e) => { console.warn('저장 실패', e); if (manual) this.ui.toast('저장에 실패했어요'); });
  }

  // ── 시간 ──
  get hour() { return (6 + ((this.time % DAY_LENGTH) / DAY_LENGTH) * 24) % 24; }
  get day() { return Math.floor(this.time / DAY_LENGTH) + 1; }
  get night() { const h = this.hour; return h >= 19.5 || h < 5; }
  // 0(낮) ~ 1(한밤)
  get darkness() {
    if (this.layer === CAVE) return 1;
    const h = this.hour;
    if (h >= 7 && h < 18) return 0;
    if (h >= 18 && h < 20.5) return (h - 18) / 2.5;
    if (h >= 4.5 && h < 7) return 1 - (h - 4.5) / 2.5;
    return 1;
  }

  heldSlot() { return this.inv.slots[this.hotbar]; }
  heldDef() { const s = this.inv.slots[this.hotbar]; return s ? ITEMS[s.id] : null; }

  // ─────────────────────────────────────────────────────────
  update(dt) {
    if (this.state !== 'play') return;
    this.frameNo++;
    if (this.fade) this.updateFade(dt);
    if (this.paused && !this.net.on) return;       // 여럿이 할 때는 세계가 멈추지 않는다
    this.updatePlayer(dt);
    this.updateActions(dt);
    this.updateDrops(dt);
    this.updateParticles(dt);
    this.simulate(dt);
    this.net.update(dt);
    this.seenAcc += dt;
    if (this.seenAcc >= 0.25) { this.seenAcc = 0; this.updateSeen(); }
    if (this.shake && (this.shake.t -= dt) <= 0) this.shake = null;
    const p = this.player;
    p.hunger = Math.max(0, p.hunger - dt * 0.085);
    const scene = this.layer === CAVE ? 'cave' : this.night ? 'night' : 'day';
    if (scene !== this.scene) { this.scene = scene; this.audio.setScene(scene); }
    this.saveAcc += dt;
    if (this.saveAcc > 90) { this.saveAcc = 0; this.save(); }
  }

  // 세계가 흘러가는 부분: 시간은 모두, 성장·화로·동물은 세계의 주인(혼자 할 때의 나 / 방장)만 계산한다
  simulate(dt) {
    this.time += dt;
    this.mobs.update(dt);
    if (this.net.isHost) {
      this.simAcc += dt;
      while (this.simAcc >= 1) { this.simAcc -= 1; this.tickGrowth(1); }
      this.tickFurnaces(dt);
    } else if (this.net.owned && this.net.owned.ent.type === 'furnace') {
      const o = this.net.owned;                    // 손님이 열어 둔 화로는 그 손님이 돌린다
      this.tickFurnace(o.l, o.i, o.ent, dt);
    }
  }

  // ── 플레이어 이동 ──
  collides(x, y) {
    const L = this.layer, w = this.world;
    const x0 = Math.floor((x - 4.5) / TILE), x1 = Math.floor((x + 4.5) / TILE);
    const y0 = Math.floor((y - 5) / TILE), y1 = Math.floor((y + 1.5) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (w.solid(L, tx, ty)) return true;
    return false;
  }
  playerOverlaps(tx, ty) {
    const p = this.player;
    return p.x + 4.5 > tx * TILE && p.x - 4.5 < (tx + 1) * TILE && p.y + 1.5 > ty * TILE && p.y - 5 < (ty + 1) * TILE;
  }
  updatePlayer(dt) {
    const p = this.player, inp = this.input;
    let mx = 0, my = 0;
    if (!this.ui.blocking && !this.fade) {
      mx = (inp.down('KeyD') || inp.down('ArrowRight') ? 1 : 0) - (inp.down('KeyA') || inp.down('ArrowLeft') ? 1 : 0);
      my = (inp.down('KeyS') || inp.down('ArrowDown') ? 1 : 0) - (inp.down('KeyW') || inp.down('ArrowUp') ? 1 : 0);
    }
    p.moving = !!(mx || my);
    if (p.moving) {
      // 다진 길 위에서는 조금 더 빨리 걷는다
      const fast = GROUND[this.world.ground(this.layer, Math.floor(p.x / TILE), Math.floor(p.y / TILE))].speed || 1;
      const len = Math.hypot(mx, my), sp = (p.hunger <= 0 ? 46 : 72) * fast * dt;
      const dx = (mx / len) * sp, dy = (my / len) * sp;
      if (this.collides(p.x, p.y)) { p.x += dx; p.y += dy; }   // 끼었을 때는 빠져나올 수 있게
      else {
        // 막히면 걸음을 반씩 줄여 벽에 딱 붙는다
        for (let k = 0, sx = dx; k < 3 && sx; k++, sx /= 2) if (!this.collides(p.x + sx, p.y)) { p.x += sx; break; }
        for (let k = 0, sy = dy; k < 3 && sy; k++, sy /= 2) if (!this.collides(p.x, p.y + sy)) { p.y += sy; break; }
      }
      p.x = Math.max(6, Math.min(MAP_W * TILE - 6, p.x)); p.y = Math.max(8, Math.min(MAP_H * TILE - 4, p.y));
      if (!(this.mining || p.swing > 0)) p.dir = Math.abs(mx) >= Math.abs(my) && mx ? (mx > 0 ? 'r' : 'l') : my > 0 ? 'd' : 'u';
      p.anim += dt * 8 * fast;
      p.stepT -= dt * fast;
      if (p.stepT <= 0) {
        p.stepT = 0.3;
        const g = GROUND[this.world.ground(this.layer, Math.floor(p.x / TILE), Math.floor(p.y / TILE))];
        this.audio.play('step_' + (g.step || 'grass'));
      }
    } else { p.anim = 0; p.stepT = 0.08; }
    if (p.swing > 0) p.swing -= dt;
  }
  faceTo(t) {
    const p = this.player, dx = t.x * TILE + 8 - p.x, dy = t.y * TILE + 8 - (p.y - 4);
    p.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : dy > 0 ? 'd' : 'u';
  }

  // ── 지붕 ──
  // 지붕 아이템을 들고 있는 동안은 '지붕 편집' 상태: 지붕이 비쳐 보이고 클릭으로 덮거나 걷는다
  get roofEdit() { const h = this.heldDef(); return !!(h && h.roof); }
  // 이어진 지붕 덩어리가 열려(투명해져) 있는가: 플레이어가 그 아래에 있거나, 딸린 문이 열려 있을 때
  roofOpen(reg) {
    if (reg.frame === this.frameNo) return reg.open;
    reg.frame = this.frameNo;
    const Lr = this.world.layers[this.layer], obj = Lr.obj, meta = Lr.meta, p = this.player;
    const pi = Math.floor(p.y / TILE) * MAP_W + Math.floor(p.x / TILE);
    const openDoor = (j) => obj[j] === O.DOOR && meta[j] === 1;
    let open = false;
    for (const i of reg.tiles) {
      if (i === pi || openDoor(i) || openDoor(i - 1) || openDoor(i + 1) || openDoor(i - MAP_W) || openDoor(i + MAP_W)) { open = true; break; }
    }
    return (reg.open = open);
  }
  // 이 칸의 지붕이 아래를 가리고 있는가
  roofBlocks(x, y) {
    const w = this.world;
    if (!w.roof(this.layer, x, y)) return false;
    const reg = w.regionAt(this.layer, w.idx(x, y));
    return !!reg && !this.roofOpen(reg);
  }
  removeRoof(x, y, toInv) {
    const w = this.world, cx = x * TILE + 8, cy = y * TILE + 2;
    w.setRoof(this.layer, x, y, 0);
    const left = toInv ? this.inv.add('roof', 1) : 1;
    if (left > 0) this.spawnDrop('roof', left, cx, cy);
    this.audio.play(toInv ? 'place' : 'break_wood');
    this.burst(cx, cy, ROOF_DEF.pcol, toInv ? 4 : 9, 55);
  }
  // 지붕 편집: 누른 첫 칸에 지붕이 있으면 '걷기', 없으면 '덮기'로 정해져 끌어서 칠할 수 있다
  roofPaint(t, hit) {
    const w = this.world, L = this.layer, i = w.idx(t.x, t.y), has = !!w.roof(L, t.x, t.y);
    this.mining = null;
    if (hit) this.roofMode = has ? 'remove' : 'place';
    if (!hit && (this.lastAct === i || this.cool > 0)) return;
    if (this.roofMode === 'place' && !has) {
      w.setRoof(L, t.x, t.y, 1);
      this.inv.take(this.hotbar, 1);
      this.audio.play('place');
      this.stats.placed.roof = (this.stats.placed.roof || 0) + 1;
    } else if (this.roofMode === 'remove' && has) this.removeRoof(t.x, t.y, true);
    else return;
    this.lastAct = i; this.cool = 0.07; this.player.swing = 0.14; this.faceTo(t);
  }

  // ── 조준 ──
  reach(tx, ty) {
    const p = this.player;
    return this.world.inb(tx, ty) && Math.hypot(tx * TILE + 8 - p.x, ty * TILE + 8 - (p.y - 6)) <= REACH * TILE;
  }
  mouseTargets() {
    const m = this.input.mouse, w = this.world, L = this.layer;
    const pt = this.renderer.screenToWorld(m.x, m.y);
    const tx = Math.floor(pt.x / TILE), ty = Math.floor(pt.y / TILE);
    const direct = { x: tx, y: ty, inReach: this.reach(tx, ty) };
    const ry = Math.floor((pt.y + ROOF_LIFT) / TILE);            // 지붕은 화면에서 위로 떠 있다
    const roof = { x: tx, y: ry, inReach: this.reach(tx, ry) };
    let sx = tx, sy = ty;
    if (w.obj(L, tx, ty) === O.NONE) {
      if (w.inb(tx, ty + 1) && OBJ[w.obj(L, tx, ty + 1)].wall && pt.y - ty * TILE >= TILE - WALL_LIFT) sy = ty + 1;  // 벽의 솟은 윗면
      else {
        // 타일보다 큰 그림(나무, 동굴 입구…)은 그림 어디를 눌러도 선택되게
        for (const [dx, dy] of [[0, 1], [0, 2], [-1, 1], [1, 1], [-1, 2], [1, 2], [-1, 0], [1, 0]]) {
          const o = w.obj(L, tx + dx, ty + dy);
          if (o === O.NONE || OBJ[o].wall) continue;
          const s = this.renderer.objSprite(OBJ[o], w.meta(L, tx + dx, ty + dy), tx + dx, ty + dy);
          if (!s || (s.w <= 16 && s.h <= 18)) continue;
          const rx = (tx + dx) * TILE + s.ox + 3, ry = (ty + dy) * TILE + s.oy + 2;
          if (pt.x >= rx && pt.x < rx + s.w - 6 && pt.y >= ry && pt.y < ry + s.h - 2) { sx = tx + dx; sy = ty + dy; break; }
        }
      }
    }
    return { direct, roof, smart: { x: sx, y: sy, inReach: this.reach(sx, sy) } };
  }
  facingTarget() {
    const p = this.player, d = DIRS[p.dir];
    const tx = Math.floor((p.x + d[0] * 13) / TILE), ty = Math.floor((p.y - 2 + d[1] * 13) / TILE);
    return { x: tx, y: ty, inReach: this.world.inb(tx, ty) };
  }

  // ── 입력 → 행동 ──
  updateActions(dt) {
    const inp = this.input, m = inp.mouse;
    this.cool = Math.max(0, this.cool - dt);
    this.atkCool = Math.max(0, this.atkCool - dt);
    const blocked = this.ui.blocking || !!this.fade;
    if (!blocked) {
      let hb = this.hotbar;
      for (let i = 0; i < HOTBAR; i++) if (inp.hit('Digit' + (i + 1))) hb = i;
      if (m.wheel) hb = (hb + m.wheel + HOTBAR * 4) % HOTBAR;
      if (hb !== this.hotbar) { this.hotbar = hb; this.audio.play('select'); this.ui.dirty = true; this.mining = null; }
      if (inp.hit('KeyQ')) this.dropHeld();
    }
    const kb = inp.down('Space') || inp.hit('KeyF');
    if (kb) { this.target = this.targetDirect = this.roofT = this.facingTarget(); this.kbUntil = performance.now() + 600; this.aimKb = true; }
    else if (!(this.kbUntil > performance.now()) || m.moved > this.kbUntil - 600) {
      const mt = this.mouseTargets();
      this.target = mt.smart; this.targetDirect = mt.direct; this.roofT = mt.roof; this.aimKb = false;
    }
    this.mobT = this.findMob();
    // 빈 칸에 쓰는 물건(설치물·씨앗·괭이·삽)을 들었으면 마우스 아래 칸을 그대로 겨냥한다
    {
      const held = this.heldDef(), d = this.targetDirect, rt = this.roofT;
      const usesEmpty = held && (held.place || held.seed || held.tool === 'hoe' || held.tool === 'shovel');
      // 지붕을 들고 있거나, 닫힌 지붕이 가리고 있으면 그 지붕 칸을 겨냥한다
      if (rt && (this.roofEdit || this.roofBlocks(rt.x, rt.y))) this.cursor = { x: rt.x, y: rt.y, inReach: rt.inReach, roof: true };
      else this.cursor = usesEmpty && d.inReach && this.world.obj(this.layer, d.x, d.y) === O.NONE ? d : this.target;
    }
    // 상호작용 안내
    this.prompt = null;
    const cand = this.target.inReach ? this.target : this.facingTarget();
    if (cand.inReach || this.reach(cand.x, cand.y)) {
      const o = this.world.obj(this.layer, cand.x, cand.y), def = OBJ[o], mt = this.world.meta(this.layer, cand.x, cand.y);
      if (def.use === 'harvest') { if (mt) this.prompt = `${def.harvest.item === 'apple' ? '사과' : '열매'} 따기`; }
      else if (def.use) this.prompt = def.nap && this.napTime ? '낮잠 자기' : USE_TEXT[def.use];
      else if (def.crop && mt >= 3) this.prompt = '수확하기';
    }
    if (blocked) { this.mining = null; return; }
    const primary = m.l || inp.down('Space');
    const primaryHit = m.lp || inp.hit('Space');
    if (primary) this.doPrimary(dt, primaryHit); else { this.mining = null; this.lastAct = -1; }
    if (m.rp || inp.hit('KeyF')) this.doSecondary();
  }

  doPrimary(dt, hit) {
    const held = this.heldDef(), w = this.world, L = this.layer;
    // 동물을 가리키고 있으면 캐거나 놓는 대신 때린다
    if (this.mobT) { this.mining = null; if (this.mobT.inReach) this.attack(this.mobT.m); return; }
    const t = this.cursor;
    if (!t.inReach) { this.mining = null; if (hit && held && held.food) this.eat(); return; }
    if (t.roof) return this.roofEdit ? this.roofPaint(t, hit) : this.mine(t, ROOF_DEF, dt, hit, () => this.removeRoof(t.x, t.y));
    const o = w.obj(L, t.x, t.y);
    if (o !== O.NONE) return this.mine(t, OBJ[o], dt, hit);
    this.mining = null;
    const g = w.ground(L, t.x, t.y), i = w.idx(t.x, t.y);
    if (!hit && this.lastAct === i) return;
    // 새로 누른 클릭은 항상 바로 반응하고, 누르고 있을 때의 연속 동작만 간격을 둔다
    if (held && held.tool === 'hoe') { if (hit || this.cool <= 0) this.till(t, g, hit); }
    else if (held && held.tool === 'shovel') { if (hit || this.cool <= 0) this.pave(t, g, hit, held); }
    else if (held && (held.place || held.seed)) { if (hit || this.cool <= 0) this.place(t, held, hit); }
    else if (g === G.PLANK && hit) {
      w.setGround(L, t.x, t.y, L === CAVE ? G.CAVE : G.DIRT);
      this.spawnDrop('plank_floor', 1, t.x * TILE + 8, t.y * TILE + 8);
      this.audio.play('break_wood'); this.player.swing = 0.2; this.faceTo(t);
    }
    else if (held && held.food && hit) this.eat();
  }

  // ── 동물 ──
  // 마우스 아래(키보드로 겨냥 중이면 바라보는 쪽)의 동물
  findMob() {
    if (this.layer !== SURFACE || this.roofEdit || !this.mobs.list.length) return null;
    const p = this.player;
    let pt;
    if (this.aimKb) { const d = DIRS[p.dir]; pt = { x: p.x + d[0] * 14, y: p.y - 5 + d[1] * 13 }; }
    else { const mo = this.input.mouse; pt = this.renderer.screenToWorld(mo.x, mo.y); }
    const m = this.mobs.pick(pt.x, pt.y);
    if (!m || this.roofBlocks(Math.floor(m.rx / TILE), Math.floor(m.ry / TILE))) return null;   // 지붕 아래에 가려진 동물
    const d = MOBS[m.k];
    return { m, inReach: Math.hypot(m.rx - p.x, m.ry - d.h / 2 - (p.y - 6)) - d.hw <= ATTACK_REACH };
  }
  // 때리기: 검이 가장 세고, 누르고 있으면 일정한 간격으로 이어서 때린다
  attack(m) {
    if (this.atkCool > 0) return;
    const held = this.heldSlot(), def = held ? ITEMS[held.id] : null, p = this.player;
    this.atkCool = def && def.tool === 'sword' ? 0.34 : 0.44;
    p.swing = 0.22;
    const dx = m.rx - p.x, dy = m.ry - MOBS[m.k].h / 2 - (p.y - 6);
    p.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : dy > 0 ? 'd' : 'u';
    this.audio.play('swing');
    this.mobs.strike(m, attackDamage(held ? held.id : ''));
    p.hunger = Math.max(0, p.hunger - 0.15);
  }

  doSecondary() {
    const t = this.target, held = this.heldDef(), w = this.world, L = this.layer;
    if (t.inReach) {
      const o = w.obj(L, t.x, t.y), def = OBJ[o], m = w.meta(L, t.x, t.y), i = w.idx(t.x, t.y);
      if (def.use || (def.crop && m >= 3)) this.faceTo(t);
      switch (def.use) {
        case 'workbench': return this.ui.open('workbench');
        case 'furnace': return this.openEnt(L, i, 'furnace');
        case 'chest': return this.openEnt(L, i, 'chest');
        case 'cave': return this.travel(CAVE, t.x, t.y);
        case 'ladder': return this.travel(SURFACE, t.x, t.y);
        case 'bed': return this.sleep(def);
        case 'flag': return this.ui.open('flag', { x: t.x, y: t.y, l: L });
        case 'door': case 'gate': {
          // 열린 문 사이에 내가 서 있거나 동물이 끼어 있으면 닫히지 않는다
          if (m === 1 && (this.playerOverlaps(t.x, t.y) || this.mobs.overlapsTile(L, t.x, t.y))) return;
          w.setMeta(L, t.x, t.y, m ? 0 : 1); this.audio.play('door');
          return;
        }
        case 'harvest':
          if (!this.harvestAt(t.x, t.y, L)) { this.ui.toast('아직 열매가 열리지 않았어요'); this.audio.play('deny'); }
          return;
      }
      if (def.crop && m >= 3) { this.audio.play('pluck'); this.breakObj(t.x, t.y); return; }
      const d = this.targetDirect;
      if (held && d.inReach && w.obj(L, d.x, d.y) === O.NONE) {
        if (held.place || held.seed) return this.place(d, held, true);
        if (held.tool === 'hoe') return this.till(d, w.ground(L, d.x, d.y), true);
        if (held.tool === 'shovel') return this.pave(d, w.ground(L, d.x, d.y), true, held);
      }
    }
    if (held && held.food) this.eat();
  }

  // 열매 따기. 드롭은 세계의 주인만 만든다 (손님은 방장에게 부탁)
  harvestAt(x, y, L = this.layer, remote = false) {
    const w = this.world, i = w.idx(x, y), def = OBJ[w.obj(L, x, y)];
    if (!def.harvest || !w.meta(L, x, y)) return false;
    if (this.net.isGuest) {
      this.net.send({ t: 'hv', l: L, x, y });
      this.net.quiet(() => w.setMeta(L, x, y, 0));
    } else {
      const h = def.harvest;
      this.spawnDrop(h.item, randi(h.min, h.max), x * TILE + 8, y * TILE + 4, { layer: L });
      w.setMeta(L, x, y, 0);
      w.grow[L].set(i, rand(h.regrow[0], h.regrow[1]));
    }
    if (!remote) { this.audio.play('pluck'); this.player.swing = 0.2; }
    if (L === this.layer) this.burst(x * TILE + 8, y * TILE + 2, def.pcol, 6, 40);
    return true;
  }

  // 상자·화로 열기: 여럿이 할 때는 한 번에 한 사람만 쓸 수 있다
  openEnt(L, i, type) {
    if (this.net.isGuest) return this.net.requestEnt(L, i);     // 방장이 허락하면 열린다
    const e = this.ensureEnt(L, i, type);
    if (e.owner && e.owner !== this.net.id) { this.ui.toast('다른 플레이어가 쓰고 있어요'); this.audio.play('deny'); return; }
    if (this.net.on) e.owner = this.net.id;
    this.ui.open(type, e);
  }
  entClosed(e) {
    if (!e || !e.slots) return;
    if (this.net.isGuest) this.net.closeEnt(); else delete e.owner;
  }

  ensureEnt(L, i, type) {
    let e = this.world.ents[L].get(i);
    if (!e) {
      e = type === 'chest' ? { type, slots: new Array(27).fill(null) } : { type, slots: [null, null, null], burn: 0, burnMax: 0, prog: 0 };
      this.world.ents[L].set(i, e);
    }
    return e;
  }

  // ── 채굴 ──
  mine(t, def, dt, hit, onBreak) {
    const held = this.heldDef(), p = this.player;
    this.faceTo(t);
    if (!def.canBreak) {
      this.mining = null;
      if (hit) { this.ui.toast(`${def.name}: 부술 수 없어요`); this.audio.play('deny'); }
      return;
    }
    if (def.wall && !this.world.exposed(this.layer, t.x, t.y)) {
      this.mining = null;
      if (hit) { this.ui.toast('다른 돌에 가로막혀 닿지 않아요'); this.audio.play('deny'); }
      return;
    }
    const right = !!(def.tool && held && held.tool === def.tool);
    const tier = right ? held.tier : 0;
    if (def.tier > tier) {
      this.mining = null;
      if (hit) {
        this.ui.toast(`${def.name}: ${['', '나무', '돌', '철'][def.tier]} 곡괭이 이상이 필요해요`);
        this.audio.play('deny'); p.swing = 0.2;
      }
      return;
    }
    let mn = this.mining;
    if (!mn || mn.x !== t.x || mn.y !== t.y || mn.roof !== !!t.roof) mn = this.mining = { x: t.x, y: t.y, t: 0, hitT: 0, total: 1, roof: !!t.roof };
    mn.total = def.hard / ((right ? TOOL_SPEED[tier] : 1) * (p.hunger <= 0 ? 0.6 : 1));
    mn.t += dt; mn.hitT -= dt;
    if (mn.hitT <= 0) {
      mn.hitT = 0.27; p.swing = 0.22;
      this.audio.play('hit_' + def.mat);
      if (!t.roof) this.shake = { x: t.x, y: t.y, t: 0.16 };
      this.burst(t.x * TILE + 8, t.y * TILE + 6, def.pcol, 3, 45);
    }
    if (mn.t >= mn.total) { if (onBreak) onBreak(); else this.breakObj(t.x, t.y); this.mining = null; }
  }

  // 부수기. remote = 손님의 부탁으로 방장이 대신 부수는 경우
  breakObj(x, y, L = this.layer, remote = false) {
    const w = this.world, i = w.idx(x, y);
    const o = w.obj(L, x, y), def = OBJ[o], m = w.meta(L, x, y);
    if (!o) return;
    const cx = x * TILE + 8, cy = y * TILE + 8;
    if (this.net.isGuest) {
      // 드롭은 방장이 만든다. 내 화면에서는 기다리지 않고 바로 없앤다
      this.net.send({ t: 'brk', l: L, x, y });
      this.net.quiet(() => w.setObj(L, x, y, O.NONE, 0));
    } else {
      const e = w.ents[L].get(i);
      if (e && e.owner && e.owner !== this.net.id) { if (!remote) { this.ui.toast('다른 플레이어가 쓰고 있어요'); this.audio.play('deny'); } return; }
      const drops = typeof def.drops === 'function' ? def.drops(m) : def.drops;
      if (drops) for (const [id, min, max, chance = 1] of drops) if (Math.random() < chance) this.spawnDrop(id, randi(min, max), cx, cy, { layer: L });
      if (e) { for (const s of e.slots) if (s) this.spawnDrop(s.id, s.n, cx, cy, { layer: L }); w.ents[L].delete(i); this.ui.entGone(e); }
      w.grow[L].delete(i);
      w.setObj(L, x, y, O.NONE, 0);
    }
    if (L === this.layer && (!remote || Math.hypot(cx - this.player.x, cy - this.player.y) < 15 * TILE)) {
      this.audio.play('break_' + def.mat);
      this.burst(cx, cy - 2, def.pcol, def.wall ? 12 : 8, 70);
      if (def.tree) {
        this.audio.play('treefall');
        this.burst(cx, cy - 22, OBJ[O.BUSH].pcol, 18, 80, 0.9);
      }
    }
    if (!remote) { this.player.hunger = Math.max(0, this.player.hunger - 0.2); this.updateSeen(); }
  }

  till(t, g, hit) {
    const w = this.world, L = this.layer;
    if (GROUND[g].till) w.setGround(L, t.x, t.y, G.FARM);
    else if (g === G.FARM && hit) w.setGround(L, t.x, t.y, G.DIRT);
    else { if (hit) { this.ui.toast('풀밭이나 흙만 갈 수 있어요'); this.audio.play('deny'); } return; }
    this.lastAct = w.idx(t.x, t.y);
    this.audio.play('till'); this.cool = 0.28; this.player.swing = 0.22; this.faceTo(t);
    this.burst(t.x * TILE + 8, t.y * TILE + 8, [0x9c6b43, 0x6e4a2e, 0x855837], 6, 45);
  }

  // 삽: 땅을 다져 길로 만든다. 누른 첫 칸이 길이면 '되돌리기', 아니면 '다지기'로 정해져 끌어서 이어 갈 수 있다
  pave(t, g, hit, held) {
    const w = this.world, L = this.layer;
    if (hit) this.paveMode = g === G.PATH ? 'undo' : 'pave';
    if (this.paveMode === 'pave' && GROUND[g].pave) w.setGround(L, t.x, t.y, G.PATH);
    else if (this.paveMode === 'undo' && g === G.PATH) w.setGround(L, t.x, t.y, G.DIRT);
    else { if (hit) { this.ui.toast('풀밭 · 흙 · 모래 · 자갈만 다질 수 있어요'); this.audio.play('deny'); } return; }
    this.lastAct = w.idx(t.x, t.y);
    this.audio.play('shovel'); this.cool = SHOVEL_COOL[held.tier] ?? 0.26; this.player.swing = 0.2; this.faceTo(t);
    this.burst(t.x * TILE + 8, t.y * TILE + 8, this.paveMode === 'pave' ? [0xc7a878, 0xb08f61, 0xe6d2ae] : [0x9c6b43, 0x855837, 0xb48152], 5, 40);
  }

  place(t, it, hit) {
    const w = this.world, L = this.layer, { x, y } = t, g = w.ground(L, x, y), gd = GROUND[g], i = w.idx(x, y);
    const fail = (msg) => { if (hit) { this.ui.toast(msg); this.audio.play('deny'); } };
    if (it.seed) {
      if (g !== G.FARM) return fail('괭이로 간 경작지에만 심을 수 있어요');
      const od = OBJ[it.seed.obj];
      w.setObj(L, x, y, it.seed.obj, 0);
      w.grow[L].set(i, rand(od.grow[0], od.grow[1]));
      this.audio.play('plant');
    } else if (it.place.ground) {
      if (!gd.walk || g === it.place.ground) return fail('여기에는 깔 수 없어요');
      w.setGround(L, x, y, it.place.ground);
      this.audio.play('place');
    } else {
      const pl = it.place, od = OBJ[pl.obj];
      if (!gd.walk) return fail('여기에는 놓을 수 없어요');
      if (pl.on === 'soil' && !gd.soil) return fail('풀밭이나 흙에만 심을 수 있어요');
      if (pl.on === 'sand' && g !== G.SAND) return fail('모래에만 심을 수 있어요');
      if (od.solid && this.playerOverlaps(x, y)) return fail('너무 가까워요. 한 칸 떨어져서 놓으세요');
      if (od.solid && this.mobs.overlapsTile(L, x, y)) return fail('동물이 있어서 놓을 수 없어요');
      w.setObj(L, x, y, pl.obj, pl.meta || 0);
      if (pl.obj === O.CHEST) this.ensureEnt(L, i, 'chest');
      if (pl.obj === O.FURNACE) this.ensureEnt(L, i, 'furnace');
      if (od.grow) w.grow[L].set(i, rand(od.grow[0], od.grow[1]));
      if (pl.grow && od.harvest) w.grow[L].set(i, rand(od.harvest.regrow[0], od.harvest.regrow[1]));
      this.audio.play(od.mat === 'stone' ? 'place_stone' : 'place');
    }
    this.lastAct = i;
    this.inv.take(this.hotbar, 1);
    this.cool = 0.15; this.player.swing = 0.16; this.faceTo(t);
    this.stats.placed[it.id] = (this.stats.placed[it.id] || 0) + 1;
    checkQuests(this);
    this.updateSeen();
    if (it.place && it.place.obj === O.FLAG) this.ui.open('flag', { x, y, l: L });   // 세우자마자 색 고르기
  }

  eat() {
    const s = this.heldSlot(), p = this.player;
    if (!s || !ITEMS[s.id].food) return;
    if (p.hunger >= 97) { this.ui.toast('지금은 배가 불러요'); return; }
    p.hunger = Math.min(100, p.hunger + ITEMS[s.id].food);
    this.inv.take(this.hotbar, 1);
    this.audio.play('eat');
    this.burst(p.x, p.y - 12, [0xf2e6d0, 0xd9583b, 0xe0aa5c], 5, 30);
  }

  dropHeld() {
    const s = this.heldSlot(); if (!s) return;
    const p = this.player, d = DIRS[p.dir];
    this.spawnDrop(s.id, 1, p.x + d[0] * 6, p.y - 6 + d[1] * 6, { vx: d[0] * 70, vy: d[1] * 70, t: -1.2 });
    this.inv.take(this.hotbar, 1);
    this.audio.play('select');
  }

  craft(recipe, times = 1) {
    let made = 0;
    while (made < times && this.inv.has(recipe.in)) {
      for (const id in recipe.in) this.inv.remove(id, recipe.in[id]);
      const left = this.inv.add(recipe.out, recipe.n);
      if (left > 0) this.spawnDrop(recipe.out, left, this.player.x, this.player.y - 4);
      this.stats.crafted[recipe.out] = (this.stats.crafted[recipe.out] || 0) + recipe.n;
      made++;
    }
    if (made) { this.audio.play('craft'); checkQuests(this); } else this.audio.play('deny');
    return made;
  }

  // ── 지상 ↔ 지하 ──
  travel(to, x, y) {
    if (this.fade) return;
    this.audio.play('cave');
    this.fadeTo(() => {
      const w = this.world;
      let spot = null;
      for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        if (!w.solid(to, x + dx, y + dy)) { spot = { x: x + dx, y: y + dy }; break; }
      }
      if (!spot) { spot = { x, y: y + 1 }; w.setObj(to, x, y + 1, O.NONE); if (!GROUND[w.ground(to, x, y + 1)].walk) w.setGround(to, x, y + 1, to === CAVE ? G.CAVE : G.DIRT); }
      this.layer = to;
      const p = this.player;
      p.x = spot.x * TILE + 8; p.y = spot.y * TILE + 10; p.dir = 'd';
      this.mining = null;
      if (to === CAVE) { this.stats.flags.cave = true; checkQuests(this); }
      this.renderer.snap();
      this.updateSeen();
      this.ui.banner(to === CAVE ? '지하 동굴' : '지상');
    });
  }
  // 양모 침대에서 낮잠을 잘 수 있는 시간인가 (새벽 5시 ~ 저녁 7시)
  get napTime() { const h = this.hour; return h >= 5 && h < 19; }
  // 침대: 밤에 자면 다음 날 아침까지. 양모 침대(def.nap)는 낮에도 누울 수 있는데, 그때는 그날 저녁까지만 잔다
  sleep(def) {
    const wool = !!(def && def.nap), nap = wool && this.napTime;
    if (this.net.isGuest) { this.ui.toast('여럿이 할 때는 방장만 시간을 넘길 수 있어요'); return; }
    if (!nap && this.napTime) { this.ui.toast('아직 졸리지 않아요. 저녁 7시 이후에 잘 수 있어요'); return; }
    this.audio.play('sleep');
    this.fadeTo(() => {
      const now = this.time % DAY_LENGTH;
      let remain = (nap ? EVENING : DAY_LENGTH) - now;
      if (remain <= 0) remain += DAY_LENGTH;         // 새벽 5~6시의 낮잠은 날이 바뀐 뒤의 저녁까지
      this.time += remain;
      for (let s = 0; s < remain; s += 20) this.tickGrowth(20);
      // 양모 침대에서 일어나면 배가 든든하다
      this.player.hunger = wool ? 100 : Math.max(8, this.player.hunger - 10);
      this.ui.banner(`${this.day}일차 ${nap ? '저녁' : '아침'}`);
      this.net.all({ t: 'tm', time: this.time });
      this.save();
    }, 0.8);
  }
  fadeTo(cb, dur = 0.35) { this.fade = { t: 0, dur, phase: 'out', cb }; }
  updateFade(dt) {
    const f = this.fade;
    f.t += dt;
    if (f.phase === 'out') {
      this.fadeAlpha = Math.min(1, f.t / f.dur);
      if (f.t >= f.dur) { f.cb(); f.phase = 'in'; f.t = 0; }
    } else {
      this.fadeAlpha = 1 - Math.min(1, f.t / f.dur);
      if (f.t >= f.dur) { this.fade = null; this.fadeAlpha = 0; }
    }
  }

  // ── 드롭 아이템 ──
  // 드롭은 세계의 주인이 만든다. 손님은 방장에게 부탁하고, 방장이 만든 것이 모두에게 보인다
  spawnDrop(id, n, x, y, o = {}) {
    const d = {
      id, n, x, y, vx: o.vx ?? rand(-22, 22), vy: o.vy ?? rand(-22, 14), z: 3, vz: rand(55, 95),
      t: o.t ?? 0, layer: o.layer ?? this.layer, age: 0,
    };
    if (this.net.isGuest) { this.net.send({ t: 'ds', d }); return null; }
    d.uid = this.dropSeq++;
    this.drops.push(d);
    this.net.dropNew(d);
    return d;
  }
  // 주운 아이템을 가방에 넣는다
  collect(id, n) {
    const left = this.inv.add(id, n), gotN = n - left;
    if (gotN > 0) {
      this.stats.got[id] = (this.stats.got[id] || 0) + gotN;
      this.ui.pickup(id, gotN);
      this.audio.play('pickup');
      checkQuests(this);
    }
    if (left > 0) this.spawnDrop(id, left, this.player.x, this.player.y - 4, { t: -1 });
  }
  // 손님: 방장이 "이 드롭은 사라졌다(누가 주웠다)"고 알려 줌
  takeDrop(uid, mine) {
    const k = this.drops.findIndex((d) => d.uid === uid);
    if (k < 0) return;
    const d = this.drops[k];
    this.drops.splice(k, 1);
    if (mine) this.collect(d.id, d.n);
  }
  updateDrops(dt) {
    const p = this.player, L = this.layer, guest = this.net.isGuest, now = performance.now();
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += dt;
      if (!guest && d.age > 900) { this.drops.splice(i, 1); this.net.dropGone(d.uid, null); continue; }
      if (d.layer !== L) continue;
      d.t += dt;
      d.vz -= 320 * dt; d.z += d.vz * dt;
      if (d.z < 0) { d.z = 0; d.vz = d.vz < -40 ? -d.vz * 0.4 : 0; d.vx *= 0.5; d.vy *= 0.5; }
      d.x += d.vx * dt; d.y += d.vy * dt;
      const fr = Math.pow(0.02, dt); d.vx *= fr; d.vy *= fr;
      if (d.t < 0.4) continue;
      const dx = p.x - d.x, dy = p.y - 6 - d.y, dist = Math.hypot(dx, dy);
      if (dist < 38 && this.inv.space(d.id) > 0) {
        const sp = 60 + (38 - dist) * 6;
        d.x += (dx / (dist || 1)) * sp * dt; d.y += (dy / (dist || 1)) * sp * dt;
        if (dist < 8) {
          if (guest) {
            // 두 사람이 동시에 줍지 않도록 방장에게 물어본다
            if (!(d.claim > now)) { d.claim = now + 1000; this.net.send({ t: 'dq', id: d.uid }); }
          } else {
            this.drops.splice(i, 1);
            this.net.dropGone(d.uid);
            this.collect(d.id, d.n);
          }
        }
      }
    }
  }

  // ── 파티클 ──
  burst(x, y, colors, n, speed = 50, life = 0.5) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.6);
      this.particles.push({
        x: x + rand(-3, 3), y: y + rand(-3, 3), vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.6,
        life: life * (0.6 + Math.random() * 0.6), max: life, c: colors[(Math.random() * colors.length) | 0], s: Math.random() < 0.3 ? 2 : 1,
      });
    }
    if (this.particles.length > 600) this.particles.splice(0, this.particles.length - 600);
  }
  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const q = this.particles[i];
      q.life -= dt;
      if (q.life <= 0) { this.particles.splice(i, 1); continue; }
      q.vy += 220 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.96;
    }
  }

  // ── 성장 ──
  tickGrowth(step) {
    const w = this.world;
    for (let l = 0; l < 2; l++) {
      const gm = w.grow[l], Lr = w.layers[l];
      for (const [i, t] of gm) {
        const x = i % MAP_W, y = (i / MAP_W) | 0, o = Lr.obj[i], def = OBJ[o];
        let rate = step;
        if (def.crop && w.nearWater(l, x, y, 3)) rate *= 1.6;   // 물가 근처에서 더 빨리 자란다
        const nt = t - rate;
        if (nt > 0) { gm.set(i, nt); continue; }
        if (def.crop) {
          const m = Lr.meta[i];
          if (m < 3) { w.setMeta(l, x, y, m + 1); if (m + 1 < 3) gm.set(i, rand(def.grow[0], def.grow[1])); else gm.delete(i); }
          else gm.delete(i);
        } else if (o === O.SAPLING) {
          if ((l === this.layer && this.playerOverlaps(x, y)) || this.mobs.overlapsTile(l, x, y)) { gm.set(i, 5); continue; }
          const tree = SAPLING_TREES[Lr.meta[i]] || O.TREE_OAK;
          w.setObj(l, x, y, tree, 0);
          if (OBJ[tree].harvest) gm.set(i, rand(OBJ[tree].harvest.regrow[0], OBJ[tree].harvest.regrow[1])); else gm.delete(i);
        } else if (def.harvest) { w.setMeta(l, x, y, 1); gm.delete(i); }
        else gm.delete(i);
      }
    }
  }

  // ── 화로 ──
  tickFurnaces(dt) {
    const w = this.world;
    for (let l = 0; l < 2; l++) {
      for (const [i, e] of w.ents[l]) {
        if (e.type !== 'furnace') continue;
        if (e.owner && e.owner !== this.net.id) continue;      // 손님이 열어 둔 화로는 그 손님이 돌리는 중
        this.tickFurnace(l, i, e, dt);
      }
    }
  }
  tickFurnace(l, i, e, dt) {
    const w = this.world;
    const [src, fuel, out] = e.slots;
    const rec = src ? SMELT[src.id] : null;
    const can = !!rec && (!out || (out.id === rec.out && out.n < maxStack(rec.out)));
    if (e.burn <= 0 && can && fuel && ITEMS[fuel.id].fuel) {
      e.burn = e.burnMax = ITEMS[fuel.id].fuel;
      fuel.n--; if (fuel.n <= 0) e.slots[1] = null;
      e.touched = true;
    }
    const lit = e.burn > 0;
    if (lit) {
      e.burn -= dt;
      if (can) {
        e.prog += dt;
        if (e.prog >= rec.time) {
          e.prog = 0;
          src.n--; if (src.n <= 0) e.slots[0] = null;
          if (e.slots[2]) e.slots[2].n++; else e.slots[2] = { id: rec.out, n: 1 };
          this.stats.smelted[rec.out] = (this.stats.smelted[rec.out] || 0) + 1;
          e.touched = true;
          checkQuests(this);
          if (l === this.layer) this.audio.play('smelt');
        }
      } else e.prog = 0;
    } else if (e.prog > 0) e.prog = Math.max(0, e.prog - dt * 2);
    const x = i % MAP_W, y = (i / MAP_W) | 0;
    if ((w.layers[l].meta[i] === 1) !== lit) w.setMeta(l, x, y, lit ? 1 : 0);
  }

  // ── 시야(지도에 밝혀진 곳) ──
  updateSeen() {
    const w = this.world, L = this.layer, Lr = w.layers[L], p = this.player;
    const px = Math.floor(p.x / TILE), py = Math.floor(p.y / TILE);
    const R = L === CAVE ? 10 : 24;
    let changed = false;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dy * dy > R * R) continue;
      const x = px + dx, y = py + dy;
      if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
      const i = y * MAP_W + x;
      if (Lr.seen[i]) continue;
      if (L === CAVE && OBJ[Lr.obj[i]].wall && !w.exposed(L, x, y)) continue;
      Lr.seen[i] = 1; changed = true;
    }
    if (changed) this.ui.mapDirty[L] = true;
  }
}
