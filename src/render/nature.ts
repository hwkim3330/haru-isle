/**
 * Models for the island's nature: four kinds of tree at five stages, fruit, rocks, eight
 * flowers in eight colours, weeds, shells, holes, dig marks, stumps. Each model is a base
 * geometry plus an optional "leaf" geometry that the season tints.
 */
import * as THREE from "three";
import { at, ball, blob, box, cone, cyl, lathe, merge, petal, type Part } from "./geo";
import type { Flower } from "../world/island";

export interface Model {
  base: THREE.BufferGeometry;
  leaf?: THREE.BufferGeometry;
}

export const FLOWER_COLORS = [0xe8404a, 0xf8d040, 0xf8f4ee, 0xf890b0, 0xf89040, 0x9a5ad0, 0x5a8ae8, 0x3a2a3a] as const;
export const COLOR_NAMES = ["빨강", "노랑", "하양", "분홍", "주황", "보라", "파랑", "검정"];

export const FRUIT_COLORS: Record<string, number> = { apple: 0xe0383a, orange: 0xf8902a, pear: 0xd8d050, peach: 0xf8a8a0, persimmon: 0xf07020, coconut: 0x8a5a30 };

const TRUNK = 0x9a6a44;
const TRUNK_D = 0x7a5034;

function fruitGeo(kind: string): Part {
  const c = FRUIT_COLORS[kind] ?? 0xe0383a;
  if (kind === "pear") return merge([at(lathe([[0.001, -0.07], [0.06, -0.05], [0.07, 0.0], [0.045, 0.05], [0.03, 0.08], [0.001, 0.09]], c, 10), [0, 0, 0]), at(cyl(0.006, 0.006, 0.04, 0x5a3a20, 4), [0, 0.1, 0])]);
  if (kind === "coconut") return ball(0.09, c, 10, 8);
  if (kind === "persimmon") return merge([at(ball(0.08, c, 10, 8), [0, 0, 0], [0, 0, 0], [1, 0.8, 1]), at(cyl(0.05, 0.05, 0.015, 0x4a7a2a, 4), [0, 0.065, 0])]);
  return merge([at(ball(0.075, c, 10, 8), [0, 0, 0], [0, 0, 0], [1, 0.9, 1]), at(cyl(0.005, 0.005, 0.05, 0x5a3a20, 4), [0, 0.08, 0]), at(petal(0.05, 0.022, 0x5aa040, 0.2), [0, 0.09, 0], [0, 0.6, 0])]);
}

/** The fruit on its own (lying on the ground, in the hand, as an icon). */
export function fruitModel(kind: string): Model {
  return { base: fruitGeo(kind) };
}

// ------------------------------------------------------------------ trees

export type TreeKind = "hard" | "cedar" | "palm" | "fruit";

/**
 * A tree at a stage: 0 sapling, 1 small, 2 medium, 3 grown (4 = grown with fruit).
 * The seed varies the lumps so neighbours don't look stamped.
 */
