/**
 * Everything that changes the island goes through an op: shake a tree, chop, dig, hit a rock,
 * pick up, water, plant, drop, bury, place and turn furniture, lay a path. The host applies
 * ops (its own and its visitors') and sends the resulting tile changes to everyone; the actor
 * gets the items and the message.
 */
import { clock } from "../core/clock";
import { item } from "../data/items";
import { FURN_BY_ID } from "../render/furniture";
import { DX, DZ, idx, inside, K, W } from "../world/island";
import type { Obj } from "../world/state";
import { FOSSILS } from "../data/items";
import type { World } from "./world";

export type Op =
  | { op: "shake"; x: number; z: number }
  | { op: "chop"; x: number; z: number; tier: number }
  | { op: "dig"; x: number; z: number; power: boolean }
  | { op: "rock"; x: number; z: number; power: boolean }
  | { op: "pick"; x: number; z: number }
  | { op: "water"; x: number; z: number; dir: number; tier: number }
  | { op: "plant"; x: number; z: number; id: string }
  | { op: "drop"; x: number; z: number; id: string; n: number; rot: number }
  | { op: "bury"; x: number; z: number; id: string }
  | { op: "turn"; x: number; z: number }
  | { op: "path"; x: number; z: number; type: number };

export interface OpResult {
  ok: boolean;
  /** Tile changes to broadcast. */
  set: [number, Obj | null][];
  /** Items for the actor. */
  give: [string, number][];
  /** Doromi (money) for the actor. */
  money?: number;
  /** Items the actor used up (dropped, planted, buried). */
  spend?: [string, number][];
  fx?: string;
  msg?: string;
  /** A tree's shake animation, a wasp nest… */
  event?: { kind: "wasps" | "shake" | "fell" | "rockhit" | "rockbreak" | "splash"; x: number; z: number };
  /** Rock hits happen fast in a row (the rock recoils the player). */
  recoil?: boolean;
}

const none = (msg?: string): OpResult => ({ ok: false, set: [], give: [], msg });

/** Free tiles round (x, z), nearest first (for fruit and loot to land on). */
function around(w: World, x: number, z: number, n: number, used: Set<number>): [number, number][] {
  const out: [number, number][] = [];
  for (const [dx, dz] of [
    [0, 1],
    [1, 0],
    [-1, 0],
    [0, -1],
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
    [0, 2],
    [2, 0],
    [-2, 0],
    [0, -2],
  ]) {
    const tx = x + dx;
    const tz = z + dz;
    if (!inside(tx, tz) || used.has(idx(tx, tz))) continue;
    if (!w.freeTile(tx, tz)) continue;
    out.push([tx, tz]);
    used.add(idx(tx, tz));
    if (out.length >= n) break;
  }
  return out;
}

const ROCK_LOOT: [string, number][] = [
  ["stone", 45],
  ["clay", 25],
  ["iron", 22],
  ["gold", 1.5],
];

function pickLoot(t: [string, number][]): string {
  const sum = t.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * sum;
  for (const [id, w] of t) if ((r -= w) <= 0) return id;
  return t[0][0];
}

