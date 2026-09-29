/**
 * The island generator. A seed becomes a grid of 1 m tiles: sea, sand, grass on three tiers,
 * rivers that start on the highest tier and fall over the cliffs to the sea, ponds, a rocky
 * shore. Then it makes sure every piece of land can be walked to (ramps up the cliffs, bridges
 * over the rivers, added greedily until the land graph is connected), picks spots for the
 * buildings, and sows trees, rocks, flowers, weeds and shells. Pure data, no DOM, deterministic.
 */
import { Noise, rng } from "../core/noise";

export const W = 112;
export const H = 96;
export const TIER_H = 1.35;
export const SEA_Y = -0.35;

export const enum K {
  Sea = 0,
  Sand = 1,
  Grass = 2,
  River = 3,
  Pond = 4,
  Rock = 5,
  Pier = 6,
}

export type Dir = 0 | 1 | 2 | 3; // +x, +z, -x, -z
export const DX = [1, 0, -1, 0];
export const DZ = [0, 1, 0, -1];

export interface Ramp {
  /** Footprint (inclusive min corner, size). */
  x: number;
  z: number;
  w: number;
  l: number;
  /** Direction of the climb. */
  dir: Dir;
  /** Tier at the bottom. */
  low: number;
}

export interface Bridge {
  x: number;
  z: number;
  w: number;
  l: number;
  /** Along which axis the bridge runs (0 = x, 1 = z). */
  axis: 0 | 1;
  tier: number;
}

export type PlotKind = "office" | "shop" | "museum" | "home" | "house" | "camp" | "dock";

export interface Plot {
  kind: PlotKind;
  x: number;
  z: number;
  w: number;
  d: number;
  tier: number;
  /** The tile in front of the door (south side). */
  door: [number, number];
}

export interface Fall {
  /** River tile on the upper side of the cliff and the direction the water drops. */
  x: number;
  z: number;
  dir: Dir;
  tier: number;
}

export type Fruit = "apple" | "orange" | "pear" | "peach" | "persimmon";
export const FRUITS: Fruit[] = ["apple", "orange", "pear", "peach", "persimmon"];
export const FLOWERS = ["tulip", "rose", "cosmos", "lily", "pansy", "mum", "hyacinth", "poppy"] as const;
export type Flower = (typeof FLOWERS)[number];

/** A thing standing on a tile when the island is made. */
export type Seeded =
  | { t: "tree"; kind: "hard" | "cedar" | "palm" | "fruit"; fruit?: Fruit | "coconut" }
  | { t: "rock" }
  | { t: "flower"; sp: Flower; col: number }
  | { t: "weed"; v: number }
  | { t: "shell"; v: number };

export interface Island {
  seed: number;
  kind: Uint8Array;
  tier: Uint8Array;
  /** Distance to the sea in tiles (for the beach slope and shore effects). */
  seaDist: Float32Array;
  ramps: Ramp[];
  bridges: Bridge[];
  falls: Fall[];
  plots: Plot[];
  fruit: Fruit;
  flower: Flower;
  seeded: Map<number, Seeded>;
  name: string;
}

export const idx = (x: number, z: number) => z * W + x;
export const inside = (x: number, z: number) => x >= 0 && z >= 0 && x < W && z < H;

// ------------------------------------------------------------------ helpers

