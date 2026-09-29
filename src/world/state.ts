/**
 * What changes on the island: the thing on each tile (trees and how grown they are, rocks and
 * how often they've been hit today, flowers, weeds, shells, dropped items, furniture set out,
 * holes and buried things), laid paths, and the day bookkeeping that regrows fruit and scatters
 * new shells each morning. Plain JSON-able data; the host owns it and sends changes to guests.
 */
import { rng } from "../core/noise";
import { FLOWERS, H, idx, inside, K, W, type Flower, type Island } from "./island";

export type TreeKind = "hard" | "cedar" | "palm" | "fruit";

export type Obj =
  | { t: "tree"; kind: TreeKind; stage: number; fruit?: string; fruitN: number; chops: number; age: number; shook: number }
  | { t: "stump"; kind: TreeKind }
  | { t: "rock"; hits: number }
  | { t: "flower"; sp: Flower; col: number; stage: number; water: number; age: number }
  | { t: "weed"; v: number }
  | { t: "shell"; v: number }
  | { t: "item"; id: string; n: number }
  | { t: "furn"; id: string; rot: number }
  | { t: "hole" }
  | { t: "buried"; id: string; mark: boolean };

export interface IslandState {
  seed: number;
  objs: Record<number, Obj>;
  paths: Record<number, number>;
  /** The last island day the morning chores ran for. */
  day: number;
  /** Which rock gives money today (tile index). */
  moneyRock: number;
}

export function freshState(I: Island): IslandState {
  const objs: Record<number, Obj> = {};
  for (const [i, s] of I.seeded) {
    if (s.t === "tree") objs[i] = { t: "tree", kind: s.kind, stage: 3, fruit: s.fruit, fruitN: s.fruit ? 3 : 0, chops: 0, age: 99, shook: -1 };
    else if (s.t === "rock") objs[i] = { t: "rock", hits: 0 };
    else if (s.t === "flower") objs[i] = { t: "flower", sp: s.sp, col: s.col, stage: 2, water: -1, age: 9 };
    else if (s.t === "weed") objs[i] = { t: "weed", v: s.v };
    else if (s.t === "shell") objs[i] = { t: "shell", v: s.v };
  }
  return { seed: I.seed, objs, paths: {}, day: -1, moneyRock: -1 };
}

/** Is a tile free for dropping or planting (not water, not a building, nothing on it)? */
export function tileFree(I: Island, S: IslandState, x: number, z: number, blocked: (x: number, z: number) => boolean): boolean {
  if (!inside(x, z)) return false;
  const i = idx(x, z);
  const k = I.kind[i];
  if (k !== K.Grass && k !== K.Sand) return false;
  if (S.objs[i]) return false;
  return !blocked(x, z);
}

/**
 * The morning: run once per island day. Fruit regrows, rocks refill, trees and flowers grow,
 * flowers watered yesterday may seed a hybrid next door, new shells wash up, fossils get
 * buried, a few weeds sprout. Returns the tiles it touched.
 */
