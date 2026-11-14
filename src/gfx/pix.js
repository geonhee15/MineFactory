// 코드로 도트를 찍기 위한 작은 픽셀 버퍼 + 스프라이트 아틀라스

export const rgb = (r, g, b) => (r << 16) | (g << 8) | b;
export function shade(col, f) {
  const r = Math.min(255, Math.round(((col >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((col >> 8) & 255) * f));
  const b = Math.min(255, Math.round((col & 255) * f));
  return (r << 16) | (g << 8) | b;
}
export function mix(a, b, t) {
  const r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
  const g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
  const bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
  return (r << 16) | (g << 8) | bl;
}
export const hex = (c) => '#' + c.toString(16).padStart(6, '0');

export class Pix {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.c = new Int32Array(w * h).fill(-1);
    this.a = new Uint8Array(w * h);
  }
  set(x, y, col, a = 255) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || col < 0) return this;
    const i = y * this.w + x;
    this.c[i] = col; this.a[i] = a;
    return this;
  }
  // 반투명 색을 기존 픽셀 위에 섞어 찍기
  tint(x, y, col, t) {
    const o = this.get(x, y);
    if (o >= 0) this.set(x, y, mix(o, col, t), this.a[(y | 0) * this.w + (x | 0)]);
    return this;
  }
  get(x, y) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    return this.c[y * this.w + x];
  }
  clear(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    this.c[y * this.w + x] = -1; this.a[y * this.w + x] = 0;
    return this;
  }
  fill(col, a = 255) { this.c.fill(col); this.a.fill(a); return this; }
  rect(x, y, w, h, col, a = 255) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, col, a);
    return this;
  }
  ellipse(cx, cy, rx, ry, col, a = 255) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, col, a);
      }
    return this;
  }
  disc(cx, cy, r, col, a = 255) { return this.ellipse(cx, cy, r, r, col, a); }
  line(x0, y0, x1, y1, col, a = 255) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) {
      this.set(x0, y0, col, a);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
    return this;
  }
  // 문자 그림 → 픽셀. pal: { 문자: 색 }, '.'과 ' '는 투명
  ascii(rows, pal, ox = 0, oy = 0) {
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        const col = pal[ch];
        if (col === undefined) { console.warn('팔레트에 없는 문자:', ch, rows); continue; }
        this.set(ox + x, oy + y, col);
      }
    }
    return this;
  }
  blit(src, ox = 0, oy = 0) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const i = y * src.w + x;
      if (src.c[i] >= 0) this.set(ox + x, oy + y, src.c[i], src.a[i]);
    }
    return this;
  }
  // 불투명 픽셀 둘레에 외곽선
  outline(col, diag = false) {
    const add = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.get(x, y) >= 0 && this.a[y * this.w + x] === 255) continue;
      const op = (dx, dy) => {
        const xx = x + dx, yy = y + dy;
        return xx >= 0 && yy >= 0 && xx < this.w && yy < this.h && this.c[yy * this.w + xx] >= 0 && this.a[yy * this.w + xx] === 255;
      };
      if (op(1, 0) || op(-1, 0) || op(0, 1) || op(0, -1) ||
        (diag && (op(1, 1) || op(-1, 1) || op(1, -1) || op(-1, -1)))) add.push(x, y);
    }
    for (let i = 0; i < add.length; i += 2) this.set(add[i], add[i + 1], col);
    return this;
  }
  flip() {
    const p = new Pix(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const i = y * this.w + x, j = y * this.w + (this.w - 1 - x);
      p.c[j] = this.c[i]; p.a[j] = this.a[i];
    }
    return p;
  }
  clone() {
    const p = new Pix(this.w, this.h);
    p.c.set(this.c); p.a.set(this.a);
    return p;
  }
  // 모든 불투명 픽셀에 함수 적용
  map(fn) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const i = y * this.w + x;
      if (this.c[i] >= 0) this.c[i] = fn(this.c[i], x, y);
    }
    return this;
  }
  toImageData() {
    const img = new ImageData(this.w, this.h);
    const d = img.data;
    for (let i = 0; i < this.c.length; i++) {
      const c = this.c[i];
      if (c < 0) continue;
      d[i * 4] = (c >> 16) & 255; d[i * 4 + 1] = (c >> 8) & 255; d[i * 4 + 2] = c & 255; d[i * 4 + 3] = this.a[i];
    }
    return img;
  }
}

export class Atlas {
  constructor(w = 1024, h = 1024) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = w; this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.map = Object.create(null);
    this.x = 1; this.y = 1; this.rowH = 0;
    this._urls = Object.create(null);
  }
  // ox, oy: 타일 좌상단 기준 그리기 오프셋
  add(name, pix, ox = 0, oy = 0) {
    if (this.x + pix.w + 1 > this.canvas.width) { this.x = 1; this.y += this.rowH + 1; this.rowH = 0; }
    if (this.y + pix.h + 1 > this.canvas.height) throw new Error('아틀라스가 가득 찼습니다: ' + name);
    this.ctx.putImageData(pix.toImageData(), this.x, this.y);
    const s = { name, x: this.x, y: this.y, w: pix.w, h: pix.h, ox, oy };
    this.map[name] = s;
    this.x += pix.w + 1;
    if (pix.h > this.rowH) this.rowH = pix.h;
    return s;
  }
  get(name) {
    const s = this.map[name];
    if (!s) console.warn('없는 스프라이트:', name);
    return s;
  }
  has(name) { return !!this.map[name]; }
  // UI용 data URL (정사각형 캔버스 가운데에 맞춰 넣음)
  url(name, box = 0) {
    const key = name + '|' + box;
    if (this._urls[key]) return this._urls[key];
    const s = this.map[name];
    if (!s) return '';
    const c = document.createElement('canvas');
    const size = box || Math.max(s.w, s.h);
    c.width = size; c.height = size;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    const sc = Math.min(1, size / Math.max(s.w, s.h));
    const dw = Math.round(s.w * sc), dh = Math.round(s.h * sc);
    x.drawImage(this.canvas, s.x, s.y, s.w, s.h, ((size - dw) / 2) | 0, ((size - dh) / 2) | 0, dw, dh);
    return (this._urls[key] = c.toDataURL());
  }
}
