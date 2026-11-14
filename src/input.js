// 키보드 · 마우스 입력
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.hits = new Set();      // 이번 프레임에 눌린 키
    this.mouse = { x: 0, y: 0, l: false, r: false, lp: false, rp: false, wheel: 0, moved: 0 };
    const typing = (e) => e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');

    window.addEventListener('keydown', (e) => {
      if (typing(e)) return;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.hits.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.l = this.mouse.r = false; });

    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left; this.mouse.y = e.clientY - r.top;
    };
    window.addEventListener('mousemove', (e) => { pos(e); this.mouse.moved = performance.now(); });
    // 브라우저 기본 드래그를 막는다: 누른 채 움직이면 화면이 반투명한 이미지로 딸려 오는 현상 방지
    canvas.draggable = false;
    document.addEventListener('dragstart', (e) => e.preventDefault(), true);
    document.addEventListener('selectstart', (e) => { if (!typing(e)) e.preventDefault(); }, true);
    canvas.addEventListener('mousedown', (e) => {
      e.preventDefault();                       // 드래그·텍스트 선택이 시작되지 않게
      if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
      window.focus();
      pos(e);
      if (e.button === 0) { this.mouse.l = true; this.mouse.lp = true; }
      if (e.button === 2) { this.mouse.r = true; this.mouse.rp = true; }
      this.mouse.moved = performance.now();
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.l = false;
      if (e.button === 2) this.mouse.r = false;
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('wheel', (e) => { if (e.target === canvas) this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
  }
  down(code) { return this.keys.has(code); }
  hit(code) { return this.hits.has(code); }
  endFrame() { this.hits.clear(); this.mouse.lp = false; this.mouse.rp = false; this.mouse.wheel = 0; }
}
