// DOM 기반 UI: HUD, 단축바, 가방·제작·화로·상자 창, 지도, 타이틀·일시정지 메뉴
import { MAP_W, MAP_H, TILE, CAVE, HOTBAR } from './config.js';
import { GROUND } from './data/ground.js';
import { OBJ, FLAG_COLORS } from './data/objects.js';
import { hex } from './gfx/pix.js';
import { ITEMS, RECIPES, SMELT, CATEGORY_NAMES } from './data/items.js';
import { maxStack } from './inventory.js';
import { QUESTS } from './quests.js';

const N = MAP_W * MAP_H;
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};
const MINI = 78;
const ROOF_COLOR = 0xa8503a;
const flagHex = (m) => hex(FLAG_COLORS[m % FLAG_COLORS.length].c);

export class UI {
  constructor(root, atlas, audio) {
    this.root = root; this.atlas = atlas; this.audio = audio;
    this.game = null; this.renderer = null;
    this.dirty = true; this.mapDirty = [true, true];
    this.mode = null; this.ent = null; this.held = null;
    this.views = []; this.recViews = []; this.hotViews = [];
    this.titleOpen = true; this.pauseOpen = false; this.mapOpen = false; this.helpOpen = false; this.confirmOpen = false;
    this.cache = {}; this.mouse = { x: 0, y: 0 }; this.tipFor = null;
    this.mapAcc = 9; this.miniAcc = 9; this.nameT = 0; this.bannerT = 0;
    this.on = {};
    this.build();
  }
  attach(game, renderer) { this.game = game; this.renderer = renderer; }
  get blocking() { return !!this.mode || this.titleOpen || this.pauseOpen || this.mapOpen || this.helpOpen || this.confirmOpen; }
  icon(id) { return ITEMS[id] ? this.atlas.url(ITEMS[id].icon) : ''; }
  $(id) { return this.root.querySelector('#' + id); }