export function applyOp(w: World, op: Op): OpResult {
  const { x, z } = op;
  if (!inside(x, z)) return none();
  const i = idx(x, z);
  const o = w.S.objs[i];
  const day = clock.day();
  const set: [number, Obj | null][] = [];
  const put = (tx: number, tz: number, v: Obj | null) => {
    set.push([idx(tx, tz), v]);
    w.setObj(tx, tz, v);
  };
  switch (op.op) {
    case "shake": {
      if (o?.t !== "tree" || o.stage < 3) return none();
      const used = new Set<number>();
      const res: OpResult = { ok: true, set, give: [], fx: "shake", event: { kind: "shake", x, z } };
      if (o.fruit && o.fruitN > 0) {
        for (const [tx, tz] of around(w, x, z, o.fruitN, used)) put(tx, tz, { t: "item", id: o.fruit, n: 1 });
        o.fruitN = 0;
        set.push([i, o]);
        w.view.dirty = true;
      }
      if (o.shook !== day) {
        o.shook = day;
        set.push([i, o]);
        // Once a day each tree can drop a branch, now and then something better.
        const r = Math.random();
        const spot = around(w, x, z, 1, used)[0];
        if (spot) {
          if (r < 0.04) {
            res.event = { kind: "wasps", x, z };
            res.msg = "벌집이 떨어졌다! 도망쳐!";
          } else if (r < 0.1) put(spot[0], spot[1], { t: "item", id: "acorns", n: 1 });
          else if (r < 0.14) {
            const pool = [...FURN_BY_ID.values()].filter((f) => f.cat === "outdoor" || f.cat === "toy");
            const f = pool[Math.floor(Math.random() * pool.length)];
            put(spot[0], spot[1], { t: "item", id: `furn:${f.id}:${Math.floor(Math.random() * f.colors.length)}`, n: 1 });
          } else if (r < 0.55) put(spot[0], spot[1], { t: "item", id: "branch", n: 1 });
        }
      }
      return res;
    }
    case "chop": {
      if (o?.t !== "tree") return none();
      if (o.stage < 3) {
        put(x, z, null);
        return { ok: true, set, give: [["wood", 1]], fx: "chop", event: { kind: "fell", x, z } };
      }
      if (o.chops < 3) {
        o.chops++;
        set.push([i, o]);
        w.view.dirty = true;
        const wood = o.kind === "cedar" ? (Math.random() < 0.6 ? "softwood" : "wood") : ["wood", "softwood", "hardwood"][Math.floor(Math.random() * 3)];
        const used = new Set<number>();
        const spot = around(w, x, z, 1, used)[0];
        if (spot) put(spot[0], spot[1], { t: "item", id: wood, n: 1 });
        return { ok: true, set, give: spot ? [] : [[wood, 1]], fx: "chop", event: { kind: "shake", x, z } };
      }
      if (op.tier >= 2) {
        put(x, z, { t: "stump", kind: o.kind });
        return { ok: true, set, give: [["wood", 1]], fx: "fell", event: { kind: "fell", x, z }, msg: "나무를 베었다." };
      }
      return { ok: true, set, give: [], fx: "chop", event: { kind: "shake", x, z } };
    }
    case "rock": {
      if (o?.t !== "rock") return none();
      if (op.power) {
        put(x, z, null);
        const give: [string, number][] = [
          ["stone", 2],
          [pickLoot(ROCK_LOOT), 1],
        ];
        return { ok: true, set, give, fx: "rockbreak", event: { kind: "rockbreak", x, z }, msg: "힘을 내서 바위를 깨뜨렸다!" };
      }
      if (o.hits >= 8) return { ok: true, set, give: [], fx: "rockhit", recoil: true };
      o.hits++;
      set.push([i, o]);
      const used = new Set<number>();
      const spot = around(w, x, z, 1, used)[0];
      if (!spot) return { ok: true, set, give: [], fx: "rockhit", recoil: true };
      if (i === w.S.moneyRock) {
        const money = [100, 200, 400, 800, 1600, 3200, 6400, 12800][o.hits - 1];
        put(spot[0], spot[1], { t: "item", id: "acorns", n: 1 });
        return { ok: true, set, give: [], money, fx: "rockhit", recoil: true, event: { kind: "rockhit", x, z } };
      }
      put(spot[0], spot[1], { t: "item", id: pickLoot(ROCK_LOOT), n: 1 });
      return { ok: true, set, give: [], fx: "rockhit", recoil: true, event: { kind: "rockhit", x, z } };
    }
    case "dig": {
      if (!o) {
        const k = w.I.kind[i];
        if ((k !== K.Grass && k !== K.Sand) || w.isSolid(x, z) || w.S.paths[i]) return none("여긴 파기 어렵겠어.");
        put(x, z, { t: "hole" });
        return { ok: true, set, give: [], fx: "dig" };
      }
      if (o.t === "hole") {
        put(x, z, null);
        return { ok: true, set, give: [], fx: "fill" };
      }
      if (o.t === "buried") {
        put(x, z, { t: "hole" });
        if (o.id === "fossil") return { ok: true, set, give: [["fossil", 1]], fx: "dig", msg: "화석을 발견했다!" };
        return { ok: true, set, give: [[o.id, 1]], fx: "dig", msg: `${item(o.id).name}을(를) 파냈다!` };
      }
      if (o.t === "stump") {
        put(x, z, null);
        return { ok: true, set, give: [], fx: "dig", msg: "그루터기를 뽑았다." };
      }
      if (o.t === "flower") {
        put(x, z, null);
        return { ok: true, set, give: [[`flower:${o.sp}:${o.col}`, 1]], fx: "dig" };
      }
      if (o.t === "tree") {
        if (o.stage >= 3 && !op.power) return { ok: false, set, give: [], msg: "너무 커서 뽑을 수 없어. 과일을 먹고 힘을 내면…?" };
        put(x, z, null);
        const id = o.kind === "cedar" ? "cedar-sapling" : o.kind === "fruit" && o.fruit ? o.fruit : o.kind === "palm" ? "coconut" : "sapling";
        return { ok: true, set, give: [[id, 1]], fx: "dig", msg: o.stage >= 3 ? "나무를 통째로 뽑았다!" : undefined };
      }
      if (o.t === "rock") return applyOp(w, { op: "rock", x, z, power: op.power });
      if (o.t === "weed" || o.t === "shell" || o.t === "item") return applyOp(w, { op: "pick", x, z });
      return none();
    }
    case "pick": {
      if (!o) return none();
      if (o.t === "item") {
        put(x, z, null);
        return { ok: true, set, give: [[o.id, o.n]], fx: "pick" };
      }
      if (o.t === "weed") {
        put(x, z, null);
        return { ok: true, set, give: [["weed", 1]], fx: "pick" };
      }
      if (o.t === "shell") {
        put(x, z, null);
        return { ok: true, set, give: [[`shell${o.v}`, 1]], fx: "pick" };
      }
      if (o.t === "flower" && o.stage === 2) {
        o.stage = 1;
        set.push([i, o]);
        w.view.dirty = true;
        return { ok: true, set, give: [[`flower:${o.sp}:${o.col}`, 1]], fx: "pick" };
      }
      if (o.t === "furn") {
        put(x, z, null);
        return { ok: true, set, give: [[o.id, 1]], fx: "pick" };
      }
      return none();
    }
    case "water": {
      const d = op.dir;
      const px = -DZ[d];
      const pz = DX[d];
      let any = false;
      const cells: [number, number][] = [];
      for (let s = -1; s <= 1; s++) cells.push([x + px * s, z + pz * s]);
      if (op.tier >= 2) for (let s = -1; s <= 1; s++) cells.push([x + px * s + DX[d], z + pz * s + DZ[d]]);
      for (const [tx, tz] of cells) {
        const f = w.obj(tx, tz);
        if (f?.t === "flower") {
          f.water = day;
          set.push([idx(tx, tz), f]);
          any = true;
        }
      }
      return { ok: true, set, give: [], fx: any ? "water" : "splash" };
    }
    case "plant": {
      if (!w.freeTile(x, z)) return none("여기엔 심을 수 없어.");
      const d = item(op.id);
      const sand = w.I.kind[i] === K.Sand;
      let v: Obj | null = null;
      if (d.kind === "sapling") v = sand ? null : { t: "tree", kind: op.id === "cedar-sapling" ? "cedar" : "hard", stage: 0, fruitN: 0, chops: 0, age: 0, shook: -1 };
      else if (op.id === "coconut") v = sand ? { t: "tree", kind: "palm", stage: 0, fruit: "coconut", fruitN: 0, chops: 0, age: 0, shook: -1 } : null;
      else if (d.kind === "fruit") v = sand ? null : { t: "tree", kind: "fruit", stage: 0, fruit: op.id, fruitN: 0, chops: 0, age: 0, shook: -1 };
      else if (d.kind === "seed" && d.flower) v = sand ? null : { t: "flower", sp: d.flower.sp, col: d.flower.col, stage: 0, water: -1, age: 0 };
      else if (d.kind === "flower" && d.flower) v = sand ? null : { t: "flower", sp: d.flower.sp, col: d.flower.col, stage: 2, water: -1, age: 3 };
      if (!v) return none(sand ? "모래에선 자라지 않을 것 같아." : "심을 수 없는 물건이야.");
      put(x, z, v);
      return { ok: true, set, give: [], spend: [[op.id, 1]], fx: "plant" };
    }
    case "drop": {
      if (!w.freeTile(x, z)) return none("여긴 둘 자리가 없어.");
      const d = item(op.id);
      const v: Obj = d.kind === "furniture" ? { t: "furn", id: op.id, rot: op.rot } : { t: "item", id: op.id, n: op.n };
      put(x, z, v);
      return { ok: true, set, give: [], spend: [[op.id, op.n]], fx: "drop" };
    }
    case "bury": {
      if (o?.t !== "hole") return none();
      put(x, z, { t: "buried", id: op.id, mark: false });
      return { ok: true, set, give: [], spend: [[op.id, 1]], fx: "fill" };
    }
    case "turn": {
      if (o?.t !== "furn") return none();
      o.rot = (o.rot + 1) % 4;
      set.push([i, o]);
      w.view.dirty = true;
      return { ok: true, set, give: [], fx: "drop" };
    }
    case "path": {
      if (w.I.kind[i] !== K.Grass && w.I.kind[i] !== K.Sand) return none();
      w.setPath(x, z, op.type);
      return { ok: true, set: [], give: [], fx: "dig" };
    }
  }
}

/** Appraise a fossil: which one did you dig up? (Weighted to what's not been found yet.) */
export function appraise(have: Set<string>): string {
  const missing = FOSSILS.filter(([id]) => !have.has(`fossil:${id}`));
  const pool = missing.length && Math.random() < 0.7 ? missing : FOSSILS;
  return `fossil:${pool[Math.floor(Math.random() * pool.length)][0]}`;
}

void W;