export function treeModel(kind: TreeKind, stage: number, fruit: string | null, seed = 1): Model {
  const base: Part[] = [];
  const leaf: Part[] = [];
  const s = [0.28, 0.5, 0.75, 1, 1][stage];
  if (kind === "palm") {
    const n = 6;
    const H = 2.3 * s + 0.2;
    let px = 0;
    let py = 0;
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const lean = Math.sin(t * 1.3) * 0.25 * s;
      base.push(at(cyl(0.11 - t * 0.03, 0.12 - t * 0.03, H / n + 0.02, k % 2 ? TRUNK : 0xb08050, 8), [lean, py + H / n / 2, 0], [0, 0, -lean * 0.6]));
      px = lean;
      py += H / n;
    }
    const top: [number, number, number] = [px, py, 0];
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + seed;
      const f = petal(1.2 * s + 0.2, 0.28 * s + 0.05, k % 2 ? 0x4aa84a : 0x3a9440, -0.6);
      leaf.push(at(f, top, [-0.35 - (k % 2) * 0.25, a, 0]));
    }
    if (stage >= 4) for (let k = 0; k < 3; k++) base.push(at(fruitGeo("coconut"), [top[0] + Math.cos(k * 2.1) * 0.12, top[1] - 0.12, Math.sin(k * 2.1) * 0.12]));
    return { base: merge(base), leaf: merge(leaf) };
  }
  if (kind === "cedar") {
    const H = 1.2 * s;
    base.push(at(cyl(0.08 * s + 0.03, 0.13 * s + 0.03, H, TRUNK_D, 8), [0, H / 2, 0]));
    for (let k = 0; k < 4; k++) {
      const r = (0.95 - k * 0.2) * s + 0.08;
      const y = H * 0.55 + k * 0.62 * s;
      leaf.push(at(blobCone(r, 0.95 * s + 0.1, k % 2 ? 0x2e8a4e : 0x3a9a58, seed + k), [0, y, 0]));
    }
    return { base: merge(base), leaf: merge(leaf) };
  }
  // Hardwood and fruit trees: a round crown of lumps over a short trunk.
  const H = 1.0 * s + 0.1;
  base.push(at(cyl(0.1 * s + 0.03, 0.16 * s + 0.04, H, TRUNK, 8), [0, H / 2, 0]));
  if (stage >= 2) {
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + seed;
      base.push(at(cyl(0.03, 0.05, 0.4 * s, TRUNK, 5), [Math.cos(a) * 0.12 * s, H * 0.85, Math.sin(a) * 0.12 * s], [Math.sin(a) * 0.7, 0, Math.cos(a) * -0.7]));
    }
  }
  const R = 0.95 * s + 0.1;
  const cy = H + R * 0.62;
  const tones = kind === "fruit" ? [0x5ab84a, 0x4aa844] : [0x58b04a, 0x48a042];
  leaf.push(at(blob(R, tones[0], 0.1, seed, 2), [0, cy, 0], [0, 0, 0], [1, 0.82, 1]));
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + seed;
    leaf.push(at(blob(R * 0.55, tones[k % 2], 0.12, seed + k, 2), [Math.cos(a) * R * 0.6, cy + (k % 2 ? 0.15 : -0.1) * s, Math.sin(a) * R * 0.6]));
  }
  leaf.push(at(blob(R * 0.6, tones[1], 0.12, seed + 9, 2), [0, cy + R * 0.55, 0]));
  if (stage >= 4 && fruit) {
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.5;
      base.push(at(fruitGeo(fruit), [Math.cos(a) * R * 0.78, cy - R * 0.15, Math.sin(a) * R * 0.78 + 0.1], [0, 0, 0], 1.4));
    }
  }
  return { base: merge(base), leaf: merge(leaf) };
}

function blobCone(r: number, h: number, c: number, seed: number): Part {
  const g = cone(r, h, c, 12);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const a = Math.atan2(z, x);
    const k = 1 + Math.sin(a * 6 + seed) * 0.08;
    p.setXYZ(i, x * k, p.getY(i), z * k);
  }
  g.computeVertexNormals();
  return g;
}

export function stumpModel(): Model {
  return { base: merge([at(cyl(0.2, 0.26, 0.28, TRUNK, 10), [0, 0.14, 0]), at(cyl(0.17, 0.17, 0.02, 0xd8b080, 10), [0, 0.285, 0])]) };
}

// ------------------------------------------------------------------ rocks, weeds, shells, holes

export function rockModel(seed = 3): Model {
  return { base: merge([at(blob(0.48, 0x9a9a9e, 0.16, seed, 1, 0.12), [0, 0.32, 0], [0, 0, 0], [1.1, 0.75, 1]), at(blob(0.25, 0x8a8a90, 0.2, seed + 2, 1, 0.1), [0.3, 0.14, 0.18])]) };
}

export function shoreRockModel(seed = 3): Model {
  return { base: merge([at(blob(0.55, 0x8e8e94, 0.2, seed, 1, 0.14), [0, 0.1, 0], [0, seed, 0], [1, 0.6, 0.9])]) };
}

