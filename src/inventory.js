// 가방: 슬롯 배열 = null | { id, n }
import { ITEMS } from './data/items.js';

export const maxStack = (id) => ITEMS[id]?.stack ?? 99;

export class Inventory {
  constructor(size) { this.slots = new Array(size).fill(null); this.onChange = null; }
  changed() { if (this.onChange) this.onChange(); }
  count(id) { let n = 0; for (const s of this.slots) if (s && s.id === id) n += s.n; return n; }
  // 넣고 남은 개수를 돌려준다
  add(id, n = 1) {
    const max = maxStack(id);
    for (const s of this.slots) {
      if (n <= 0) break;
      if (s && s.id === id && s.n < max) { const k = Math.min(n, max - s.n); s.n += k; n -= k; }
    }
    for (let i = 0; i < this.slots.length && n > 0; i++) {
      if (!this.slots[i]) { const k = Math.min(n, max); this.slots[i] = { id, n: k }; n -= k; }
    }
    this.changed();
    return n;
  }
  space(id) {
    const max = maxStack(id); let n = 0;
    for (const s of this.slots) { if (!s) n += max; else if (s.id === id) n += max - s.n; }
    return n;
  }
  remove(id, n = 1) {
    if (this.count(id) < n) return false;
    for (let i = this.slots.length - 1; i >= 0 && n > 0; i--) {
      const s = this.slots[i];
      if (s && s.id === id) { const k = Math.min(n, s.n); s.n -= k; n -= k; if (s.n <= 0) this.slots[i] = null; }
    }
    this.changed();
    return true;
  }
  has(ins) { for (const id in ins) if (this.count(id) < ins[id]) return false; return true; }
  // 특정 슬롯에서 n개 소모
  take(i, n = 1) {
    const s = this.slots[i];
    if (!s) return;
    s.n -= n;
    if (s.n <= 0) this.slots[i] = null;
    this.changed();
  }
}