  build() {
    const r = this.root;
    r.innerHTML = `
      <div id="hud" class="hidden">
        <div id="status">
          <div id="clock"><span id="sun"></span><span id="clocktxt"></span></div>
          <div class="barlabel"><span>포만감</span><span id="hungertxt"></span></div>
          <div class="bar" id="hungerbar"><i></i></div>
        </div>
        <div id="quest"></div>
        <div id="mini"><canvas width="${MINI}" height="${MINI}"></canvas><div id="coords"></div></div>
        <div id="hints"><b>WASD</b> 이동 · <b>좌클릭</b> 캐기/놓기 · <b>우클릭</b> 사용/먹기<br><b>E</b> 가방·제작 · <b>M</b> 지도 · <b>Q</b> 버리기 · <b>Esc</b> 메뉴</div>
        <div id="pickups"></div>
        <div id="prompt" class="hidden"></div>
        <div id="heldname"></div>
        <div id="hotbar"></div>
      </div>
      <div id="toasts"></div>
      <div id="banner"></div>
      <div id="mapview" class="hidden"><div class="shade"></div>
        <div class="panel center">
          <div class="title-bar"><h2 id="maptitle">지도</h2><button class="x" data-act="map">✕</button></div>
          <canvas width="${MAP_W}" height="${MAP_H}"></canvas>
          <div class="legend"><span><i style="background:#fff"></i>나</span><span><i style="background:#f4c430"></i>동굴 입구 · 사다리</span><span><i style="background:#e2504a"></i>내가 세운 깃발</span><span><i style="background:#0e0c14;outline:1px solid #555d7b"></i>아직 가 보지 않은 곳</span></div>
        </div>
      </div>
      <div id="title" class="screen">
        <h1 id="logo">마인 팩토리</h1>
        <div id="logo-en">MINE FACTORY</div>
        <div id="tagline">캐고 · 만들고 · 자동화해서 · 화성까지</div>
        <div class="menu">
          <button class="btn primary hidden" id="b-continue">이어하기</button>
          <button class="btn" id="b-new">새 게임</button>
          <div class="seedrow"><span>시드</span><input id="seed" placeholder="비워 두면 무작위" maxlength="18" spellcheck="false"></div>
          <button class="btn small" data-act="help">조작법</button>
        </div>
        <div id="foot">v0.1 · 지상과 지하 · 소리를 켜고 즐겨 주세요</div>
      </div>
      <div id="pause" class="hidden"><div class="shade"></div>
        <div class="panel center" style="width:310px">
          <div class="title-bar"><h2>일시정지</h2></div>
          <div class="menu" style="width:auto">
            <button class="btn primary" id="p-resume">계속하기</button>
            <button class="btn" id="p-save">저장하기</button>
            <button class="btn" data-act="help">조작법</button>
            <div class="vol"><span>효과음</span><input type="range" id="v-sfx" min="0" max="100"><span id="v-sfx-t"></span></div>
            <div class="vol"><span>음악</span><input type="range" id="v-music" min="0" max="100"><span id="v-music-t"></span></div>
            <button class="btn small" id="p-title" style="margin-top:8px">저장하고 타이틀로</button>
          </div>
        </div>
      </div>
      <div id="help" class="hidden"><div class="shade"></div>
        <div class="panel center" style="width:440px;max-width:92vw">
          <div class="title-bar"><h2>조작법</h2><button class="x" data-act="help">✕</button></div>
          <div class="keys">
            <kbd>W A S D / 방향키</kbd><span>이동</span>
            <kbd>좌클릭 (길게)</kbd><span>캐기 · 베기 / 들고 있는 것 놓기 · 심기 · 갈기</span>
            <kbd>우클릭</kbd><span>사용하기 (제작대·화로·상자·동굴·열매 따기) / 먹기</span>
            <kbd>1 ~ 9 · 마우스 휠</kbd><span>단축바 선택</span>
            <kbd>E · Tab</kbd><span>가방과 제작 창</span>
            <kbd>M</kbd><span>지도</span>
            <kbd>Q</kbd><span>들고 있는 아이템 하나 버리기</span>
            <kbd>Space · F</kbd><span>바라보는 칸을 캐기 · 사용하기 (키보드만으로)</span>
            <kbd>- · =</kbd><span>화면 확대 / 축소</span>
            <kbd>Esc</kbd><span>창 닫기 · 일시정지</span>
          </div>
          <div class="note">가방 창에서는 <b>Shift+클릭</b>으로 빠르게 옮기고, <b>우클릭</b>으로 절반만 집거나 하나씩 놓을 수 있어요.<br>도구는 종류가 맞아야 빨라집니다: 나무엔 도끼, 돌과 광석엔 곡괭이.</div>
        </div>
      </div>
      <div id="confirm" class="hidden"><div class="shade"></div>
        <div class="panel center" style="width:330px;text-align:center">
          <div id="confirm-text" style="margin:6px 0 14px"></div>
          <div style="display:flex;gap:8px"><button class="btn small" id="c-no" style="flex:1">취소</button><button class="btn small primary" id="c-yes" style="flex:1">확인</button></div>
        </div>
      </div>
      <div id="held" class="hidden"><div class="ico"></div><div class="cnt"></div></div>
      <div id="tip" class="hidden"></div>
      <div id="fade"></div>
      <div id="loading">세계를 만드는 중…</div>`;

    this.hud = this.$('hud'); this.tip = this.$('tip'); this.heldEl = this.$('held');
    this.miniCtx = this.$('mini').querySelector('canvas').getContext('2d');
    this.bigCv = this.$('mapview').querySelector('canvas'); this.bigCtx = this.bigCv.getContext('2d');
    this.mapCv = [0, 1].map(() => { const c = document.createElement('canvas'); c.width = MAP_W; c.height = MAP_H; return c; });
    this.mapCtx = this.mapCv.map((c) => c.getContext('2d'));
    this.mapImg = this.mapCtx.map((c) => c.createImageData(MAP_W, MAP_H));

    // 단축바
    const hb = this.$('hotbar');
    for (let i = 0; i < HOTBAR; i++) {
      const v = this.mkSlot(hb, 'inv', i, 'inv');
      v.el.append(el('span', 'key', String(i + 1)));
      this.hotViews.push(v);
    }

    // 버튼
    r.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      this.audio.play('click');
      if (b.dataset.act === 'help') this.toggle('help');
      if (b.dataset.act === 'map') this.toggle('map');
    });
    const click = (id, fn) => this.$(id).addEventListener('click', () => { this.audio.unlock(); this.audio.play('click'); fn(); });
    click('b-continue', () => this.on.continue && this.on.continue());
    click('b-new', () => this.on.new && this.on.new(this.$('seed').value.trim()));
    click('p-resume', () => this.togglePause(false));
    click('p-save', () => this.game.save(true));
    click('p-title', () => this.on.title && this.on.title());
    click('c-no', () => { this.confirmOpen = false; this.$('confirm').classList.add('hidden'); });
    click('c-yes', () => { this.confirmOpen = false; this.$('confirm').classList.add('hidden'); if (this.confirmCb) this.confirmCb(); });
    for (const k of ['sfx', 'music']) {
      const s = this.$('v-' + k), t = this.$(`v-${k}-t`);
      s.value = Math.round(this.audio.vol[k] * 100); t.textContent = s.value;
      s.addEventListener('input', () => { this.audio.setVolume(k, s.value / 100); t.textContent = s.value; });
      s.addEventListener('change', () => this.audio.play(k === 'sfx' ? 'pickup' : 'click'));
    }
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
      if (this.held) { this.heldEl.style.left = e.clientX + 'px'; this.heldEl.style.top = e.clientY + 'px'; }
      if (this.tipFor) this.placeTip();
    });
    // 창을 연 채로 바깥(게임 화면)을 클릭하면 집고 있던 아이템을 떨어뜨린다
    document.getElementById('game').addEventListener('mousedown', () => {
      if (this.mode && this.held) {
        const p = this.game.player;
        this.game.spawnDrop(this.held.id, this.held.n, p.x, p.y - 4).t = -1;
        this.held = null; this.dirty = true;
      }
    });
  }

  // ── 슬롯 ──
  arr(src) { return src === 'inv' ? this.game.inv.slots : this.ent ? this.ent.slots : []; }
  mkSlot(parent, src, i, kind) {
    const e = el('div', 'slot'), ico = el('div', 'ico'), cnt = el('div', 'cnt');
    e.append(ico, cnt); parent.append(e);
    const v = { el: e, ico, cnt, src, i, kind, key: '' };
    e.addEventListener('mousedown', (ev) => { ev.preventDefault(); this.slotClick(v, ev); });
    e.addEventListener('mouseenter', () => { this.tipFor = { v }; this.cache.tip = null; });
    e.addEventListener('mouseleave', () => { if (this.tipFor && this.tipFor.v === v) this.hideTip(); });
    return v;
  }
  accepts(kind, id) {
    if (kind === 'fout') return false;
    if (kind === 'fin') return !!SMELT[id];
    if (kind === 'ffuel') return !!ITEMS[id].fuel;
    return true;
  }
  slotClick(v, e) {
    const g = this.game;
    if (!g || g.state !== 'play') return;
    // 창이 닫혀 있을 때 단축바를 누르면 그 칸을 고른다
    if (!this.mode) {
      if (v.src === 'inv' && v.i < HOTBAR && g.hotbar !== v.i) { g.hotbar = v.i; this.audio.play('select'); this.dirty = true; }
      return;
    }
    const arr = this.arr(v.src), i = v.i, s = arr[i], h = this.held, ok = (id) => this.accepts(v.kind, id);
    if (e.shiftKey && s) { this.quickMove(v); this.after(); return; }
    if (e.button === 0) {
      if (!h) { if (s) { this.held = s; arr[i] = null; } }
      else if (!s) { if (ok(h.id)) { arr[i] = h; this.held = null; } }
      else if (s.id === h.id && ok(h.id)) {
        const k = Math.min(h.n, maxStack(s.id) - s.n);
        s.n += k; h.n -= k; if (h.n <= 0) this.held = null;
      }
      else if (v.kind === 'fout') { if (s.id === h.id && h.n + s.n <= maxStack(h.id)) { h.n += s.n; arr[i] = null; } }
      else if (ok(h.id)) { arr[i] = h; this.held = s; }
    } else if (e.button === 2) {
      if (!h) { if (s) { const k = Math.ceil(s.n / 2); this.held = { id: s.id, n: k }; s.n -= k; if (s.n <= 0) arr[i] = null; } }
      else if (ok(h.id) && (!s || (s.id === h.id && s.n < maxStack(s.id)))) {
        if (!s) arr[i] = { id: h.id, n: 1 }; else s.n++;
        h.n--; if (h.n <= 0) this.held = null;
      }
    }
    this.after();
  }
  after() { this.audio.play('click'); this.dirty = true; this.cache.tip = null; }
  // 배열의 [from, to) 범위에 아이템 넣기 → 남은 개수
  addTo(arr, from, to, id, n) {
    const max = maxStack(id);
    for (let i = from; i < to && n > 0; i++) { const s = arr[i]; if (s && s.id === id && s.n < max) { const k = Math.min(n, max - s.n); s.n += k; n -= k; } }
    for (let i = from; i < to && n > 0; i++) { if (!arr[i]) { const k = Math.min(n, max); arr[i] = { id, n: k }; n -= k; } }
    return n;
  }
  quickMove(v) {
    const arr = this.arr(v.src), s = arr[v.i], inv = this.game.inv.slots;
    let left = s.n;
    if (v.src === 'ent') left = this.addTo(inv, 0, inv.length, s.id, s.n);
    else if (this.mode === 'chest') left = this.addTo(this.ent.slots, 0, 27, s.id, s.n);
    else if (this.mode === 'furnace') {
      const f = this.ent.slots, smeltable = !!SMELT[s.id], fuel = !!ITEMS[s.id].fuel;
      if (smeltable && (!f[0] || f[0].id === s.id || !fuel)) left = this.addTo(f, 0, 1, s.id, s.n);
      else if (fuel) left = this.addTo(f, 1, 2, s.id, s.n);
    }
    else if (v.i < HOTBAR) left = this.addTo(inv, HOTBAR, inv.length, s.id, s.n);
    else left = this.addTo(inv, 0, HOTBAR, s.id, s.n);
    if (left <= 0) arr[v.i] = null; else s.n = left;
  }
  renderSlots() {
    const g = this.game;
    const draw = (v, sel) => {
      const s = this.arr(v.src)[v.i], key = (s ? s.id + ':' + s.n : '') + (sel ? '*' : '');
      if (key === v.key) return;
      v.key = key;
      v.ico.style.backgroundImage = s ? `url(${this.icon(s.id)})` : '';
      v.cnt.textContent = s && s.n > 1 ? s.n : '';
      v.el.classList.toggle('sel', !!sel);
    };
    this.hotViews.forEach((v, i) => draw(v, i === g.hotbar));
    for (const v of this.views) draw(v, v.src === 'inv' && v.i === g.hotbar && v.i < HOTBAR);
    for (const rv of this.recViews) {
      const can = g.inv.has(rv.r.in);
      rv.el.classList.toggle('dim', !can); rv.el.classList.toggle('can', can);
    }
    if (this.held) {
      this.heldEl.classList.remove('hidden');
      this.heldEl.firstChild.style.backgroundImage = `url(${this.icon(this.held.id)})`;
      this.heldEl.lastChild.textContent = this.held.n > 1 ? this.held.n : '';
      this.heldEl.style.left = this.mouse.x + 'px'; this.heldEl.style.top = this.mouse.y + 'px';
    } else this.heldEl.classList.add('hidden');
  }

  // ── 창 ──
  open(mode, ent) {
    if (this.titleOpen || this.pauseOpen || this.mapOpen) return;
    if (this.mode) this.close(true);
    this.mode = mode; this.ent = ent || null;
    if (mode === 'flag') return this.openFlag(ent);
    const win = (this.win = el('div')); win.id = 'window';
    const left = el('div', 'panel side'), right = el('div', 'panel');
    const names = { inventory: '제작', workbench: '제작대', furnace: '화로', chest: '상자' };
    const bar = el('div', 'title-bar', `<h2>${names[mode]}</h2>`);
    const x = el('button', 'x', '✕'); x.addEventListener('click', () => this.close()); bar.append(x);
    left.append(bar);
    if (mode === 'inventory' || mode === 'workbench') {
      const cats = {};
      for (const r of RECIPES) { if (r.station && mode !== 'workbench') continue; (cats[r.cat] ||= []).push(r); }
      for (const c in cats) {
        left.append(el('div', 'cat', CATEGORY_NAMES[c]));
        const box = el('div', 'recipes');
        for (const r of cats[c]) {
          const e = el('div', 'slot'), ico = el('div', 'ico'), cnt = el('div', 'cnt', r.n > 1 ? r.n : '');
          ico.style.backgroundImage = `url(${this.icon(r.out)})`;
          e.append(ico, cnt); box.append(e);
          const rv = { el: e, r };
          e.addEventListener('mousedown', (ev) => { ev.preventDefault(); this.game.craft(r, ev.shiftKey ? 10 : 1); this.dirty = true; this.cache.tip = null; });
          e.addEventListener('mouseenter', () => { this.tipFor = { r }; this.cache.tip = null; });
          e.addEventListener('mouseleave', () => { if (this.tipFor && this.tipFor.r === r) this.hideTip(); });
          this.recViews.push(rv);
        }
        left.append(box);
      }
      left.append(el('div', 'note', mode === 'inventory'
        ? '밝게 표시된 것은 지금 만들 수 있어요. 클릭하면 제작합니다.<br>제작대를 설치하고 <b>우클릭</b>하면 도구·건축물도 만들 수 있어요.'
        : '클릭: 1번 제작 · Shift+클릭: 10번 제작'));
    } else if (mode === 'furnace') {
      const f = el('div', 'furn');
      f.append(el('div', 'lab', '재료'), el('div'), el('div', 'lab', '결과'));
      this.views.push(this.mkSlot(f, 'ent', 0, 'fin'));
      const arrow = el('div', 'arrow', '<i></i>'); f.append(arrow); this.arrowEl = arrow.firstChild;
      this.views.push(this.mkSlot(f, 'ent', 2, 'fout'));
      this.views.push(this.mkSlot(f, 'ent', 1, 'ffuel'));
      const fl = el('div', 'flame', '<i></i>'); fl.style.width = '64px'; f.append(fl); this.flameEl = fl.firstChild;
      f.append(el('div'));
      f.append(el('div', 'lab', '연료'));
      left.append(f);
      left.append(el('div', 'note', '철광석·구리 광석·금광석은 주괴로, 원목은 숯으로, 버섯은 구운 버섯으로.<br>연료: 석탄 · 숯 · 원목 · 판자 · 막대기'));
    } else if (mode === 'chest') {
      const gr = el('div', 'grid');
      for (let i = 0; i < 27; i++) this.views.push(this.mkSlot(gr, 'ent', i, 'chest'));
      left.append(gr);
      left.style.maxWidth = 'none';
    }
    right.append(el('div', 'invtitle', '가방'));
    const g1 = el('div', 'grid'); for (let i = HOTBAR; i < this.game.inv.slots.length; i++) this.views.push(this.mkSlot(g1, 'inv', i, 'inv'));
    right.append(g1, el('div', 'gap'), el('div', 'invtitle', '단축바'));
    const g2 = el('div', 'grid'); for (let i = 0; i < HOTBAR; i++) this.views.push(this.mkSlot(g2, 'inv', i, 'inv'));
    right.append(g2);
    win.append(left, right);
    this.root.insertBefore(win, this.heldEl);
    this.dirty = true;
    this.audio.play('open');
  }
  openFlag(pos) {
    const g = this.game, cur = g.world.meta(pos.l, pos.x, pos.y);
    const win = (this.win = el('div')); win.id = 'window';
    const panel = el('div', 'panel');
    const bar = el('div', 'title-bar', '<h2>깃발 색 고르기</h2>');
    const x = el('button', 'x', '✕'); x.addEventListener('click', () => this.close()); bar.append(x);
    const box = el('div', 'swatches');
    FLAG_COLORS.forEach((fc, k) => {
      const b = el('button', 'sw' + (k === cur ? ' on' : ''));
      b.style.background = hex(fc.c); b.title = fc.name;
      b.addEventListener('click', () => {
        g.world.setMeta(pos.l, pos.x, pos.y, k);
        this.close(true);
        this.audio.play('craft');
        this.toast(`${fc.name} 깃발을 세웠어요. 지도에 표시됩니다`, 'good');
      });
      box.append(b);
    });
    panel.append(bar, box, el('div', 'note', '고른 색의 깃발이 미니맵과 지도(M)에 표시돼요.<br>멀어지면 미니맵 가장자리의 화살표가 방향을 알려 줍니다.'));
    win.append(panel);
    this.root.insertBefore(win, this.heldEl);
    this.audio.play('open');
  }
  close(silent) {
    if (!this.mode) return;
    if (this.held) {
      const left = this.game.inv.add(this.held.id, this.held.n);
      if (left > 0) this.game.spawnDrop(this.held.id, left, this.game.player.x, this.game.player.y - 4);
      this.held = null;
    }
    this.win.remove(); this.win = null;
    this.mode = null; this.ent = null; this.views = []; this.recViews = [];
    this.hideTip(); this.dirty = true;
    if (!silent) this.audio.play('close');
  }
  entGone(e) { if (this.ent === e) this.close(true); }

  // ── 툴팁 ──
  hideTip() { this.tipFor = null; this.tip.classList.add('hidden'); this.cache.tip = null; }
  itemTip(id) {
    const it = ITEMS[id];
    let x = '';
    if (it.food) x += `<div class="tx ok">포만감 +${it.food}</div>`;
    if (it.fuel) x += `<div class="tx">연료 ${it.fuel}초</div>`;
    if (it.tool) x += `<div class="tx">${['', '나무', '돌', '철'][it.tier]} 등급 도구</div>`;
    if (it.roof) x += '<div class="tx">들고 있으면 지붕이 비쳐 보여요.<br>빈 곳 클릭: 덮기 · 지붕 클릭: 걷어 내기 (끌어서 연속)</div>';
    if (it.place || it.seed) x += `<div class="tx">단축바에서 고르고 클릭하면 ${it.seed ? '심을' : '놓을'} 수 있어요</div>`;
    return `<div class="tn">${it.name}</div><div class="td">${it.desc}</div>${x}`;
  }
  updateTip() {
    const t = this.tipFor;
    if (!t) return;
    let html = '';
    if (t.r) {
      const inv = this.game.inv;
      html = this.itemTip(t.r.out).replace('</div>', `${t.r.n > 1 ? ' ×' + t.r.n : ''}</div>`) + '<div class="tx">필요한 재료</div>';
      for (const id in t.r.in) {
        const have = inv.count(id), need = t.r.in[id];
        html += `<div class="ing"><span class="ico" style="background-image:url(${this.icon(id)})"></span><span>${ITEMS[id].name}</span><span class="${have >= need ? 'ok' : 'no'}">${have}/${need}</span></div>`;
      }
    } else {
      const s = this.arr(t.v.src)[t.v.i];
      if (s) html = this.itemTip(s.id);
    }
    if (html !== this.cache.tip) {
      this.cache.tip = html;
      this.tip.innerHTML = html;
      this.tip.classList.toggle('hidden', !html);
    }
    if (html) this.placeTip();
  }
  placeTip() {
    const w = this.tip.offsetWidth, h = this.tip.offsetHeight;
    let x = this.mouse.x + 18, y = this.mouse.y + 18;
    if (x + w > innerWidth - 6) x = this.mouse.x - w - 12;
    if (y + h > innerHeight - 6) y = innerHeight - h - 6;
    this.tip.style.left = Math.max(4, x) + 'px'; this.tip.style.top = Math.max(4, y) + 'px';
  }

  // ── 알림 ──
  toast(text, kind = '') {
    const box = this.$('toasts');
    const now = performance.now();
    if (this.cache.toast === text && now - this.cache.toastT < 1200) return;
    this.cache.toast = text; this.cache.toastT = now;
    const t = el('div', 'toast ' + kind, text);
    box.append(t);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => { t.style.opacity = 0; setTimeout(() => t.remove(), 400); }, kind ? 3200 : 2300);
  }
  banner(text) { const b = this.$('banner'); b.textContent = text; b.classList.add('show'); this.bannerT = 2.2; }
  pickup(id, n) {
    const box = this.$('pickups'), now = performance.now();
    let p = this.pk && this.pk[id];
    if (p && now - p.t < 2400 && p.el.isConnected) { p.n += n; p.t = now; }
    else {
      const e = el('div', 'pk', `<span class="ico" style="background-image:url(${this.icon(id)})"></span><span></span>`);
      box.append(e);
      while (box.children.length > 6) box.firstChild.remove();
      p = { el: e, n, t: now };
      (this.pk ||= {})[id] = p;
    }
    p.el.lastChild.textContent = `${ITEMS[id].name} +${p.n}`;
    clearTimeout(p.timer);
    const e = p.el;
    p.timer = setTimeout(() => { e.style.opacity = 0; setTimeout(() => e.remove(), 400); }, 2400);
  }
  confirm(text, cb) {
    this.$('confirm-text').innerHTML = text; this.confirmCb = cb;
    this.confirmOpen = true; this.$('confirm').classList.remove('hidden');
  }

  // ── 화면 전환 ──
  showTitle(hasSave) {
    this.close(true);
    this.titleOpen = true; this.pauseOpen = false; this.mapOpen = false;
    this.$('title').classList.remove('hidden'); this.$('pause').classList.add('hidden'); this.$('mapview').classList.add('hidden');
    this.hud.classList.add('hidden');
    this.$('b-continue').classList.toggle('hidden', !hasSave);
    this.$('b-new').classList.toggle('primary', !hasSave);
    this.$('loading').classList.add('hidden');
  }
  hideTitle() {
    this.titleOpen = false;
    this.$('title').classList.add('hidden'); this.hud.classList.remove('hidden');
    this.dirty = true; this.cache = {};
    for (const v of this.hotViews) v.key = '?';
  }
  loading(on) { this.$('loading').classList.toggle('hidden', !on); }
  togglePause(on = !this.pauseOpen) {
    if (this.titleOpen) return;
    this.pauseOpen = on; this.game.paused = on;
    this.$('pause').classList.toggle('hidden', !on);
    if (on) this.game.save();
  }
  toggle(what) {
    if (what === 'help') { this.helpOpen = !this.helpOpen; this.$('help').classList.toggle('hidden', !this.helpOpen); }
    if (what === 'map') {
      if (this.titleOpen || this.pauseOpen) return;
      this.mapOpen = !this.mapOpen; this.$('mapview').classList.toggle('hidden', !this.mapOpen);
      if (this.mapOpen) {
        const size = Math.max(256, Math.min(innerHeight - 190, innerWidth - 80, 768));
        this.bigCv.style.width = this.bigCv.style.height = size + 'px';
        this.$('maptitle').textContent = this.game.layer === CAVE ? '지도 — 지하' : '지도 — 지상';
        this.mapAcc = 9; this.audio.play('open');
      }
    }
  }
  handleKeys(inp) {
    const g = this.game;
    if (inp.hit('Escape')) {
      if (this.helpOpen) this.toggle('help');
      else if (this.confirmOpen) { this.confirmOpen = false; this.$('confirm').classList.add('hidden'); }
      else if (this.titleOpen) { /* 타이틀에서는 아무 것도 하지 않는다 */ }
      else if (this.mode) this.close();
      else if (this.mapOpen) this.toggle('map');
      else this.togglePause();
    }
    if (this.titleOpen || this.pauseOpen || this.helpOpen || this.confirmOpen || g.state !== 'play') return;
    if (inp.hit('KeyE') || inp.hit('Tab')) { if (this.mode) this.close(); else if (!this.mapOpen) this.open('inventory'); }
    if (inp.hit('KeyM') && !this.mode) this.toggle('map');
  }

  // ── 지도 ──
  rebuildMap(l) {
    const w = this.game.world, Lr = w.layers[l], d = this.mapImg[l].data;
    for (let i = 0; i < N; i++) {
      let c = 0x0e0c14;
      if (Lr.seen[i]) { const o = Lr.obj[i]; c = Lr.roof[i] ? ROOF_COLOR : o && OBJ[o].map >= 0 ? OBJ[o].map : GROUND[Lr.ground[i]].color; }
      const j = i * 4;
      d[j] = (c >> 16) & 255; d[j + 1] = (c >> 8) & 255; d[j + 2] = c & 255; d[j + 3] = 255;
    }
    this.mapCtx[l].putImageData(this.mapImg[l], 0, 0);
  }
  // 지금 목표가 가리키는 곳 (동굴 찾기 퀘스트일 때 가장 가까운 입구)
  hint() {
    const g = this.game;
    if (g.layer === CAVE || g.quest !== 6) return null;
    const px = g.player.x / TILE, py = g.player.y / TILE;
    let best = null, bd = Infinity;
    for (const e of g.world.entrances) { const d = (e.x - px) ** 2 + (e.y - py) ** 2; if (d < bd) { bd = d; best = e; } }
    return best;
  }
  drawMini() {
    const g = this.game, c = this.miniCtx, L = g.layer, half = MINI >> 1;
    const px = Math.floor(g.player.x / TILE), py = Math.floor(g.player.y / TILE);
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#0e0c14'; c.fillRect(0, 0, MINI, MINI);
    c.drawImage(this.mapCv[L], px - half, py - half, MINI, MINI, 0, 0, MINI, MINI);
    const seen = g.world.layers[L].seen, blink = ((performance.now() / 350) | 0) % 2;
    for (const e of g.world.entrances) {
      const x = e.x - px + half, y = e.y - py + half;
      if (x < 1 || y < 1 || x > MINI - 2 || y > MINI - 2 || !seen[e.y * MAP_W + e.x]) continue;
      c.fillStyle = '#241a2b'; c.fillRect(x - 2, y - 2, 5, 5); c.fillStyle = '#f4c430'; c.fillRect(x - 1, y - 1, 3, 3);
    }
    const h = this.hint();
    if (h) {
      let dx = h.x - px, dy = h.y - py;
      const m = Math.max(Math.abs(dx), Math.abs(dy));
      if (m > half - 3) { const k = (half - 3) / m; dx *= k; dy *= k; }
      if (blink) { c.fillStyle = '#241a2b'; c.fillRect(half + dx - 3, half + dy - 3, 7, 7); c.fillStyle = '#ffe27a'; c.fillRect(half + dx - 2, half + dy - 2, 5, 5); }
    }
    // 깃발: 범위 안이면 깃발 아이콘, 멀리 있으면 가장자리에 그 색 화살표 (가까운 순으로 8개까지)
    const meta = g.world.layers[L].meta, far = [];
    for (const i of g.world.flags[L]) {
      const dx = (i % MAP_W) - px, dy = ((i / MAP_W) | 0) - py;
      if (Math.abs(dx) <= half - 6 && dy >= -(half - 9) && dy <= half - 2) this.flagIcon(c, half + dx, half + dy, flagHex(meta[i]));
      else far.push([dx * dx + dy * dy, dx, dy, meta[i]]);
    }
    far.sort((a, b) => a[0] - b[0]);
    for (const [, dx, dy, m] of far.slice(0, 8)) {
      const k = (half - 7) / Math.max(Math.abs(dx), Math.abs(dy));
      this.arrowIcon(c, Math.round(half + dx * k), Math.round(half + dy * k), Math.atan2(dy, dx), flagHex(m));
    }
    c.fillStyle = '#241a2b'; c.fillRect(half - 2, half - 2, 5, 5);
    c.fillStyle = '#ffffff'; c.fillRect(half - 1, half - 1, 3, 3);
  }
  // 지도용 깃발 (x, y = 깃대가 꽂힌 칸)
  flagIcon(c, x, y, color) {
    c.fillStyle = '#241a2b'; c.fillRect(x - 1, y - 8, 3, 10); c.fillRect(x, y - 9, 8, 7);
    c.fillStyle = '#f0f0f5'; c.fillRect(x, y - 7, 1, 8);
    c.fillStyle = color; c.fillRect(x + 1, y - 8, 6, 5);
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(x + 1, y - 8, 6, 1);
  }
  // 깃발 쪽을 가리키는 작은 화살표 (도트가 뭉개지지 않게 픽셀 단위로 찍는다)
  arrowIcon(c, cx, cy, ang, color) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    for (let pass = 0; pass < 2; pass++) {
      c.fillStyle = pass ? color : '#241a2b';
      const gr = pass ? 0 : 1.1;
      for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) {
        const al = x * dx + y * dy, pe = Math.abs(y * dx - x * dy);
        const head = al >= 0.5 - gr && al <= 4.5 + gr && pe <= (4.5 - al) * 0.8 + gr;   // 화살촉
        const shaft = al >= -4 - gr && al < 0.5 && pe <= 0.75 + gr;                     // 자루
        if (head || shaft) c.fillRect(cx + x, cy + y, 1, 1);
      }
    }
  }
  drawBig() {
    const g = this.game, c = this.bigCtx, L = g.layer;
    c.imageSmoothingEnabled = false;
    c.drawImage(this.mapCv[L], 0, 0);
    const seen = g.world.layers[L].seen;
    for (const e of g.world.entrances) {
      if (!seen[e.y * MAP_W + e.x]) continue;
      c.fillStyle = '#241a2b'; c.fillRect(e.x - 3, e.y - 3, 7, 7); c.fillStyle = '#f4c430'; c.fillRect(e.x - 2, e.y - 2, 5, 5);
    }
    const meta = g.world.layers[L].meta;
    for (const i of g.world.flags[L]) this.flagIcon(c, i % MAP_W, (i / MAP_W) | 0, flagHex(meta[i]));
    const px = Math.floor(g.player.x / TILE), py = Math.floor(g.player.y / TILE);
    const b = ((performance.now() / 300) | 0) % 2;
    c.fillStyle = '#241a2b'; c.fillRect(px - 4, py - 4, 9, 9);
    c.fillStyle = b ? '#ffffff' : '#f0645c'; c.fillRect(px - 3, py - 3, 7, 7);
  }

  // ── 매 프레임 ──
  update(dt) {
    const g = this.game;
    this.$('fade').style.opacity = g.fadeAlpha;
    if (this.bannerT > 0 && (this.bannerT -= dt) <= 0) this.$('banner').classList.remove('show');
    if (g.state !== 'play') return;
    const set = (key, val, fn) => { if (this.cache[key] !== val) { this.cache[key] = val; fn(val); } };

    // 시계 · 포만감
    const h = g.hour, hh = Math.floor(h), mm = Math.floor(((h - hh) * 60) / 10) * 10;
    const txt = `${g.day}일차 · ${hh < 12 ? '오전' : '오후'} ${hh % 12 === 0 ? 12 : hh % 12}:${String(mm).padStart(2, '0')}${g.layer === CAVE ? ' · 지하' : ''}`;
    set('clock', txt, (v) => { this.$('clocktxt').textContent = v; });
    set('moon', g.night, (v) => this.$('sun').classList.toggle('moon', v));
    const hu = Math.ceil(g.player.hunger);
    set('hunger', hu, (v) => {
      this.$('hungerbar').firstChild.style.width = v + '%';
      this.$('hungerbar').classList.toggle('low', v <= 20);
      this.$('hungertxt').textContent = v <= 0 ? '배고파서 힘이 없어요!' : v <= 20 ? '배고파요' : '';
    });
    // 목표
    const q = QUESTS[g.quest], pr = q.prog ? q.prog(g) : null;
    set('quest', g.quest + '|' + (pr ? pr[0] : ''), () => {
      this.$('quest').innerHTML = `<div class="qh">${q.last ? '개발 중' : `목표 ${g.quest + 1} / ${QUESTS.length - 1}`}</div><div class="qt">${q.title}</div><div class="qd">${q.desc}</div>${pr ? `<div class="qp">${Math.min(pr[0], pr[1])} / ${pr[1]}</div>` : ''}`;
    });
    // 안내
    const promptOn = !!g.prompt && !this.blocking;
    set('prompt', promptOn ? g.prompt : '', (v) => {
      const p = this.$('prompt');
      p.classList.toggle('hidden', !v);
      if (v) p.innerHTML = `<b>우클릭 · F</b>&nbsp; ${v}`;
    });
    // 들고 있는 아이템 이름
    const hs = g.heldSlot(), hid = (hs ? hs.id : '') + '@' + g.hotbar;
    if (this.cache.heldid !== hid) {
      this.cache.heldid = hid; this.nameT = 1.8;
      const n = this.$('heldname'); n.textContent = hs ? ITEMS[hs.id].name : ''; n.style.opacity = 1;
    }
    if (this.nameT > 0 && (this.nameT -= dt) <= 0) this.$('heldname').style.opacity = 0;
    // 좌표
    const px = Math.floor(g.player.x / TILE), py = Math.floor(g.player.y / TILE);
    set('coords', px + ',' + py, () => { this.$('coords').textContent = `X ${px} · Y ${py}`; });

    // 화로 게이지
    if (this.mode === 'furnace' && this.ent) {
      const e = this.ent, rec = e.slots[0] ? SMELT[e.slots[0].id] : null;
      this.arrowEl.style.width = (rec ? Math.min(100, (e.prog / rec.time) * 100) : 0) + '%';
      this.flameEl.style.width = (e.burnMax ? Math.max(0, (e.burn / e.burnMax) * 100) : 0) + '%';
      if (e.touched) { e.touched = false; this.dirty = true; }
    }
    if (this.dirty) { this.dirty = false; this.renderSlots(); this.cache.tip = null; }
    this.updateTip();

    // 지도
    this.mapAcc += dt; this.miniAcc += dt;
    if (this.mapDirty[g.layer] && this.mapAcc > 0.5) { this.mapAcc = 0; this.mapDirty[g.layer] = false; this.rebuildMap(g.layer); }
    if (this.miniAcc > 0.1) { this.miniAcc = 0; this.drawMini(); if (this.mapOpen) this.drawBig(); }
  }
}
