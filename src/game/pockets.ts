/**
 * Pockets: numbered slots holding stacks (tools keep their wear), a purse of 도토리, and the
 * house storage. Plain data so it saves and travels with you to a friend's island.
 */
import { item } from "../data/items";

export interface Slot {
  id: string;
  n: number;
  /** Uses left for tools that wear out. */
  wear?: number;
}

export class Pockets {
  slots: (Slot | null)[];
  money = 1000;
  storage: Slot[] = [];
  onChange: (() => void) | null = null;

  constructor(size = 20) {
    this.slots = new Array(size).fill(null);
  }

  get size(): number {
    return this.slots.length;
  }

  grow(to: number): void {
    while (this.slots.length < to) this.slots.push(null);
    this.onChange?.();
  }

  count(id: string): number {
    return this.slots.reduce((s, x) => s + (x && x.id === id ? x.n : 0), 0);
  }

  /** Room for n of this item? */
  fits(id: string, n = 1): boolean {
    const d = item(id);
    let room = 0;
    for (const s of this.slots) {
      if (!s) room += d.stack;
      else if (s.id === id && d.stack > 1) room += d.stack - s.n;
      if (room >= n) return true;
    }
    return false;
  }

  /** Add as many as fit; returns how many didn't. */
  add(id: string, n = 1, wear?: number): number {
    const d = item(id);
    let left = n;
    if (d.stack > 1)
      for (const s of this.slots) {
        if (s && s.id === id && s.n < d.stack) {
          const k = Math.min(left, d.stack - s.n);
          s.n += k;
          left -= k;
          if (!left) break;
        }
      }
    for (let i = 0; i < this.slots.length && left > 0; i++) {
      if (this.slots[i]) continue;
      const k = Math.min(left, d.stack);
      this.slots[i] = { id, n: k, wear: d.kind === "tool" && d.uses ? (wear ?? d.uses) : undefined };
      left -= k;
    }
    this.onChange?.();
    return left;
  }

  /** Take n of an item from anywhere (last slots first). */
  take(id: string, n = 1): boolean {
    if (this.count(id) < n) return false;
    let left = n;
    for (let i = this.slots.length - 1; i >= 0 && left > 0; i--) {
      const s = this.slots[i];
      if (!s || s.id !== id) continue;
      const k = Math.min(left, s.n);
      s.n -= k;
      left -= k;
      if (!s.n) this.slots[i] = null;
    }
    this.onChange?.();
    return true;
  }

  takeAt(i: number, n = 1): Slot | null {
    const s = this.slots[i];
    if (!s) return null;
    const k = Math.min(n, s.n);
    s.n -= k;
    const out = { id: s.id, n: k, wear: s.wear };
    if (!s.n) this.slots[i] = null;
    this.onChange?.();
    return out;
  }

  firstTool(tool: string): number {
    let best = -1;
    let tier = -1;
    this.slots.forEach((s, i) => {
      if (!s) return;
      const d = item(s.id);
      if (d.tool === tool && (d.tier ?? 1) > tier) {
        best = i;
        tier = d.tier ?? 1;
      }
    });
    return best;
  }

  toJSON(): unknown {
    return { slots: this.slots, money: this.money, storage: this.storage };
  }

  static from(j: { slots: (Slot | null)[]; money: number; storage?: Slot[] }): Pockets {
    const p = new Pockets(j.slots.length);
    p.slots = j.slots.map((s) => (s && safe(s.id) ? s : null));
    p.money = j.money;
    p.storage = (j.storage ?? []).filter((s) => safe(s.id));
    return p;
  }
}

function safe(id: string): boolean {
  try {
    item(id);
    return true;
  } catch {
    return false;
  }
}