export function weedModel(v: number): Model {
  const parts: Part[] = [];
  const c = [0x5aa040, 0x6ab048, 0x4a9038][v % 3];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + v;
    parts.push(at(cone(0.04, 0.26 + (k % 3) * 0.06, c, 4), [Math.cos(a) * 0.06, 0.12, Math.sin(a) * 0.06], [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5]));
  }
  if (v === 2) parts.push(at(ball(0.035, 0xf8f0a0, 6, 4), [0, 0.3, 0]));
  return { leaf: merge(parts), base: at(ball(0.05, c, 6, 4), [0, 0.02, 0]) };
}

export const SHELLS = ["가리비", "소라", "개오지", "모래달러", "산호", "대왕조개"];
export function shellModel(v: number): Model {
  switch (v % 6) {
    case 0: {
      const parts: Part[] = [];
      for (let k = 0; k < 7; k++) parts.push(at(petal(0.16, 0.035, 0xf8c8a0, 0.6), [0, 0.02, -0.06], [0, (k - 3) * 0.2, 0]));
      return { base: merge(parts) };
    }
    case 1:
      return { base: merge([at(cone(0.07, 0.2, 0xf0e0c8, 8), [0, 0.07, 0], [0, 0, Math.PI / 2]), at(torus(0.05, 0.02, 0xe8b890, 10), [-0.05, 0.07, 0], [0, Math.PI / 2, 0])]) };
    case 2:
      return { base: at(ball(0.08, 0xd8a870, 10, 8), [0, 0.04, 0], [0, 0, 0], [1, 0.55, 0.7]) };
    case 3:
      return { base: merge([at(cyl(0.1, 0.1, 0.02, 0xe8e0d0, 14), [0, 0.01, 0]), at(ball(0.02, 0xd0c8b8, 6, 4), [0, 0.02, 0])]) };
    case 4: {
      const parts: Part[] = [];
      for (let k = 0; k < 5; k++) parts.push(at(cyl(0.012, 0.018, 0.16, 0xf87070, 5), [Math.cos(k) * 0.04, 0.08, Math.sin(k) * 0.04], [Math.sin(k) * 0.5, 0, Math.cos(k) * 0.5]));
      return { base: merge(parts) };
    }
    default:
      return { base: merge([at(ball(0.13, 0xe8e0e8, 12, 6), [0, 0.03, 0], [0, 0, 0], [1, 0.4, 0.8]), at(ball(0.12, 0xc8a8d8, 12, 6), [0, 0.07, 0], [0, 0, 0], [1, 0.3, 0.8])]) };
  }
}

function torus(r: number, t: number, c: number, seg: number): Part {
  const g = new THREE.TorusGeometry(r, t, 6, seg);
  return lathePaint(g, c);
}
function lathePaint(g: THREE.BufferGeometry, c: number): Part {
  const out = g.toNonIndexed();
  out.deleteAttribute("uv");
  const n = out.attributes.position.count;
  const col = new Float32Array(n * 3);
  const cc = new THREE.Color(c);
  for (let i = 0; i < n; i++) col.set([cc.r, cc.g, cc.b], i * 3);
  out.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return out;
}

export function holeModel(): Model {
  return { base: merge([at(cyl(0.34, 0.3, 0.02, 0x3a2a1c, 16), [0, 0.012, 0]), at(torusFlat(0.4, 0.07, 0x8a6a48), [0, 0.03, 0])]) };
}
function torusFlat(r: number, t: number, c: number): Part {
  const g = new THREE.TorusGeometry(r, t, 5, 18);
  g.rotateX(Math.PI / 2);
  g.scale(1, 1, 0.5);
  return lathePaint(g, c);
}

/** The crack of a buried thing (fossils, gyroids of our own). */
export function digMarkModel(): Model {
  const parts: Part[] = [];
  for (let k = 0; k < 4; k++) parts.push(at(box(0.36, 0.01, 0.05, 0x6a4a30), [0, 0.012, 0], [0, (k * Math.PI) / 4, 0]));
  return { base: merge(parts) };
}

