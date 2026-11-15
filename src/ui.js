// DOM 기반 UI: HUD, 단축바, 가방·제작·화로·상자 창, 지도, 타이틀·일시정지 메뉴
import { MAP_W, MAP_H, TILE, CAVE, HOTBAR, PLAYER_COLORS, DAY_LENGTH, VERSION } from './config.js';
import { GROUND } from './data/ground.js';
import { O, OBJ, FLAG_COLORS, SAPLING_ITEMS, SIGN_LINES, SIGN_COLS } from './data/objects.js';
import { hex } from './gfx/pix.js';
import { ITEMS, RECIPES, MACHINE, CATEGORY_NAMES, SWORD_DMG } from './data/items.js';
import { MOBS } from './data/mobs.js';
import { maxStack } from './inventory.js';
import { QUESTS } from './quests.js';
import { listWorlds, loadWorld, currentWorld, renameWorld, deleteWorld, listBackups, loadBackup, exportBlob, importFile, fileName, storageInfo, serialize } from './save.js';
import { MAX_PLAYERS } from './net.js';

const N = MAP_W * MAP_H;
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};
const MINI = 78;
const ROOF_COLOR = 0xa8503a;
const SIGN_FAR = 6.5;        // 이 거리(타일) 안의 표지판은 글이 보인다 (가까울수록 또렷하게)
const flagHex = (m) => hex(FLAG_COLORS[m % FLAG_COLORS.length].c);
const playerHex = (c) => hex(PLAYER_COLORS[c % PLAYER_COLORS.length]);
const when = (ts) => { const d = new Date(ts), p = (n) => String(n).padStart(2, '0'); return `${d.getMonth() + 1}월 ${d.getDate()}일 ${p(d.getHours())}:${p(d.getMinutes())}`; };
const REASON = { auto: '자동', new: '새 게임 시작 전', restore: '되돌리기 전', import: '파일 불러오기 전' };
const JOIN_ERR = {
  'peer-unavailable': '그 코드의 방을 찾지 못했어요. 코드를 다시 확인해 주세요.',
  full: `방이 가득 찼어요. (최대 ${MAX_PLAYERS}명)`,
  version: '게임 버전이 서로 달라요. 둘 다 새로고침한 뒤 다시 해 보세요.',
  timeout: '연결하지 못했어요. 회사·학교 같은 일부 네트워크에서는 직접 연결이 막힐 수 있어요.',
  closed: '방장과의 연결이 끊어졌어요.',
  lib: '멀티플레이 모듈을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.',
};
const joinErr = (e) => JOIN_ERR[e && e.type] || '중계 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.';

export class UI {
  constructor(root, atlas, audio) {
    this.root = root; this.atlas = atlas; this.audio = audio;
    this.game = null; this.renderer = null;
    this.dirty = true; this.mapDirty = [true, true];
    this.mode = null; this.ent = null; this.ent2 = null; this.held = null;
    this.views = []; this.recViews = []; this.hotViews = [];
    this.titleOpen = true; this.pauseOpen = false; this.mapOpen = false; this.helpOpen = false; this.confirmOpen = false;
    this.panel = null; this.chatOpen = false; this.labels = new Map(); this.signLabs = new Map();
    this.cache = {}; this.mouse = { x: 0, y: 0 }; this.tipFor = null;
    this.mapAcc = 9; this.miniAcc = 9; this.nameT = 0; this.bannerT = 0;
    this.on = {};
    this.build();
  }
  attach(game, renderer) { this.game = game; this.renderer = renderer; }
  get blocking() { return !!this.mode || this.titleOpen || this.pauseOpen || this.mapOpen || this.helpOpen || this.confirmOpen || !!this.panel || this.chatOpen; }
  icon(id) { return ITEMS[id] ? this.atlas.url(ITEMS[id].icon) : ''; }
  $(id) { return this.root.querySelector('#' + id); }