/** Exact Euclidean distance (in tiles) from every cell to the nearest cell where mask is set. */
export function edt(mask: (i: number) => boolean, w = W, h = H): Float32Array {
  const INF = 1e9;
  const f = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) f[i] = mask(i) ? 0 : INF;
  const n = Math.max(w, h);
  const d = new Float32Array(n);
  const v = new Int32Array(n);
  const zz = new Float32Array(n + 1);
  const g = new Float32Array(n);
  const pass = (len: number) => {
    let k = 0;
    v[0] = 0;
    zz[0] = -INF;
    zz[1] = INF;
    for (let q = 1; q < len; q++) {
      let s = (g[q] + q * q - (g[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= zz[k]) {
        k--;
        s = (g[q] + q * q - (g[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q;
      zz[k] = s;
      zz[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < len; q++) {
      while (zz[k + 1] < q) k++;
      d[q] = (q - v[k]) * (q - v[k]) + g[v[k]];
    }
  };
  for (let x = 0; x < w; x++) {
    for (let z = 0; z < h; z++) g[z] = f[z * w + x];
    pass(h);
    for (let z = 0; z < h; z++) f[z * w + x] = d[z];
  }
  for (let z = 0; z < h; z++) {
    for (let x = 0; x < w; x++) g[x] = f[z * w + x];
    pass(w);
    for (let x = 0; x < w; x++) f[z * w + x] = Math.sqrt(d[x]);
  }
  return f;
}

/** Label 4-connected components of cells where `ok` holds and `same` links neighbours. */
function label(ok: (i: number) => boolean, same: (a: number, b: number) => boolean): { lab: Int32Array; sizes: number[] } {
  const lab = new Int32Array(W * H).fill(-1);
  const sizes: number[] = [];
  const st: number[] = [];
  for (let s = 0; s < W * H; s++) {
    if (lab[s] >= 0 || !ok(s)) continue;
    const id = sizes.length;
    let n = 0;
    lab[s] = id;
    st.push(s);
    while (st.length) {
      const i = st.pop()!;
      n++;
      const x = i % W;
      const z = (i / W) | 0;
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d];
        const nz = z + DZ[d];
        if (!inside(nx, nz)) continue;
        const j = idx(nx, nz);
        if (lab[j] < 0 && ok(j) && same(i, j)) {
          lab[j] = id;
          st.push(j);
        }
      }
    }
    sizes.push(n);
  }
  return { lab, sizes };
}

/** Morphological opening then closing of a mask with a 3×3 square, restricted to `within`. */
function smooth(m: Uint8Array, within: (i: number) => boolean): void {
  const tmp = new Uint8Array(m.length);
  const erode = (src: Uint8Array, dst: Uint8Array) => {
    for (let z = 0; z < H; z++)
      for (let x = 0; x < W; x++) {
        let all = 1;
        for (let dz = -1; dz <= 1 && all; dz++) for (let dx = -1; dx <= 1; dx++) if (!inside(x + dx, z + dz) || !src[idx(x + dx, z + dz)]) all = 0;
        dst[idx(x, z)] = all;
      }
  };
  const dilate = (src: Uint8Array, dst: Uint8Array) => {
    for (let z = 0; z < H; z++)
      for (let x = 0; x < W; x++) {
        let any = 0;
        for (let dz = -1; dz <= 1 && !any; dz++) for (let dx = -1; dx <= 1; dx++) if (inside(x + dx, z + dz) && src[idx(x + dx, z + dz)]) any = 1;
        dst[idx(x, z)] = any && within(idx(x, z)) ? 1 : 0;
      }
  };
  erode(m, tmp);
  dilate(tmp, m);
  dilate(m, tmp);
  erode(tmp, m);
  for (let i = 0; i < m.length; i++) if (!within(i)) m[i] = 0;
}

// ------------------------------------------------------------------ names

const NAME_A = ["하늘", "바람", "솔", "달", "별", "해", "꽃", "모래", "파도", "노을", "구름", "이슬", "소라", "단풍", "새벽", "봄", "여름", "은빛", "초록", "푸른"];
const NAME_B = ["섬", "마을", "섬", "섬", "곶", "섬"];

// ------------------------------------------------------------------ the generator

export function generate(seed: number): Island {
  const R = rng(seed * 7919 + 13);
  const N = new Noise(seed);
  const kind = new Uint8Array(W * H);
  const tier = new Uint8Array(W * H);

  // Coast: a rounded rectangle roughened by fbm, keep the largest landmass.
  const land = new Uint8Array(W * H);
  for (let z = 0; z < H; z++)
    for (let x = 0; x < W; x++) {
      const px = Math.abs(x + 0.5 - W / 2) - (W / 2 - 15);
      const pz = Math.abs(z + 0.5 - H / 2) - (H / 2 - 14);
      const r = 14;
      const qx = Math.max(px + r, 0);
      const qz = Math.max(pz + r, 0);
      const box = Math.hypot(qx, qz) + Math.min(Math.max(px + r, pz + r), 0) - r;
      const d = box + N.fbm(x * 0.045, z * 0.045, 4) * 9 + N.n2(x * 0.15 + 70, z * 0.15) * 1.5;
      land[idx(x, z)] = d < 0 ? 1 : 0;
    }
  {
    const { lab, sizes } = label((i) => !!land[i], () => true);
    const big = sizes.indexOf(Math.max(...sizes));
    for (let i = 0; i < W * H; i++) land[i] = lab[i] === big ? 1 : 0;
    // Fill enclosed lagoons: sea not reachable from the border becomes land.
    const sea = label((i) => !land[i], () => true);
    const border = new Set<number>();
    for (let x = 0; x < W; x++) border.add(sea.lab[idx(x, 0)]).add(sea.lab[idx(x, H - 1)]);
    for (let z = 0; z < H; z++) border.add(sea.lab[idx(0, z)]).add(sea.lab[idx(W - 1, z)]);
    for (let i = 0; i < W * H; i++) if (!land[i] && !border.has(sea.lab[i])) land[i] = 1;
  }
  const seaDist = edt((i) => !land[i]);

  // Beach, wider to the south; a rocky shore on stretches of the north coast.
  for (let z = 0; z < H; z++)
    for (let x = 0; x < W; x++) {
      const i = idx(x, z);
      if (!land[i]) continue;
      const bw = 2.6 + 1.4 * (N.n2(x * 0.07 + 50, z * 0.07) * 0.5 + 0.5) + 2.4 * (z / H);
      if (seaDist[i] <= bw) {
        const rocky = z < H * 0.4 && N.n2(x * 0.09 + 9, z * 0.09 + 3) > 0.25 && seaDist[i] <= 2.2;
        kind[i] = rocky ? K.Rock : K.Sand;
      } else kind[i] = K.Grass;
    }
  // Grass must be one piece and at least 3 wide everywhere (sand fills the slivers).
  {
    const g = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) g[i] = kind[i] === K.Grass ? 1 : 0;
    smooth(g, (i) => kind[i] === K.Grass);
    const { lab, sizes } = label((i) => !!g[i], () => true);
    const big = sizes.indexOf(Math.max(...sizes));
    for (let i = 0; i < W * H; i++) if (kind[i] === K.Grass && lab[i] !== big) kind[i] = K.Sand;
  }

  // Tiers: the north rises in two steps.
  const inl = edt((i) => kind[i] !== K.Grass);
  const t1 = new Uint8Array(W * H);
  const t2 = new Uint8Array(W * H);
  for (let z = 0; z < H; z++)
    for (let x = 0; x < W; x++) {
      const i = idx(x, z);
      if (kind[i] !== K.Grass || inl[i] < 3.5) continue;
      if (z + N.fbm(x * 0.04 + 20, z * 0.04, 3) * 16 < H * 0.5) t1[i] = 1;
    }
  smooth(t1, (i) => kind[i] === K.Grass && inl[i] >= 3.5);
  const in1 = edt((i) => !t1[i]);
  for (let z = 0; z < H; z++)
    for (let x = 0; x < W; x++) {
      const i = idx(x, z);
      if (!t1[i] || in1[i] < 3.5) continue;
      if (z + N.fbm(x * 0.05 + 40, z * 0.05 + 5, 3) * 14 < H * 0.36) t2[i] = 1;
    }
  smooth(t2, (i) => !!t1[i] && in1[i] >= 3.5);
  for (const [m, min] of [
    [t1, 40],
    [t2, 24],
  ] as [Uint8Array, number][]) {
    const { lab, sizes } = label((i) => !!m[i], () => true);
    for (let i = 0; i < W * H; i++) if (m[i] && sizes[lab[i]] < min) m[i] = 0;
  }
  for (let i = 0; i < W * H; i++) tier[i] = t2[i] ? 2 : t1[i] ? 1 : 0;

  // Rivers: from the highest ground to two mouths, never uphill, crossing cliffs head-on.
  const falls: Fall[] = [];
  const river = new Uint8Array(W * H);
  const boundary = (i: number) => {
    const x = i % W;
    const z = (i / W) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d];
      const nz = z + DZ[d];
      if (inside(nx, nz) && (kind[idx(nx, nz)] === K.Grass || kind[idx(nx, nz)] === K.Sand) && tier[idx(nx, nz)] !== tier[i]) return true;
    }
    return false;
  };
  const nearEdge = edt((i) => boundary(i));
  const shoreCandidates = (pred: (x: number, z: number) => boolean) => {
    const out: number[] = [];
    for (let z = 1; z < H - 1; z++)
      for (let x = 1; x < W - 1; x++) {
        const i = idx(x, z);
        if (kind[i] !== K.Sand || seaDist[i] > 1.01 || !pred(x, z)) continue;
        out.push(i);
      }
    return out;
  };
  const astar = (from: number, goal: (i: number) => boolean, h: (i: number) => number, extra: (i: number) => number): number[] | null => {
    const g = new Float32Array(W * H).fill(Infinity);
    const came = new Int32Array(W * H).fill(-1);
    const dirOf = new Int8Array(W * H).fill(-1);
    const open: [number, number][] = [[h(from), from]];
    g[from] = 0;
    const push = (f: number, i: number) => {
      open.push([f, i]);
      let c = open.length - 1;
      while (c > 0) {
        const p = (c - 1) >> 1;
        if (open[p][0] <= open[c][0]) break;
        [open[p], open[c]] = [open[c], open[p]];
        c = p;
      }
    };
    const pop = () => {
      const top = open[0];
      const last = open.pop()!;
      if (open.length) {
        open[0] = last;
        let c = 0;
        for (;;) {
          const l = c * 2 + 1;
          const r = l + 1;
          let m = c;
          if (l < open.length && open[l][0] < open[m][0]) m = l;
          if (r < open.length && open[r][0] < open[m][0]) m = r;
          if (m === c) break;
          [open[m], open[c]] = [open[c], open[m]];
          c = m;
        }
      }
      return top;
    };
    while (open.length) {
      const [, i] = pop();
      if (goal(i)) {
        const path = [i];
        let c = i;
        while (came[c] >= 0) {
          c = came[c];
          path.push(c);
        }
        return path.reverse();
      }
      const x = i % W;
      const z = (i / W) | 0;
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d];
        const nz = z + DZ[d];
        if (!inside(nx, nz) || nx < 2 || nz < 2 || nx > W - 3 || nz > H - 3) continue;
        const j = idx(nx, nz);
        if (kind[j] !== K.Grass && kind[j] !== K.Sand) continue;
        if (tier[j] > tier[i]) continue;
        // Over a cliff only straight on, and not right after turning.
        if (tier[j] < tier[i] && dirOf[i] >= 0 && dirOf[i] !== d) continue;
        let c = 1 + extra(j);
        if (dirOf[i] >= 0 && dirOf[i] !== d) c += 0.6;
        if (tier[j] === tier[i] && nearEdge[j] < 2.5) c += 5;
        const ng = g[i] + c;
        if (ng < g[j]) {
          g[j] = ng;
          came[j] = i;
          dirOf[j] = d;
          push(ng + h(j), j);
        }
      }
    }
    return null;
  };
  const carve = (path: number[], wide: number) => {
    for (let k = 0; k < path.length; k++) {
      const i = path[k];
      const x = i % W;
      const z = (i / W) | 0;
      const r = kind[i] === K.Sand ? wide + 0.5 : wide;
      const ri = Math.ceil(r);
      for (let dz = -ri; dz <= ri; dz++)
        for (let dx = -ri; dx <= ri; dx++) {
          if (dx * dx + dz * dz > r * r + 0.01 || !inside(x + dx, z + dz)) continue;
          const j = idx(x + dx, z + dz);
          if ((kind[j] === K.Grass || kind[j] === K.Sand) && tier[j] === tier[i]) river[j] = 1;
        }
      if (k + 1 < path.length && tier[path[k + 1]] < tier[i]) {
        const nx = path[k + 1] % W;
        const d = nx > x ? 0 : nx < x ? 2 : ((path[k + 1] / W) | 0) > z ? 1 : 3;
        falls.push({ x, z, dir: d as Dir, tier: tier[i] });
      }
    }
  };
  const noiseCost = (i: number) => (N.fbm((i % W) * 0.09 + 300, ((i / W) | 0) * 0.09, 3) * 0.5 + 0.5) * 6;
  // Source: deep inside the top tier.
  const top = tier.some((t) => t === 2) ? 2 : 1;
  const inTop = edt((i) => tier[i] !== top || kind[i] !== K.Grass);
  let src = -1;
  let best = -1;
  for (let i = 0; i < W * H; i++) {
    const v = inTop[i] + R() * 2;
    if (tier[i] === top && kind[i] === K.Grass && v > best) {
      best = v;
      src = i;
    }
  }
  const south = shoreCandidates((x, z) => z > H * 0.62 && x > W * 0.25 && x < W * 0.75);
  const side = R() < 0.5 ? shoreCandidates((x, z) => x < W * 0.22 && z > H * 0.3 && z < H * 0.8) : shoreCandidates((x, z) => x > W * 0.78 && z > H * 0.3 && z < H * 0.8);
  const mouthA = south.length ? south[Math.floor(R() * south.length)] : -1;
  const mouthB = side.length ? side[Math.floor(R() * side.length)] : -1;
  const hTo = (m: number) => (i: number) => Math.abs((i % W) - (m % W)) + Math.abs(((i / W) | 0) - ((m / W) | 0));
  if (src >= 0 && mouthA >= 0) {
    const pa = astar(src, (i) => i === mouthA, hTo(mouthA), noiseCost);
    if (pa) {
      carve(pa, 1.15);
      // A fork: from a point part-way down the first river to the second mouth.
      if (mouthB >= 0) {
        const nearA = edt((i) => !!river[i]);
        const fromK = pa.findIndex((i, k) => k > pa.length * 0.25 && tier[i] <= 1);
        const start = pa[Math.max(0, fromK)];
        const pb = astar(start, (i) => i === mouthB, hTo(mouthB), (i) => noiseCost(i) + (nearA[i] < 4 && nearA[i] > 0 ? 6 : 0));
        if (pb) carve(pb, 1.15);
      }
    }
  }
  for (let i = 0; i < W * H; i++) if (river[i]) kind[i] = K.River;

  // Ponds.
  const wetD = () => edt((i) => kind[i] === K.River || kind[i] === K.Pond);
  for (let attempt = 0, made = 0; attempt < 400 && made < 3; attempt++) {
    const x = 6 + Math.floor(R() * (W - 12));
    const z = 6 + Math.floor(R() * (H - 12));
    const i = idx(x, z);
    if (kind[i] !== K.Grass || inl[i] < 7 || nearEdge[i] < 5) continue;
    const wd = wetD();
    if (wd[i] < 8) continue;
    const r0 = 1.8 + R() * 1.4;
    for (let dz = -5; dz <= 5; dz++)
      for (let dx = -5; dx <= 5; dx++) {
        const a = Math.atan2(dz, dx);
        const r = r0 + N.n2(Math.cos(a) * 1.3 + made * 10, Math.sin(a) * 1.3) * 1.1;
        if (Math.hypot(dx, dz) <= r && inside(x + dx, z + dz)) {
          const j = idx(x + dx, z + dz);
          if (kind[j] === K.Grass && tier[j] === tier[i] && nearEdge[j] >= 2) kind[j] = K.Pond;
        }
      }
    made++;
  }

  // ---------------------------------------------------------------- connectivity
  const walk = (i: number) => kind[i] === K.Grass || kind[i] === K.Sand;
  const ramps: Ramp[] = [];
  const bridges: Bridge[] = [];
  const conn = new Uint8Array(W * H); // tiles taken by ramps and bridges (and their landings)
  const connect = (extraOnly: boolean) => {
    const { lab, sizes } = label(walk, (a, b) => tier[a] === tier[b]);
    const parent = sizes.map((_, k) => k);
    const find = (a: number): number => (parent[a] === a ? a : (parent[a] = find(parent[a])));
    const cand: { kind: "ramp" | "bridge"; a: number; b: number; r?: Ramp; br?: Bridge; score: number }[] = [];
    // Ramps: 2 wide, 3 long, on the low side of a straight cliff edge.
    for (let z = 2; z < H - 2; z++)
      for (let x = 2; x < W - 2; x++)
        for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) {
          const px = -DZ[d];
          const pz = DX[d];
          const cells: number[] = [];
          let ok = true;
          let low = -1;
          for (let s = 0; s < 2 && ok; s++)
            for (let k = 0; k < 3 && ok; k++) {
              const cx = x + px * s + DX[d] * k;
              const cz = z + pz * s + DZ[d] * k;
              if (!inside(cx, cz)) {
                ok = false;
                break;
              }
              const j = idx(cx, cz);
              if (!walk(j) || conn[j] || kind[j] !== K.Grass) ok = false;
              if (low < 0) low = tier[j];
              else if (tier[j] !== low) ok = false;
              cells.push(j);
            }
          if (!ok || low > 1) continue;
          // Top landing on the upper tier, a straight edge either side, a bottom landing.
          const topOk = [0, 1].every((s) => {
            const cx = x + px * s + DX[d] * 3;
            const cz = z + pz * s + DZ[d] * 3;
            return inside(cx, cz) && walk(idx(cx, cz)) && tier[idx(cx, cz)] === low + 1 && !conn[idx(cx, cz)] && inside(cx + DX[d], cz + DZ[d]) && walk(idx(cx + DX[d], cz + DZ[d]));
          });
          const edgeOk = [-1, 2].every((s) => {
            const cx = x + px * s + DX[d] * 3;
            const cz = z + pz * s + DZ[d] * 3;
            const bx = x + px * s + DX[d] * 2;
            const bz = z + pz * s + DZ[d] * 2;
            return inside(cx, cz) && inside(bx, bz) && tier[idx(cx, cz)] === low + 1 && tier[idx(bx, bz)] === low && walk(idx(cx, cz)) && walk(idx(bx, bz));
          });
          const botOk = [0, 1].every((s) => {
            const cx = x + px * s - DX[d];
            const cz = z + pz * s - DZ[d];
            return inside(cx, cz) && walk(idx(cx, cz)) && tier[idx(cx, cz)] === low;
          });
          if (!topOk || !edgeOk || !botOk) continue;
          const ta = idx(x + DX[d] * 3, z + DZ[d] * 3);
          const a = lab[cells[0]];
          const b = lab[ta];
          const rx = Math.min(x, x + px, x + DX[d] * 2, x + px + DX[d] * 2);
          const rz = Math.min(z, z + pz, z + DZ[d] * 2, z + pz + DZ[d] * 2);
          const r: Ramp = { x: rx, z: rz, w: d === 0 || d === 2 ? 3 : 2, l: d === 0 || d === 2 ? 2 : 3, dir: d, low };
          cand.push({ kind: "ramp", a, b, r, score: R() });
        }
    // Bridges: over 2–5 river tiles between two banks on the same tier.
    for (let z = 2; z < H - 2; z++)
      for (let x = 2; x < W - 2; x++)
        for (const axis of [0, 1] as const) {
          const ax = axis === 0 ? 1 : 0;
          const az = axis === 0 ? 0 : 1;
          const bx = axis === 0 ? 0 : 1;
          const bz = axis === 0 ? 1 : 0;
          const start = idx(x, z);
          if (!walk(start) || kind[start] !== K.Grass && kind[start] !== K.Sand) continue;
          const t = tier[start];
          // Two lanes wide.
          if (!inside(x + bx, z + bz) || !walk(idx(x + bx, z + bz)) || tier[idx(x + bx, z + bz)] !== t) continue;
          let L = 0;
          let ok = true;
          while (L < 6) {
            const cx = x + ax * (L + 1);
            const cz = z + az * (L + 1);
            if (!inside(cx + bx, cz + bz)) {
              ok = false;
              break;
            }
            const j1 = idx(cx, cz);
            const j2 = idx(cx + bx, cz + bz);
            if (kind[j1] === K.River && kind[j2] === K.River && tier[j1] === t && tier[j2] === t) L++;
            else break;
          }
          if (!ok || L < 2 || L > 5) continue;
          const ex = x + ax * (L + 1);
          const ez = z + az * (L + 1);
          if (!inside(ex + bx, ez + bz)) continue;
          const e1 = idx(ex, ez);
          const e2 = idx(ex + bx, ez + bz);
          if (!walk(e1) || !walk(e2) || tier[e1] !== t || tier[e2] !== t) continue;
          // Straight river: the tiles beside the bridge are river too.
          let straight = true;
          for (let k = 1; k <= L; k++) {
            const s1x = x + ax * k - bx;
            const s1z = z + az * k - bz;
            const s2x = x + ax * k + bx * 2;
            const s2z = z + az * k + bz * 2;
            if (!inside(s1x, s1z) || !inside(s2x, s2z) || kind[idx(s1x, s1z)] !== K.River || kind[idx(s2x, s2z)] !== K.River) straight = false;
          }
          if (!straight) continue;
          const br: Bridge = { x: x + ax, z: z + az, w: axis === 0 ? L : 2, l: axis === 0 ? 2 : L, axis, tier: t };
          cand.push({ kind: "bridge", a: lab[start], b: lab[e1], br, score: R() + L * 0.1 });
        }
    const main = sizes.indexOf(Math.max(...sizes));
    const joined = () => {
      const want = sizes.map((s, k) => (s >= 10 ? k : -1)).filter((k) => k >= 0);
      return want.every((k) => find(k) === find(main));
    };
    const far = (x: number, z: number, list: { x: number; z: number }[], d: number) => list.every((q) => Math.hypot(q.x - x, q.z - z) > d);
    const take = (c: (typeof cand)[number]) => {
      if (c.r) {
        ramps.push(c.r);
        for (let dz = -1; dz <= c.r.l; dz++) for (let dx = -1; dx <= c.r.w; dx++) if (inside(c.r.x + dx, c.r.z + dz)) conn[idx(c.r.x + dx, c.r.z + dz)] = 1;
      } else if (c.br) {
        bridges.push(c.br);
        for (let dz = -1; dz <= c.br.l; dz++) for (let dx = -1; dx <= c.br.w; dx++) if (inside(c.br.x + dx, c.br.z + dz)) conn[idx(c.br.x + dx, c.br.z + dz)] = 1;
      }
      parent[find(c.a)] = find(c.b);
    };
    cand.sort((p, q) => p.score - q.score);
    if (!extraOnly) {
      let guard = 0;
      while (!joined() && guard++ < 40) {
        const c = cand.find((c) => find(c.a) !== find(c.b) && (find(c.a) === find(main) || find(c.b) === find(main)) && (c.r ? far(c.r.x, c.r.z, ramps, 10) : far(c.br!.x, c.br!.z, bridges, 8)));
        const c2 = c ?? cand.find((c) => find(c.a) !== find(c.b) && (find(c.a) === find(main) || find(c.b) === find(main)));
        if (!c2) break;
        take(c2);
      }
    } else {
      // A few more so walks aren't long detours.
      for (const c of cand) {
        if (c.r && ramps.length < 4 && far(c.r.x, c.r.z, ramps, 22) && !conn[idx(c.r.x, c.r.z)]) take(c);
        if (c.br && bridges.length < 4 && far(c.br.x, c.br.z, bridges, 18) && !conn[idx(c.br.x, c.br.z)]) take(c);
      }
    }
  };
  connect(false);
  connect(true);

  // Waterfalls sit where river tiles on two tiers meet; keep only falls whose lower tile is river.
  const fallsOk = falls.filter((f) => {
    const nx = f.x + DX[f.dir];
    const nz = f.z + DZ[f.dir];
    return inside(nx, nz) && kind[idx(nx, nz)] === K.River && tier[idx(nx, nz)] < f.tier;
  });

  // ---------------------------------------------------------------- building plots
  const plots: Plot[] = [];
  const taken = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (conn[i]) taken[i] = 1;
  const { lab: wl, sizes: ws } = label(walk, (a, b) => tier[a] === tier[b]);
  // Components reachable from the main one (through ramps/bridges we already guaranteed).
  const reachable = (i: number) => ws[wl[i]] >= 10;
  const edgeD = edt((i) => !walk(i) || boundary(i));
  const fits = (x: number, z: number, w: number, d: number, t: number | null, margin: number) => {
    let tt = -1;
    for (let dz = -margin; dz < d + margin + 1; dz++)
      for (let dx = -margin; dx < w + margin; dx++) {
        const cx = x + dx;
        const cz = z + dz;
        if (!inside(cx, cz)) return false;
        const j = idx(cx, cz);
        if (taken[j] || kind[j] !== K.Grass || !reachable(j) || edgeD[j] < 1) return false;
        if (tt < 0) tt = tier[j];
        else if (tier[j] !== tt) return false;
      }
    return t === null || tt === t;
  };
  const claim = (kindP: PlotKind, x: number, z: number, w: number, d: number) => {
    for (let dz = -1; dz < d + 3; dz++) for (let dx = -1; dx < w + 1; dx++) if (inside(x + dx, z + dz)) taken[idx(x + dx, z + dz)] = 1;
    const p: Plot = { kind: kindP, x, z, w, d, tier: tier[idx(x, z)], door: [x + Math.floor(w / 2), z + d] };
    plots.push(p);
    return p;
  };
  const place = (kindP: PlotKind, w: number, d: number, near: [number, number], spread: number, tierWanted: number | null, minApart = 0) => {
    let bestP: [number, number] | null = null;
    let bestS = Infinity;
    for (let k = 0; k < 3000; k++) {
      const x = Math.floor(near[0] + (R() - 0.5) * spread * 2);
      const z = Math.floor(near[1] + (R() - 0.5) * spread * 2);
      if (!fits(x, z, w, d, tierWanted, 1)) continue;
      if (minApart && plots.some((p) => p.kind === kindP && Math.hypot(p.x - x, p.z - z) < minApart)) continue;
      const s = Math.hypot(x + w / 2 - near[0], z + d / 2 - near[1]) + R() * spread * 0.4;
      if (s < bestS) {
        bestS = s;
        bestP = [x, z];
      }
    }
    return bestP ? claim(kindP, bestP[0], bestP[1], w, d) : null;
  };
  const cx = W / 2;
  const office = place("office", 7, 5, [cx, H * 0.6], 14, 0) ?? place("office", 7, 5, [cx, H * 0.55], 40, null);
  const oc: [number, number] = office ? [office.x + 3, office.z + 3] : [cx, H * 0.6];
  place("shop", 5, 4, [oc[0] - 12, oc[1] + 2], 10, 0);
  place("museum", 6, 5, [oc[0] + 13, oc[1] - 4], 12, null);
  place("home", 4, 3, [oc[0] - 4, oc[1] + 12], 12, 0);
  place("camp", 4, 3, [oc[0] + 20, oc[1] + 10], 20, null);
  for (let k = 0; k < 10; k++) place("house", 3, 3, [cx + (R() - 0.5) * W * 0.6, H * 0.35 + R() * H * 0.4], 30, null, 7);
  // The pier: from the south beach straight out to sea.
  {
    let bestPier: [number, number] | null = null;
    let bs = Infinity;
    for (let x = 6; x < W - 6; x++)
      for (let z = H - 4; z > H * 0.55; z--) {
        const i = idx(x, z);
        if (kind[i] !== K.Sand || kind[idx(x, z + 1)] !== K.Sea || kind[idx(x + 1, z)] !== K.Sand || kind[idx(x + 1, z + 1)] !== K.Sea) continue;
        let ok = true;
        for (let k = 1; k <= 6 && ok; k++) for (const dx of [-1, 0, 1, 2]) if (!inside(x + dx, z + k) || kind[idx(x + dx, z + k)] !== K.Sea) ok = false;
        if (!ok) continue;
        const s = Math.abs(x - (oc[0] - 18)) + R() * 6;
        if (s < bs) {
          bs = s;
          bestPier = [x, z];
        }
      }
    if (bestPier) {
      const [px, pz] = bestPier;
      for (let k = 1; k <= 5; k++) for (const dx of [0, 1]) kind[idx(px + dx, pz + k)] = K.Pier;
      plots.push({ kind: "dock", x: px, z: pz + 1, w: 2, d: 5, tier: 0, door: [px, pz] });
    }
  }

  // ---------------------------------------------------------------- nature
  const seeded = new Map<number, Seeded>();
  const fruit = FRUITS[Math.floor(R() * FRUITS.length)];
  const flower = FLOWERS[Math.floor(R() * FLOWERS.length)];
  const onRampOrBridge = (x: number, z: number) =>
    ramps.some((r) => x >= r.x - 1 && x <= r.x + r.w && z >= r.z - 1 && z <= r.z + r.l) || bridges.some((b) => x >= b.x - 1 && x <= b.x + b.w && z >= b.z - 1 && z <= b.z + b.l);
  const free = (x: number, z: number) => {
    const i = idx(x, z);
    return walk(i) && !taken[i] && !seeded.has(i) && !onRampOrBridge(x, z);
  };
  const wd = wetD();
  // Trees by Poisson-ish dart throwing, denser in noisy "woods".
  const trees: [number, number][] = [];
  for (let k = 0; k < 9000; k++) {
    const x = 2 + Math.floor(R() * (W - 4));
    const z = 2 + Math.floor(R() * (H - 4));
    const i = idx(x, z);
    if (!free(x, z) || boundary(i) || wd[i] < 1.5) continue;
    const sand = kind[i] === K.Sand;
    if (sand && (seaDist[i] < 1.5 || R() > 0.25)) continue;
    const wood = N.fbm(x * 0.06 + 11, z * 0.06 + 7, 3) * 0.5 + 0.5;
    if (!sand && R() > wood * 0.9 + 0.08) continue;
    const minD = sand ? 3 : 2.2;
    if (trees.some(([tx, tz]) => (tx - x) ** 2 + (tz - z) ** 2 < minD * minD)) continue;
    trees.push([x, z]);
    const nearPlaza = Math.hypot(x - oc[0], z - oc[1]) < 16;
    const t2 = tier[i] === 2;
    let tree: Seeded;
    if (sand) tree = { t: "tree", kind: "palm", fruit: "coconut" };
    else if (t2 ? R() < 0.7 : R() < 0.08) tree = { t: "tree", kind: "cedar" };
    else if (nearPlaza ? R() < 0.55 : R() < 0.1) tree = { t: "tree", kind: "fruit", fruit };
    else tree = { t: "tree", kind: "hard" };
    seeded.set(i, tree);
    if (trees.length > 260) break;
  }
  // Rocks with room around them.
  for (let k = 0, n = 0; k < 4000 && n < 6; k++) {
    const x = 3 + Math.floor(R() * (W - 6));
    const z = 3 + Math.floor(R() * (H - 6));
    const i = idx(x, z);
    if (kind[i] !== K.Grass || !free(x, z) || edgeD[i] < 2 || wd[i] < 2) continue;
    let room = true;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (!free(x + dx, z + dz) && (dx || dz)) room = false;
    if (!room) continue;
    if ([...seeded].some(([j, s]) => s.t === "rock" && Math.hypot((j % W) - x, ((j / W) | 0) - z) < 12)) continue;
    seeded.set(i, { t: "rock" });
    n++;
  }
  // Native flowers in patches of three colours (red, yellow, white).
  for (let p = 0; p < 9; p++) {
    const x0 = 4 + Math.floor(R() * (W - 8));
    const z0 = 4 + Math.floor(R() * (H - 8));
    if (kind[idx(x0, z0)] !== K.Grass) continue;
    const col = [0, 1, 2][p % 3];
    const n = 3 + Math.floor(R() * 5);
    for (let k = 0; k < n * 3; k++) {
      const x = x0 + Math.floor((R() - 0.5) * 5);
      const z = z0 + Math.floor((R() - 0.5) * 5);
      if (!inside(x, z) || kind[idx(x, z)] !== K.Grass || !free(x, z)) continue;
      seeded.set(idx(x, z), { t: "flower", sp: flower, col });
    }
  }
  for (let k = 0; k < 170; k++) {
    const x = 2 + Math.floor(R() * (W - 4));
    const z = 2 + Math.floor(R() * (H - 4));
    if (kind[idx(x, z)] === K.Grass && free(x, z)) seeded.set(idx(x, z), { t: "weed", v: Math.floor(R() * 3) });
  }
  for (let k = 0; k < 14; k++) {
    for (let a = 0; a < 50; a++) {
      const x = 2 + Math.floor(R() * (W - 4));
      const z = 2 + Math.floor(R() * (H - 4));
      if (kind[idx(x, z)] === K.Sand && free(x, z) && seaDist[idx(x, z)] < 3) {
        seeded.set(idx(x, z), { t: "shell", v: Math.floor(R() * 6) });
        break;
      }
    }
  }

  const name = NAME_A[Math.floor(R() * NAME_A.length)] + NAME_B[Math.floor(R() * NAME_B.length)];
  return { seed, kind, tier, seaDist, ramps, bridges, falls: fallsOk, plots, fruit, flower, seeded, name };
}

/** Surface height of a tile's walking level (ramps interpolate). */
export function rampAt(I: Island, x: number, z: number): { r: Ramp; t: number } | null {
  const tx = Math.floor(x);
  const tz = Math.floor(z);
  for (const r of I.ramps) {
    if (tx < r.x || tz < r.z || tx >= r.x + r.w || tz >= r.z + r.l) continue;
    // Progress 0 at the bottom edge to 1 at the top edge.
    let t: number;
    if (r.dir === 0) t = (x - r.x) / r.w;
    else if (r.dir === 2) t = 1 - (x - r.x) / r.w;
    else if (r.dir === 1) t = (z - r.z) / r.l;
    else t = 1 - (z - r.z) / r.l;
    return { r, t: Math.max(0, Math.min(1, t)) };
  }
  return null;
}

export function bridgeAt(I: Island, x: number, z: number): Bridge | null {
  const tx = Math.floor(x);
  const tz = Math.floor(z);
  return I.bridges.find((b) => tx >= b.x && tz >= b.z && tx < b.x + b.w && tz < b.z + b.l) ?? null;
}