/** Anything lying on the ground that has no model of its own: a leaf-wrapped bundle. */
export function bundleModel(c = 0x8ad060): Model {
  return { base: merge([at(petal(0.34, 0.16, c, 0.5), [0, 0.03, -0.17]), at(cyl(0.012, 0.012, 0.1, 0x6a4a2a, 4), [0, 0.06, -0.17], [0.6, 0, 0])]) };
}

// ------------------------------------------------------------------ flowers

/** A flower of a species and colour; stage 0 = sprout, 1 = bud, 2 = bloom. */
export function flowerModel(sp: Flower, col: number, stage = 2): Model {
  const c = FLOWER_COLORS[col % FLOWER_COLORS.length];
  const stem: Part[] = [];
  const head: Part[] = [];
  const leafC = 0x4a9a3a;
  const h = sp === "pansy" ? 0.16 : sp === "cosmos" ? 0.46 : sp === "lily" ? 0.42 : sp === "hyacinth" ? 0.28 : 0.34;
  const hs = stage === 0 ? 0.35 : stage === 1 ? 0.75 : 1;
  stem.push(at(cyl(0.012, 0.016, h * hs, 0x5aa040, 5), [0, (h * hs) / 2, 0]));
  for (let k = 0; k < (sp === "tulip" ? 2 : 3); k++) stem.push(at(petal(sp === "tulip" ? 0.22 : 0.13, 0.05, leafC, 0.4), [0, 0.02, 0], [-0.9, k * 2.2 + 0.3, 0]));
  if (stage === 0) return { base: merge(stem) };
  const top: [number, number, number] = [0, h * hs, 0];
  if (stage === 1) {
    head.push(at(ball(0.04, c, 8, 6), top, [0, 0, 0], [1, 1.4, 1]));
    return { base: merge([...stem, ...head]) };
  }
  const ring = (n: number, len: number, wid: number, tilt: number, cup: number, y = 0, cc = c, twist = 0) => {
    for (let k = 0; k < n; k++) head.push(at(petal(len, wid, cc, cup), [top[0], top[1] + y, top[2]], [tilt, (k / n) * Math.PI * 2 + twist, 0]));
  };
  switch (sp) {
    case "tulip":
      ring(6, 0.12, 0.045, -1.25, 0.5);
      break;
    case "rose":
      ring(5, 0.08, 0.05, -0.5, 0.8);
      ring(5, 0.065, 0.04, -1.0, 0.8, 0.01, c, 0.6);
      head.push(at(ball(0.035, c, 8, 6), [0, top[1] + 0.03, 0]));
      break;
    case "cosmos":
      ring(8, 0.09, 0.03, -0.25, 0.1);
      head.push(at(ball(0.025, 0xf8c030, 8, 6), [0, top[1] + 0.01, 0], [0, 0, 0], [1, 0.5, 1]));
      break;
    case "lily":
      ring(6, 0.14, 0.035, -0.55, -0.3);
      for (let k = 0; k < 3; k++) head.push(at(cyl(0.004, 0.004, 0.08, 0xf8d040, 3), [Math.cos(k * 2) * 0.01, top[1] + 0.05, Math.sin(k * 2) * 0.01]));
      break;
    case "pansy":
      ring(5, 0.08, 0.055, -0.2, 0.1);
      head.push(at(ball(0.018, 0x3a2a40, 6, 4), [0, top[1] + 0.01, 0]));
      break;
    case "mum":
      head.push(at(blob(0.08, c, 0.14, col + 3, 2, 0.06), [0, top[1] + 0.04, 0]));
      break;
    case "hyacinth":
      for (let k = 0; k < 14; k++) head.push(at(ball(0.026, c, 6, 4), [Math.cos(k * 1.9) * 0.035, top[1] + (k / 14) * 0.16, Math.sin(k * 1.9) * 0.035]));
      break;
    case "poppy":
      ring(4, 0.1, 0.07, -0.7, 0.6);
      head.push(at(ball(0.022, 0x2a2a2a, 6, 4), [0, top[1] + 0.02, 0]));
      break;
  }
  return { base: merge([...stem, ...head]) };
}