export function morning(I: Island, S: IslandState, day: number, blocked: (x: number, z: number) => boolean): number[] {
  if (S.day === day) return [];
  const R = rng(I.seed * 131 + day * 7);
  const touched: number[] = [];
  const firstDay = S.day < 0;
  const passed = firstDay ? 1 : Math.max(1, Math.min(7, day - S.day));
  S.day = day;
  const rocks: number[] = [];
  const newborn: [number, Obj][] = [];
  for (const k of Object.keys(S.objs)) {
    const i = +k;
    const o = S.objs[i];
    if (o.t === "tree") {
      o.chops = 0;
      if (o.stage < 3) {
        o.age += passed;
        // Saplings need room to grow: nothing on the eight tiles around.
        const x = i % W;
        const z = (i / W) | 0;
        let room = true;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if ((dx || dz) && inside(x + dx, z + dz) && S.objs[idx(x + dx, z + dz)]?.t === "tree") room = false;
        if (room && o.age >= (o.stage + 1) * 1) o.stage = Math.min(3, o.stage + 1);
      }
      if (o.stage === 3 && o.fruit && o.fruitN < 3 && (o.age >= 99 || R() < 0.34 * passed)) o.fruitN = 3;
      touched.push(i);
    } else if (o.t === "rock") {
      o.hits = 0;
      rocks.push(i);
    } else if (o.t === "flower") {
      const watered = o.water >= day - 1;
      o.age += 1;
      if (o.stage < 2 && (watered || R() < 0.5)) o.stage++;
      if (o.stage === 2 && watered) {
        // Breed with a watered neighbour of the same kind.
        const x = i % W;
        const z = (i / W) | 0;
        const mates: Obj[] = [];
        for (let dz = -1; dz <= 1; dz++)
          for (let dx = -1; dx <= 1; dx++) {
            if ((!dx && !dz) || !inside(x + dx, z + dz)) continue;
            const m = S.objs[idx(x + dx, z + dz)];
            if (m?.t === "flower" && m.sp === o.sp && m.stage === 2 && m.water >= day - 1) mates.push(m);
          }
        if (mates.length && R() < 0.25) {
          const mate = mates[Math.floor(R() * mates.length)] as Extract<Obj, { t: "flower" }>;
          const spots: number[] = [];
          for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if ((dx || dz) && tileFree(I, S, x + dx, z + dz, blocked) && I.kind[idx(x + dx, z + dz)] === K.Grass) spots.push(idx(x + dx, z + dz));
          if (spots.length) {
            const j = spots[Math.floor(R() * spots.length)];
            newborn.push([j, { t: "flower", sp: o.sp, col: hybrid(o.col, mate.col, R), stage: 0, water: -1, age: 0 }]);
          }
        }
      }
      touched.push(i);
    } else if (o.t === "shell" && R() < 0.5) {
      delete S.objs[i];
      touched.push(i);
    } else if (o.t === "buried" && o.mark && R() < 0.3) {
      delete S.objs[i];
      touched.push(i);
    } else if (o.t === "hole" && R() < 0.5) {
      delete S.objs[i];
      touched.push(i);
    }
  }
  for (const [j, o] of newborn) if (!S.objs[j]) {
    S.objs[j] = o;
    touched.push(j);
  }
  S.moneyRock = rocks.length ? rocks[Math.floor(R() * rocks.length)] : -1;
  const scatter = (n: number, want: (i: number) => boolean, make: () => Obj) => {
    for (let k = 0, put = 0; k < n * 40 && put < n; k++) {
      const x = 2 + Math.floor(R() * (W - 4));
      const z = 2 + Math.floor(R() * (H - 4));
      const i = idx(x, z);
      if (!want(i) || !tileFree(I, S, x, z, blocked)) continue;
      S.objs[i] = make();
      touched.push(i);
      put++;
    }
  };
  // Shells on the beach, fossils under the grass, weeds.
  scatter(8, (i) => I.kind[i] === K.Sand && I.seaDist[i] < 3, () => ({ t: "shell", v: Math.floor(R() * 6) }));
  const fossils = Object.values(S.objs).filter((o) => o.t === "buried" && o.mark).length;
  scatter(Math.max(0, 5 - fossils), (i) => I.kind[i] === K.Grass, () => ({ t: "buried", id: "fossil", mark: true }));
  const weeds = Object.values(S.objs).filter((o) => o.t === "weed").length;
  scatter(Math.min(12, Math.max(0, 120 - weeds)), (i) => I.kind[i] === K.Grass, () => ({ t: "weed", v: Math.floor(R() * 3) }));
  return touched;
}

/**
 * Flower colour genetics, simplified: two parents of the same species can make a colour
 * neither has. Red+yellow → orange, red+white → pink, red+blue → purple, white+white → blue
 * (rare), purple+orange → black (rare); otherwise one parent's colour.
 */
export function hybrid(a: number, b: number, R: () => number): number {
  const has = (x: number, y: number) => (a === x && b === y) || (a === y && b === x);
  if (has(0, 1)) return R() < 0.5 ? 4 : R() < 0.5 ? 0 : 1;
  if (has(0, 2)) return R() < 0.5 ? 3 : R() < 0.5 ? 0 : 2;
  if (has(0, 6)) return R() < 0.5 ? 5 : 0;
  if (has(2, 2)) return R() < 0.12 ? 6 : 2;
  if (has(5, 4)) return R() < 0.15 ? 7 : 5;
  if (has(3, 1)) return R() < 0.4 ? 4 : 3;
  return R() < 0.5 ? a : b;
}

export const FLOWER_NAMES: Record<Flower, string> = { tulip: "튤립", rose: "장미", cosmos: "코스모스", lily: "백합", pansy: "팬지", mum: "국화", hyacinth: "히아신스", poppy: "양귀비" };
export { FLOWERS };