  build() {
    const r = this.root;
    r.innerHTML = `
      <div id="hud" class="hidden">
        <div id="groggy" class="hidden"></div>
        <div id="status">
          <div id="clock"><span id="sun"></span><span id="clocktxt"></span></div>
          <div class="barlabel"><span>포만감</span><span id="hungertxt"></span></div>
          <div class="bar" id="hungerbar"><i></i></div>
        </div>
        <div id="quest"></div>
        <div id="mini"><canvas width="${MINI}" height="${MINI}"></canvas><div id="coords"></div><div id="room" class="hidden"></div></div>
        <div id="signs"></div>
        <div id="names"></div>
        <div id="chat"></div>
        <input id="chatin" class="hidden" maxlength="120" placeholder="메시지를 쓰고 Enter (취소: Esc)" autocomplete="off">
        <div id="hints"><b>WASD</b> 이동 · <b>좌클릭</b> 캐기/놓기 · <b>우클릭</b> 사용/먹기<br><b>E</b> 가방·제작 · <b>M</b> 지도 · <b>Q</b> 버리기 · <b>R</b> 돌리기 · <b>Esc</b> 메뉴</div>
        <div id="pickups"></div>
        <div id="hover" class="hidden"><canvas width="32" height="32"></canvas><span id="hovername"></span><span id="hoversub" class="sub"></span></div>
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
          <button class="btn" id="b-worlds" data-act="worlds">세계 목록 · 세이브 관리</button>
          <button class="btn" id="b-new" data-act="newworld">새 세계 만들기</button>
          <button class="btn" data-act="join">친구 방에 참가</button>
          <div class="row2"><button class="btn small" data-act="help">조작법</button></div>
        </div>
        <div id="foot">v${VERSION} · 지상과 지하 · 공장의 시작 · 멀티플레이 · 소리를 켜고 즐겨 주세요</div>
        <div id="credit">Developed by <b>Geonhee15</b> with <b>Claude Fable 5.2</b></div>
      </div>
      <div id="pause" class="hidden"><div class="shade"></div>
        <div class="panel center" style="width:310px">
          <div class="title-bar"><h2 id="pause-title">일시정지</h2></div>
          <div class="menu" style="width:auto">
            <button class="btn primary" id="p-resume">계속하기</button>
            <button class="btn" id="p-save">저장하기</button>
            <button class="btn" data-act="mp">멀티플레이</button>
            <div class="row2"><button class="btn small" data-act="saves" id="p-saves">세이브 관리</button><button class="btn small" data-act="help">조작법</button></div>
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
            <kbd>좌클릭 (길게)</kbd><span>캐기 · 베기 · 동물 때리기 / 들고 있는 것 놓기 · 심기 · 갈기 · 다지기</span>
            <kbd>우클릭</kbd><span>사용하기 (제작대·화로·압축기·상자·문·침대·표지판·동굴·열매 따기) / 먹기</span>
            <kbd>R</kbd><span>가리킨 설치물을 시계 방향으로 돌리기 (들고 있을 때는 놓을 방향)</span>
            <kbd>1 ~ 9 · 마우스 휠</kbd><span>단축바 선택</span>
            <kbd>E · Tab</kbd><span>가방과 제작 창</span>
            <kbd>M</kbd><span>지도</span>
            <kbd>Q</kbd><span>들고 있는 아이템 하나 버리기</span>
            <kbd>Space · F</kbd><span>바라보는 칸을 캐기 · 사용하기 (키보드만으로)</span>
            <kbd>- · =</kbd><span>화면 확대 / 축소</span>
            <kbd>Esc</kbd><span>창 닫기 · 일시정지</span>
          </div>
          <div class="note">가방 창에서는 <b>Shift+클릭</b>으로 빠르게 옮기고, <b>우클릭</b>으로 절반만 집거나 하나씩 놓을 수 있어요.<br>도구는 종류가 맞아야 빨라집니다: 나무엔 도끼, 돌과 광석엔 곡괭이.<br><b>삽</b>을 들고 땅을 누른 채 끌면 길이 다져져요. 길 위에서는 조금 더 빨리 걷고, 지도에도 보입니다.<br>풀밭의 <b>동물</b>은 마우스로 가리키고 누르면 때립니다. <b>검</b>이 가장 세요. <b>울타리</b>는 동물도 나도 넘지 못하고, <b>울타리 문</b>은 나만 여닫을 수 있어요. 먹이를 손에 들면 동물이 따라옵니다: <b>당근</b>은 돼지, <b>씨앗</b>은 닭, <b>밀</b>은 소와 양.<br><b>표지판</b>은 빈 땅에 세우거나 블록에 대고 눌러 나무 판으로 붙이고, 글을 쓸 수 있어요. <b>상자</b> 두 개를 나란히 놓으면 큰 상자가 됩니다.<br>포만감이 바닥나면 <b>그로기</b> 상태가 되어 기어가듯 느려지고, 2분 안에 먹지 못하면 쓰러져요. 쓰러지면 가방의 물건을 그 자리에 쏟고, 리스폰 지점(우클릭한 <b>침대</b>)에서 다시 일어납니다.<br><b>컨베이어 벨트</b>는 놓인 방향(R로 돌림)으로 물건을 나릅니다. 앞에 붙은 상자·기계에는 넣고, 뒤에 붙은 상자·기계에서는 꺼내요. <b>압축기</b>는 재료 3개를 판 하나로 누릅니다.<br>마우스로 가리킨 것의 이름은 화면 <b>오른쪽 아래</b>에 나옵니다.</div>
        </div>
      </div>
      <div id="join" class="hidden"><div class="shade"></div>
        <div class="panel center" style="width:350px;max-width:92vw">
          <div class="title-bar"><h2>친구 방에 참가</h2><button class="x" data-act="close">✕</button></div>
          <label class="field"><span>내 이름</span><input id="j-name" maxlength="12" spellcheck="false" autocomplete="off"></label>
          <label class="field"><span>방 코드</span><input id="j-code" maxlength="6" placeholder="6글자" spellcheck="false" autocomplete="off" style="text-transform:uppercase;letter-spacing:4px"></label>
          <button class="btn primary" id="j-go" style="width:100%;margin-top:10px">참가하기</button>
          <div id="j-status" class="status"></div>
          <div class="note">방장이 알려 준 코드를 넣으면 방장의 세계로 들어갑니다.<br>세계는 방장의 것이고, 내 가방과 진행도는 이 브라우저에 따로 저장돼요.</div>
        </div>
      </div>
      <div id="mp" class="hidden"><div class="shade"></div>
        <div class="panel center" style="width:370px;max-width:92vw">
          <div class="title-bar"><h2>멀티플레이</h2><button class="x" data-act="close">✕</button></div>
          <div id="mp-body"></div>
        </div>
      </div>
      <div id="saves" class="hidden"><div class="shade"></div>
        <div class="panel center" style="width:470px;max-width:94vw">
          <div class="title-bar"><h2 id="saves-title">세이브 관리</h2><button class="x" data-act="close">✕</button></div>
          <div id="saves-body"></div>
          <input type="file" id="s-file" accept=".mfsave" class="hidden">
        </div>
      </div>
      <div id="worlds" class="hidden"><div class="shade"></div>
        <div class="panel center" style="width:470px;max-width:94vw">
          <div class="title-bar"><h2>세계 목록</h2><button class="x" data-act="close">✕</button></div>
          <div id="worlds-body"></div>
        </div>
      </div>
      <div id="newworld" class="hidden"><div class="shade"></div>
        <div class="panel center" style="width:350px;max-width:92vw">
          <div class="title-bar"><h2>새 세계 만들기</h2><button class="x" data-act="close">✕</button></div>
          <label class="field"><span>이름</span><input id="nw-name" maxlength="20" spellcheck="false" autocomplete="off"></label>
          <label class="field"><span>시드</span><input id="nw-seed" maxlength="18" placeholder="비워 두면 무작위" spellcheck="false" autocomplete="off"></label>
          <button class="btn primary" id="nw-go" style="width:100%;margin-top:10px">만들고 시작하기</button>
          <div class="note">세계는 하나씩 따로 저장돼요. 새 세계를 만들어도 다른 세계는 그대로 남고, 타이틀 화면의 <b>세계 목록</b>에서 골라 플레이할 수 있어요.<br>같은 시드를 넣으면 같은 모양의 섬이 만들어집니다.</div>
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
      const act = b.dataset.act;
      if (act === 'help') this.toggle('help');
      if (act === 'map') this.toggle('map');
      if (act === 'close') this.showPanel(null);
      if (act === 'saves') this.savesKey = currentWorld();          // 플레이 중에 여는 세이브 관리는 지금 세계의 것
      if (act === 'join' || act === 'saves' || act === 'mp' || act === 'worlds' || act === 'newworld') { this.audio.unlock(); this.showPanel(act); }
    });
    const newGo = () => { this.audio.unlock(); this.audio.play('click'); if (this.on.new) this.on.new(this.$('nw-name').value, this.$('nw-seed').value.trim()); };
    this.$('nw-go').addEventListener('click', newGo);
    for (const id of ['nw-name', 'nw-seed']) this.$(id).addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) newGo(); });
    // 글을 쓰는 칸에서는 게임 쪽 키 입력이 막혀 있으므로, 창 닫기(Esc)는 여기서 받는다
    r.addEventListener('keydown', (e) => { if (e.key === 'Escape' && e.target.tagName === 'INPUT' && this.panel) { e.target.blur(); this.showPanel(null); } });
    this.$('j-go').addEventListener('click', () => {
      this.audio.unlock(); this.audio.play('click');
      const code = this.$('j-code').value.trim().toUpperCase();
      if (code.length < 4) { this.joinStatus('방 코드를 입력해 주세요.', true); return; }
      if (this.on.join) this.on.join(this.$('j-name').value, code);
    });
    this.$('j-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.$('j-go').click(); });
    this.$('s-file').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) this.importSave(f); });
    const ci = this.$('chatin');
    ci.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) this.closeChat(true);
      else if (e.key === 'Escape') this.closeChat(false);
    });
    ci.addEventListener('blur', () => { if (this.chatOpen) this.closeChat(false); });
    const click = (id, fn) => this.$(id).addEventListener('click', () => { this.audio.unlock(); this.audio.play('click'); fn(); });
    click('b-continue', () => this.on.continue && this.on.continue());
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
        this.game.spawnDrop(this.held.id, this.held.n, p.x, p.y - 4, { t: -1 });
        this.held = null; this.dirty = true;
      }
    });
  }

  // ── 슬롯 ──
  // src: 'inv' 가방 · 'ent' 상자·화로 · 'ent2' 큰 상자의 뒤쪽 반
  arr(src) { const e = src === 'ent2' ? this.ent2 : this.ent; return src === 'inv' ? this.game.inv.slots : e ? e.slots : []; }
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
    if (kind === 'fin') return !!(MACHINE[this.mode] && MACHINE[this.mode][id]);
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
    if (v.src !== 'inv') left = this.addTo(inv, 0, inv.length, s.id, s.n);
    else if (this.mode === 'chest') {
      left = this.addTo(this.ent.slots, 0, 27, s.id, s.n);
      if (left > 0 && this.ent2) left = this.addTo(this.ent2.slots, 0, 27, s.id, left);
    }
    else if (MACHINE[this.mode]) {
      const f = this.ent.slots, smeltable = !!MACHINE[this.mode][s.id], fuel = !!ITEMS[s.id].fuel;
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
  // ent2: 큰 상자를 열 때의 뒤쪽 반 (동 · 남쪽 칸)
  open(mode, ent, ent2) {
    if (this.titleOpen || this.pauseOpen || this.mapOpen) return;
    if (this.mode) this.close(true);
    this.mode = mode; this.ent = ent || null; this.ent2 = ent2 || null;
    if (mode === 'flag') return this.openFlag(ent);
    if (mode === 'sign') return this.openSign(ent);
    const win = (this.win = el('div')); win.id = 'window';
    const left = el('div', 'panel side'), right = el('div', 'panel');
    const names = { inventory: '제작', workbench: '제작대', furnace: '화로', compressor: '압축기', chest: ent2 ? '큰 상자' : '상자' };
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
    } else if (MACHINE[mode]) {
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
      left.append(el('div', 'note', mode === 'compressor'
        ? '재료 <b>3개</b>를 눌러 판 하나로: 화강암 · 안산암 · 철 주괴 · 금 주괴 · 구리 주괴.<br>연료: 석탄 · 숯 · 원목 · 판자 · 막대기<br>컨베이어 벨트를 앞뒤에 붙이면 재료 · 연료를 넣고 판을 꺼내 줍니다.'
        : '철광석·구리 광석·금광석은 주괴로, 원목은 숯으로, 버섯은 구운 버섯으로.<br>연료: 석탄 · 숯 · 원목 · 판자 · 막대기'));
    } else if (mode === 'chest') {
      const gr = el('div', 'grid');
      for (let i = 0; i < 27; i++) this.views.push(this.mkSlot(gr, 'ent', i, 'chest'));
      if (ent2) for (let i = 0; i < 27; i++) this.views.push(this.mkSlot(gr, 'ent2', i, 'chest'));
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
  // 표지판 · 나무 판에 글 쓰기
  openSign(pos) {
    const g = this.game, w = g.world;
    const cur = w.signs[pos.l].get(w.idx(pos.x, pos.y)) || '', plaque = w.obj(pos.l, pos.x, pos.y) !== O.SIGN;
    const win = (this.win = el('div')); win.id = 'window';
    const panel = el('div', 'panel'); panel.style.width = '310px';
    const bar = el('div', 'title-bar', `<h2>${plaque ? '나무 판에 글 쓰기' : '표지판에 글 쓰기'}</h2>`);
    const x = el('button', 'x', '✕'); x.addEventListener('click', () => this.close()); bar.append(x);
    const ta = el('textarea', 'signin'); ta.rows = SIGN_LINES; ta.spellcheck = false; ta.value = cur; ta.maxLength = SIGN_LINES * (SIGN_COLS + 6);
    const warn = el('div', 'status');
    const done = () => { g.setSign(pos.l, pos.x, pos.y, ta.value); this.close(true); };
    const check = () => {
      const lines = ta.value.split('\n'), long = lines.findIndex((s) => [...s].length > SIGN_COLS);
      warn.classList.toggle('bad', long >= 0 || lines.length > SIGN_LINES);
      warn.textContent = lines.length > SIGN_LINES ? `${SIGN_LINES}줄까지만 적혀요` : long >= 0 ? `${long + 1}번째 줄이 ${SIGN_COLS}자를 넘어요 (넘는 글자는 잘려요)` : '';
    };
    ta.addEventListener('input', check);
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); this.close(); }
      else if (e.key === 'Enter' && !e.isComposing && (e.ctrlKey || e.metaKey)) { e.preventDefault(); done(); }
      else if (e.key === 'Enter' && !e.isComposing && ta.value.split('\n').length >= SIGN_LINES) e.preventDefault();   // 줄은 더 늘리지 않는다
    });
    const row = el('div', 'btnrow');
    const no = el('button', 'btn small', '취소'), ok = el('button', 'btn small primary', '쓰기');
    no.addEventListener('click', () => this.close());
    ok.addEventListener('click', () => { this.audio.play('click'); done(); });
    row.append(no, ok);
    panel.append(bar, ta, warn, row, el('div', 'note', `${SIGN_LINES}줄까지, 한 줄에 ${SIGN_COLS}자까지 쓸 수 있어요. <b>Ctrl+Enter</b>로도 쓰기가 됩니다.<br>적은 글은 가까이 가거나 마우스로 가리키면 그 위에 보여요.`));
    win.append(panel);
    this.root.insertBefore(win, this.heldEl);
    this.audio.play('open');
    setTimeout(() => { if (ta.isConnected) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } }, 30);
  }
  close(silent) {
    if (!this.mode) return;
    if (this.held) {
      const left = this.game.inv.add(this.held.id, this.held.n);
      if (left > 0) this.game.spawnDrop(this.held.id, left, this.game.player.x, this.game.player.y - 4);
      this.held = null;
    }
    const ent = this.ent, ent2 = this.ent2, wasEnt = this.mode === 'chest' || !!MACHINE[this.mode];
    this.win.remove(); this.win = null;
    this.mode = null; this.ent = null; this.ent2 = null; this.views = []; this.recViews = [];
    if (wasEnt) this.game.entClosed(ent, ent2);
    this.hideTip(); this.dirty = true;
    if (!silent) this.audio.play('close');
  }
  entGone(e) { if (this.ent === e || this.ent2 === e) this.close(true); }

  // ── 툴팁 ──
  hideTip() { this.tipFor = null; this.tip.classList.add('hidden'); this.cache.tip = null; }
  itemTip(id) {
    const it = ITEMS[id];
    let x = '';
    if (it.food) x += `<div class="tx ok">포만감 +${it.food}</div>`;
    if (it.fuel) x += `<div class="tx">연료 ${it.fuel}초</div>`;
    if (it.tool) x += `<div class="tx">${['', '나무', '돌', '철'][it.tier]} 등급 ${it.tool === 'sword' ? '무기' : '도구'}</div>`;
    if (it.tool === 'sword') x += `<div class="tx ok">공격력 ${SWORD_DMG[it.tier]}</div>`;
    if (it.roof) x += '<div class="tx">들고 있으면 지붕이 비쳐 보여요.<br>빈 곳 클릭: 덮기 · 지붕 클릭: 걷어 내기 (끌어서 연속)</div>';
    if (it.sign) x += '<div class="tx">빈 땅 클릭: 세우기 · 블록 클릭: 그 블록에 나무 판으로 붙이기</div>';
    if (it.place || it.seed) x += `<div class="tx">단축바에서 고르고 클릭하면 ${it.seed ? '심을' : '놓을'} 수 있어요</div>`;
    if (it.place && it.place.obj && OBJ[it.place.obj].rot) x += '<div class="tx">R: 놓을 방향 돌리기 · 놓은 뒤에도 가리키고 R</div>';
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
  // worlds: 저장된 세계 목록 (최근에 플레이한 것이 앞)
  showTitle(worlds) {
    const hasSave = !!(worlds && worlds.length);
    this.close(true);
    this.showPanel(null); if (this.chatOpen) this.closeChat(false);
    this.$('chat').innerHTML = ''; for (const lab of this.labels.values()) lab.remove(); this.labels.clear();
    for (const lab of this.signLabs.values()) lab.el.remove(); this.signLabs.clear();
    this.$('groggy').classList.add('hidden');
    this.titleOpen = true; this.pauseOpen = false; this.mapOpen = false;
    this.$('title').classList.remove('hidden'); this.$('pause').classList.add('hidden'); this.$('mapview').classList.add('hidden');
    this.hud.classList.add('hidden');
    this.$('b-continue').classList.toggle('hidden', !hasSave);
    this.$('b-continue').textContent = hasSave ? `이어하기 — ${worlds[0].name}` : '이어하기';
    this.$('b-new').classList.toggle('primary', !hasSave);
    this.worldCount = hasSave ? worlds.length : 0;
    this.$('loading').classList.add('hidden');
  }
  hideTitle() {
    this.titleOpen = false;
    this.$('title').classList.add('hidden'); this.hud.classList.remove('hidden');
    this.dirty = true; this.cache = {};
    for (const v of this.hotViews) v.key = '?';
    this.showPanel(null);
    this.netChanged();
  }
  loading(on) { this.$('loading').classList.toggle('hidden', !on); }
  togglePause(on = !this.pauseOpen) {
    if (this.titleOpen) return;
    this.pauseOpen = on; this.game.paused = on;
    this.$('pause').classList.toggle('hidden', !on);
    if (!on) this.showPanel(null);
    if (on) { this.netChanged(); this.game.save(); }
  }

  // ── 패널: 방 참가 · 멀티플레이 · 세이브 관리 ──
  showPanel(name) {
    for (const n of ['join', 'mp', 'saves', 'worlds', 'newworld']) this.$(n).classList.toggle('hidden', n !== name);
    this.panel = name;
    if (name === 'worlds') this.renderWorlds();
    if (name === 'newworld') { const i = this.$('nw-name'); i.value = `세계 ${(this.worldCount || 0) + 1}`; this.$('nw-seed').value = ''; setTimeout(() => { i.focus(); i.select(); }, 30); }
    if (name === 'join') { this.$('j-name').value = this.game.net.name; this.joinStatus(''); setTimeout(() => this.$('j-code').focus(), 30); }
    if (name === 'mp') this.renderMp();
    if (name === 'saves') this.renderSaves();
  }
  joinStatus(text, bad) { const e = this.$('j-status'); e.textContent = text; e.classList.toggle('bad', !!bad); }
  joinFailed(e) { this.joinStatus(joinErr(e), true); this.audio.play('deny'); }
  // 접속 상태가 바뀔 때마다 화면의 관련 표시를 맞춘다
  netChanged() {
    const net = this.game.net, room = this.$('room');
    room.classList.toggle('hidden', !net.on);
    if (net.on) room.textContent = `방 ${net.code} · ${net.count}명`;
    this.$('p-title').textContent = net.isGuest ? '방 나가기' : '저장하고 타이틀로';
    this.$('p-saves').classList.toggle('hidden', net.isGuest);
    this.$('pause-title').textContent = net.on ? '메뉴 (게임은 계속 흘러가요)' : '일시정지';
    if (this.panel === 'mp') this.renderMp();
  }
  renderMp() {
    const net = this.game.net, box = this.$('mp-body');
    box.innerHTML = '';
    const list = () => {
      const ul = el('div', 'plist');
      const row = (name, color, tag) => { const r = el('div', 'prow'); const sw = el('i'); sw.style.background = playerHex(color); const nm = el('span'); nm.textContent = name; r.append(sw, nm); if (tag) r.append(el('em', '', tag)); ul.append(r); };
      row(net.name, net.color, net.isHost ? '나 · 방장' : '나');
      for (const p of net.players.values()) row(p.name, p.color, p.id === 'host' || p.color === 0 ? '방장' : '');
      return ul;
    };
    if (!net.on) {
      box.append(el('div', 'note first', '지금 이 세계에 친구를 초대할 수 있어요. 방을 열면 6글자 코드가 나오고, 친구는 타이틀 화면의 <b>친구 방에 참가</b>에서 그 코드를 넣으면 됩니다.'));
      const f = el('label', 'field', '<span>내 이름</span>'); const inp = el('input'); inp.maxLength = 12; inp.value = net.name; inp.spellcheck = false; f.append(inp);
      const go = el('button', 'btn primary', '방 열기'); go.style.cssText = 'width:100%;margin-top:10px';
      const st = el('div', 'status');
      go.addEventListener('click', async () => {
        this.audio.play('click'); net.setName(inp.value); go.disabled = true; st.classList.remove('bad'); st.textContent = '방을 여는 중…';
        try { await net.openRoom(); this.audio.play('quest'); this.toast(`방을 열었어요. 코드: ${net.code}`, 'good'); this.netChanged(); }
        catch (e) { go.disabled = false; st.classList.add('bad'); st.textContent = joinErr(e); this.audio.play('deny'); }
      });
      box.append(f, go, st, el('div', 'note', `최대 ${MAX_PLAYERS}명. 서버 없이 서로의 브라우저가 직접 연결돼요. 세계는 내 기기에 저장되고, 내가 게임을 닫으면 방도 닫혀요. 일부 네트워크(회사·학교 등)에서는 연결이 안 될 수 있어요.`));
    } else if (net.isHost) {
      box.append(el('div', 'cat', '방 코드'), el('div', 'code', net.code));
      const copy = el('button', 'btn small', '초대 링크 복사'); copy.style.width = '100%';
      copy.addEventListener('click', async () => {
        this.audio.play('click');
        try { await navigator.clipboard.writeText(net.link()); this.toast('초대 링크를 복사했어요', 'good'); }
        catch { this.toast(`복사하지 못했어요. 코드 ${net.code} 를 직접 알려 주세요`); }
      });
      const close = el('button', 'btn small', '방 닫기'); close.style.cssText = 'width:100%;margin-top:8px';
      close.addEventListener('click', () => { this.audio.play('click'); net.closeRoom(); this.toast('방을 닫았어요'); });
      box.append(copy, el('div', 'cat', `함께 있는 사람 (${net.count}/${MAX_PLAYERS})`), list(), close, el('div', 'note', '<b>Enter</b> 키로 대화할 수 있어요. 상자와 화로는 한 번에 한 사람만 열 수 있습니다.'));
    } else {
      box.append(el('div', 'cat', '방 코드'), el('div', 'code', net.code), el('div', 'cat', `함께 있는 사람 (${net.count}/${MAX_PLAYERS})`), list(),
        el('div', 'note', '이 세계는 방장의 것이에요. 내 가방과 진행도는 이 브라우저에 저장되어, 같은 세계에 다시 들어오면 이어집니다.<br><b>Enter</b> 키로 대화할 수 있어요.'));
    }
  }
  download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }
  // 세계 목록 (타이틀 화면): 골라서 플레이하거나, 세계마다 세이브를 관리한다
  async renderWorlds() {
    const box = this.$('worlds-body');
    box.innerHTML = '<div class="note first">불러오는 중…</div>';
    const list = await listWorlds();
    if (this.panel !== 'worlds') return;
    box.innerHTML = '';
    this.worldCount = list.length;
    if (!list.length) box.append(el('div', 'note first', '아직 만든 세계가 없어요.'));
    for (const w of list) {
      const r = el('div', 'srow'), t = el('div', 'stxt'), nm = el('div'), bs = el('div', 'sbtn');
      nm.textContent = w.name;
      t.append(nm, el('div', 'sub', `${w.day || 1}일차 · ${when(w.savedAt)} 저장`));
      const play = el('button', 'btn small primary', '플레이'), man = el('button', 'btn small', '관리');
      play.addEventListener('click', () => { this.audio.unlock(); this.audio.play('click'); if (this.on.play) this.on.play(w.key); });
      man.addEventListener('click', () => { this.audio.play('click'); this.savesKey = w.key; this.showPanel('saves'); });
      bs.append(play, man); r.append(t, bs); box.append(r);
    }
    const mk = el('button', 'btn small', '새 세계 만들기'), imp = el('button', 'btn small', '세이브 파일(.mfsave)에서 불러오기');
    mk.style.cssText = 'width:100%;margin-top:12px'; imp.style.cssText = 'width:100%;margin-top:6px';
    mk.addEventListener('click', () => { this.audio.play('click'); this.showPanel('newworld'); });
    imp.addEventListener('click', () => { this.audio.play('click'); this.$('s-file').click(); });
    box.append(mk, imp, el('div', 'note', '<b>관리</b>에서 이름 바꾸기 · 백업으로 되돌리기 · 파일로 내보내기 · 지우기를 할 수 있어요.<br>세이브 파일을 불러오면 새 세계로 목록에 더해지고, 다른 세계는 그대로 남습니다.'));
  }
  // 세이브 관리: this.savesKey 세계 하나의 이름 · 지금 세이브 · 자동 백업
  async renderSaves() {
    const box = this.$('saves-body'), g = this.game, key = this.savesKey;
    const playing = g.state === 'play' && !g.net.isGuest && key === currentWorld();
    box.innerHTML = '<div class="note first">불러오는 중…</div>';
    if (playing) await g.save();
    const [worlds, cur, baks, info] = await Promise.all([listWorlds(), loadWorld(key), listBackups(key), storageInfo()]);
    if (this.panel !== 'saves') return;
    const w = worlds.find((x) => x.key === key);
    box.innerHTML = '';
    this.$('saves-title').textContent = w ? `세이브 관리 — ${w.name}` : '세이브 관리';
    if (!w) { box.append(el('div', 'note first', '이 세계를 찾지 못했어요.')); return; }
    const row = (title, sub, buttons) => {
      const r = el('div', 'srow'), t = el('div', 'stxt');
      t.append(el('div', '', title), el('div', 'sub', sub));
      const bs = el('div', 'sbtn');
      for (const [label, fn, cls] of buttons) { const b = el('button', 'btn small' + (cls ? ' ' + cls : ''), label); b.addEventListener('click', () => { this.audio.play('click'); fn(b); }); bs.append(b); }
      r.append(t, bs); box.append(r);
    };
    const exportOf = (getData) => async (btn) => {
      btn.disabled = true;
      try { const d = { ...(await getData()), name: w.name }; this.download(await exportBlob(d), fileName(d)); this.toast('세이브 파일을 내려받았어요', 'good'); }
      catch (e) { console.warn(e); this.toast('파일을 만들지 못했어요'); }
      btn.disabled = false;
    };
    // 이름
    box.append(el('div', 'cat', '세계 이름'));
    {
      const f = el('div', 'namerow'), inp = el('input'), b = el('button', 'btn small', '이름 바꾸기');
      inp.maxLength = 20; inp.value = w.name; inp.spellcheck = false;
      const go = async () => {
        this.audio.play('click');
        const nw = await renameWorld(key, inp.value);
        if (!nw) return;
        if (playing) g.worldName = nw.name;
        this.toast(`세계 이름을 '${nw.name}'(으)로 바꿨어요`, 'good');
        if (this.panel === 'saves') this.renderSaves();
      };
      b.addEventListener('click', go);
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) go(); });
      f.append(inp, b); box.append(f);
    }
    box.append(el('div', 'cat', '지금 세이브'));
    if (cur) row(`${Math.floor(cur.time / DAY_LENGTH) + 1}일차`, `${when(cur.savedAt)} 저장`, [['파일로 내보내기', exportOf(async () => (playing ? serialize(g) : cur)), 'primary']]);
    else box.append(el('div', 'note first', '저장된 내용이 없어요.'));
    box.append(el('div', 'cat', `자동 백업 (최근 ${baks.length}개 · 10분마다, 그리고 되돌리기 직전에)`));
    if (!baks.length) box.append(el('div', 'note first', '아직 백업이 없어요. 플레이하면 자동으로 쌓입니다.'));
    for (const b of baks) {
      row(`${b.day}일차 <span class="tag">${REASON[b.reason] || b.reason}</span>`, when(b.at), [
        ['되돌리기', () => this.confirm(`${when(b.at)}의 백업(${b.day}일차)으로 되돌릴까요?<br>지금 세이브는 백업으로 옮겨 둡니다.`, async () => { const d = await loadBackup(b.key); if (d && this.on.restore) this.on.restore(key, d); })],
        ['파일', exportOf(() => loadBackup(b.key))],
      ]);
    }
    if (g.state !== 'play') {
      // 타이틀 화면에서만: 세계 지우기, 목록으로 돌아가기
      const back = el('button', 'btn small', '← 세계 목록'), rm = el('button', 'btn small', '이 세계 지우기');
      back.style.cssText = 'width:100%;margin-top:12px'; rm.style.cssText = 'width:100%;margin-top:6px;color:var(--bad)';
      back.addEventListener('click', () => { this.audio.play('click'); this.showPanel('worlds'); });
      rm.addEventListener('click', () => {
        this.audio.play('click');
        this.confirm(`<b>${w.name.replace(/[<&]/g, '')}</b> 세계와 그 백업 ${baks.length}개를 모두 지울까요?<br><b style="color:var(--bad)">지우면 되돌릴 수 없어요.</b> 남겨 두고 싶다면 먼저 파일로 내보내세요.`, async () => {
          await deleteWorld(key);
          this.toast('세계를 지웠어요');
          if (this.on.worldsChanged) await this.on.worldsChanged();
          this.showPanel('worlds');
        });
      });
      box.append(back, rm);
    }
    box.append(el('div', 'note', `세이브는 쿠키가 아니라 이 브라우저의 저장소(IndexedDB)에 세계마다 따로 들어 있어요. 브라우저에서 사이트 데이터를 지우거나 다른 기기로 옮기면 따라오지 않으니, <b>아끼는 세계는 파일로 내보내</b> 두세요. 파일은 어느 컴퓨터·브라우저에서든 <b>세계 목록</b>에서 다시 불러올 수 있습니다.<br>브라우저 보호 저장: <b>${info.persisted ? '켜짐' : '꺼짐'}</b>${info.persisted ? '' : ' (브라우저가 허용하면 자동으로 켜져요)'} · 사용 중 ${(info.usage / 1048576).toFixed(1)}MB`));
  }
  // 세이브 파일은 새 세계로 불러온다 (다른 세계를 덮어쓰지 않는다)
  async importSave(file) {
    try {
      const d = await importFile(file);
      this.confirm(`세이브 파일의 세계(${d.name ? d.name.replace(/[<&]/g, '') + ' · ' : ''}${Math.floor(d.time / DAY_LENGTH) + 1}일차, ${when(d.savedAt)} 저장)를 불러올까요?<br>새 세계로 목록에 더해지고, 다른 세계는 그대로 남습니다.`, () => { if (this.on.import) this.on.import(d); });
    } catch (e) { console.warn(e); this.toast('마인 팩토리 세이브 파일이 아니거나 손상됐어요'); this.audio.play('deny'); }
  }

  // ── 대화 ──
  chatLine(name, color, text) {
    const box = this.$('chat'), e = el('div', 'cl');
    if (name) { const n = el('b'); n.textContent = name; n.style.color = playerHex(color); e.append(n, document.createTextNode(' ' + text)); this.audio.play('select'); }
    else { e.classList.add('sys'); e.textContent = text; }
    box.append(e);
    while (box.children.length > 8) box.firstChild.remove();
    setTimeout(() => { e.style.opacity = 0; setTimeout(() => e.remove(), 500); }, 14000);
  }
  openChat() { const i = this.$('chatin'); i.classList.remove('hidden'); i.value = ''; this.chatOpen = true; setTimeout(() => i.focus(), 0); }
  closeChat(send) {
    const i = this.$('chatin');
    if (!this.chatOpen) return;
    this.chatOpen = false;
    if (send) this.game.net.chat(i.value);
    i.classList.add('hidden'); i.blur();
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
      else if (this.panel) this.showPanel(null);
      else if (this.titleOpen) { /* 타이틀에서는 아무 것도 하지 않는다 */ }
      else if (this.mode) this.close();
      else if (this.mapOpen) this.toggle('map');
      else this.togglePause();
    }
    if (this.titleOpen || this.pauseOpen || this.helpOpen || this.confirmOpen || this.panel || g.state !== 'play') return;
    if (inp.hit('Enter') && g.net.on && !this.blocking) { this.openChat(); return; }
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
    // 함께 있는 플레이어: 범위 안이면 안전모 색 점, 멀면 흰 테두리 화살표
    for (const q of g.net.players.values()) {
      if (q.layer !== L) continue;
      const dx = Math.floor(q.rx / TILE) - px, dy = Math.floor(q.ry / TILE) - py, m = Math.max(Math.abs(dx), Math.abs(dy));
      if (m <= half - 3) { c.fillStyle = '#ffffff'; c.fillRect(half + dx - 2, half + dy - 2, 5, 5); c.fillStyle = playerHex(q.color); c.fillRect(half + dx - 1, half + dy - 1, 3, 3); }
      else { const k = (half - 7) / m; this.arrowIcon(c, Math.round(half + dx * k), Math.round(half + dy * k), Math.atan2(dy, dx), playerHex(q.color), '#ffffff'); }
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
  arrowIcon(c, cx, cy, ang, color, edge = '#241a2b') {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    for (let pass = 0; pass < 2; pass++) {
      c.fillStyle = pass ? color : edge;
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
    for (const q of g.net.players.values()) {
      if (q.layer !== L) continue;
      const qx = Math.floor(q.rx / TILE), qy = Math.floor(q.ry / TILE);
      c.fillStyle = '#ffffff'; c.fillRect(qx - 4, qy - 4, 9, 9); c.fillStyle = playerHex(q.color); c.fillRect(qx - 3, qy - 3, 7, 7);
    }
    const px = Math.floor(g.player.x / TILE), py = Math.floor(g.player.y / TILE);
    const b = ((performance.now() / 300) | 0) % 2;
    c.fillStyle = '#241a2b'; c.fillRect(px - 4, py - 4, 9, 9);
    c.fillStyle = b ? '#ffffff' : '#f0645c'; c.fillRect(px - 3, py - 3, 7, 7);
  }

  // ── 매 프레임 ──
  // 지금 가리키는 것(캐거나 때리거나 쓰게 될 대상)의 이름과 그림: 동물 → 지붕 → 떨어진 아이템 → 오브젝트 → 땅
  hoverInfo() {
    const g = this.game, c = g.cursor, w = g.world, L = g.layer, A = this.atlas;
    if (this.blocking || g.fade || !c || !w.inb(c.x, c.y)) return null;
    const far = !c.inReach;
    if (g.mobT) {                                        // 동물: 다쳤으면 남은 체력도
      const m = g.mobT.m, d = MOBS[m.k];
      return { key: `m${m.id}:${m.hp}`, name: d.name, sub: m.hp < d.hp ? `체력 ${Math.max(0, m.hp)}/${d.hp}` : '', spr: A.get(`mob_${m.k}_r_0`), far: !g.mobT.inReach };
    }
    if (c.roof && w.roof(L, c.x, c.y)) return { key: 'roof', name: ITEMS.roof.name, spr: A.get('i_roof'), far };
    if (!(g.kbUntil > performance.now())) {             // 키보드로 겨냥하는 중이 아니면 마우스 아래 아이템부터
      const m = g.input.mouse, pt = this.renderer.screenToWorld(m.x, m.y);
      for (const d of g.drops) {
        if (d.layer !== L || Math.abs(d.x - pt.x) > 6 || pt.y < d.y - 12 - d.z || pt.y > d.y + 1 - d.z) continue;
        return { key: `d${d.id}x${d.n}`, name: ITEMS[d.id].name, sub: d.n > 1 ? `×${d.n}` : '', spr: A.get(ITEMS[d.id].icon) };
      }
    }
    const Lr = w.layers[L], i = w.idx(c.x, c.y), o = Lr.obj[i], meta = Lr.meta[i];
    if (L === CAVE && !Lr.seen[i]) return null;          // 아직 밝혀지지 않은 곳은 알려 주지 않는다
    if (o) {
      const def = OBJ[o];
      if (def.wall && L === CAVE && !w.exposed(L, c.x, c.y)) return null;
      let name = def.name, sub = '';
      const plq = w.plaque(L, i), txt = w.signs[L].get(i) || '';
      if (o === O.SAPLING) name = (ITEMS[SAPLING_ITEMS[meta]] || def).name;
      else if (o === O.FLAG && FLAG_COLORS[meta]) name = `${FLAG_COLORS[meta].name} 깃발`;
      else if (o === O.CHEST && meta) name = '큰 상자';
      if (def.crop) sub = meta >= 3 ? '다 자람' : '자라는 중';
      else if (def.harvest && meta) sub = def.harvest.item === 'apple' ? '사과 열림' : '열매 열림';
      else if (o === O.SIGN && !txt) sub = '빈 표지판';
      if (plq) sub = sub ? `${sub} · 표지판 붙음` : '표지판 붙음';
      return { key: `o${o}:${meta}:${Lr.rot[i]}:${plq ? 1 : 0}${txt ? 't' : ''}`, name, sub, spr: this.renderer.objSprite(def, meta, c.x, c.y), far };
    }
    const gid = Lr.ground[i], gd = GROUND[gid];
    if (!gd || !gd.name) return null;
    const gs = this.renderer.gs[gid] && this.renderer.gs[gid][0];
    return { key: 'g' + gid, name: gd.name, spr: Array.isArray(gs) ? gs[0] : gs, far };
  }

  // 표지판 글: 가까이 있거나 가리키고 있는 표지판 · 나무 판의 글을 그 위에 작은 나무 판으로 띄운다
  updateSigns() {
    const g = this.game, r = this.renderer, w = g.world, L = g.layer, signs = w.signs[L], labs = this.signLabs;
    if (!signs.size && !labs.size) return;
    const p = g.player, c = g.cursor, Lr = w.layers[L], box = this.$('signs'), shown = new Set();
    const hi = c && !c.roof && !this.blocking && w.inb(c.x, c.y) ? w.idx(c.x, c.y) : -1;
    for (const [i, text] of signs) {
      if (!text) continue;
      const x = i % MAP_W, y = (i / MAP_W) | 0, cx = x * TILE + 8;
      const a = i === hi ? 1 : Math.min(1, (SIGN_FAR - Math.hypot(cx - p.x, y * TILE + 8 - (p.y - 6)) / TILE) / 1.5);
      if (a <= 0 || g.roofBlocks(x, y) || (L === CAVE && !Lr.seen[i])) continue;      // 멀거나, 닫힌 지붕 아래거나, 아직 못 본 곳
      const sx = (cx - r.ox) * r.zoom, sy = (y * TILE + (Lr.obj[i] === O.SIGN ? -2 : 6) - r.oy) * r.zoom;   // 판 바로 위
      if (sx < -140 || sx > innerWidth + 140 || sy < 0 || sy > innerHeight + 90) continue;
      let lab = labs.get(i);
      if (!lab) { lab = { el: el('div', 'sg'), text: null, a: '' }; box.append(lab.el); labs.set(i, lab); }
      if (lab.text !== text) { lab.text = text; lab.el.textContent = text; }
      const as = a.toFixed(2) + (i === hi ? '!' : '');
      if (lab.a !== as) { lab.a = as; lab.el.style.opacity = a.toFixed(2); lab.el.style.zIndex = i === hi ? 2 : 1; }
      lab.el.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy)}px) translate(-50%, -100%)`;
      shown.add(i);
    }
    for (const [i, lab] of labs) if (!shown.has(i)) { lab.el.remove(); labs.delete(i); }
  }

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
    // 그로기(포만감 0): 쓰러지기까지 남은 시간을 보여 주고, 화면 가장자리가 점점 붉게 어두워진다
    const hu = Math.ceil(g.player.hunger), gr = g.player.groggy > 0 ? Math.ceil(g.player.groggy) : 0;
    set('hunger', hu + '|' + gr, () => {
      this.$('hungerbar').firstChild.style.width = hu + '%';
      this.$('hungerbar').classList.toggle('low', hu <= 20);
      const t = this.$('hungertxt'), v = this.$('groggy');
      t.textContent = gr ? `그로기! 쓰러지기까지 ${Math.floor(gr / 60)}:${String(gr % 60).padStart(2, '0')}` : hu <= 20 ? '배고파요' : '';
      t.classList.toggle('danger', !!gr);
      v.classList.toggle('hidden', !gr);
      if (gr) v.style.opacity = (0.4 + 0.6 * (1 - gr / 120)).toFixed(2);
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
    // 가리킨 대상 이름표 (오른쪽 아래)
    const hv = this.hoverInfo();
    set('hover', hv ? hv.key : '', () => {
      const box = this.$('hover');
      box.classList.toggle('hidden', !hv);
      if (!hv) return;
      this.$('hovername').textContent = hv.name;
      this.$('hoversub').textContent = hv.sub || '';
      const c = box.firstChild.getContext('2d'), sp = hv.spr;
      c.clearRect(0, 0, 32, 32);
      if (sp) {
        const k = Math.min(2, 32 / sp.w, 32 / sp.h), dw = Math.round(sp.w * k), dh = Math.round(sp.h * k);
        c.imageSmoothingEnabled = false;
        c.drawImage(this.atlas.canvas, sp.x, sp.y, sp.w, sp.h, (32 - dw) >> 1, (32 - dh) >> 1, dw, dh);
      }
    });
    set('hoverfar', !!(hv && hv.far), (v) => this.$('hover').classList.toggle('far', v));
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

    // 다른 플레이어 이름표
    {
      const net = g.net, r = this.renderer, box = this.$('names');
      for (const [id, lab] of this.labels) if (!net.players.has(id)) { lab.remove(); this.labels.delete(id); }
      for (const q of net.players.values()) {
        let lab = this.labels.get(q.id);
        if (!lab) { lab = el('div', 'nm'); lab.textContent = q.name; lab.style.borderColor = playerHex(q.color); box.append(lab); this.labels.set(q.id, lab); }
        const sx = (q.rx - r.ox) * r.zoom, sy = (q.ry - 21 - r.oy) * r.zoom;
        const vis = q.layer === g.layer && sx > -60 && sx < innerWidth + 60 && sy > 0 && sy < innerHeight + 30;
        lab.style.display = vis ? '' : 'none';
        if (vis) lab.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy)}px) translate(-50%, -100%)`;
      }
    }
    this.updateSigns();
    // 화로 게이지
    if (MACHINE[this.mode] && this.ent) {
      const e = this.ent, rec = e.slots[0] ? MACHINE[this.mode][e.slots[0].id] : null;
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
