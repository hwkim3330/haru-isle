/**
 * Buildings, bridges and the pier, built from the modelling kit. Houses face south (+z) with
 * the door on the front middle tile; windows glow after dark.
 */
import * as THREE from "three";
import { at, ball, box, cone, cyl, merge, rbox, slab, type Part } from "./geo";
import { mat } from "./stage";
import type { Bridge, Plot } from "../world/island";
import { TIER_H } from "../world/island";

export const WIN_MAT = new THREE.MeshBasicMaterial({ color: 0xfff0b0 });
const baseMat = mat(0xffffff, { vertexColors: true });

/** Night glow for windows (0 day … 1 night). */
export function setNight(n: number): void {
  WIN_MAT.color.setRGB(0.55 + 0.45 * n, 0.62 + 0.3 * n, 0.7 - 0.2 * n);
}

function gable(w: number, d: number, h: number, c: number, over = 0.18): Part {
  const pts: [number, number][] = [
    [-w / 2 - over, 0],
    [w / 2 + over, 0],
    [0, h],
  ];
  return slab(pts, d + over * 2, c, 0.03);
}

function windowParts(x: number, y: number, z: number, w = 0.42, h = 0.42): { frame: Part[]; glass: Part[] } {
  return {
    frame: [at(box(w + 0.1, h + 0.1, 0.06, 0xfff8ee), [x, y, z]), at(box(0.04, h, 0.07, 0xfff8ee), [x, y, z + 0.01]), at(box(w, 0.04, 0.07, 0xfff8ee), [x, y, z + 0.01])],
    glass: [at(box(w, h, 0.07, 0xffffff), [x, y, z - 0.005])],
  };
}

export interface HouseColors {
  wall: number;
  roof: number;
  door: number;
  trim?: number;
}

function assemble(parts: Part[], glass: Part[]): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.Mesh(merge(parts), baseMat);
  m.castShadow = m.receiveShadow = true;
  g.add(m);
  if (glass.length) {
    const w = new THREE.Mesh(merge(glass), WIN_MAT);
    g.add(w);
  }
  g.traverse((o) => (o.frustumCulled = false));
  return g;
}

/** A neighbour's house on a 3×3 plot. */
export function houseModel(c: HouseColors, style = 0): THREE.Group {
  const P: Part[] = [];
  const G: Part[] = [];
  const W = 2.5;
  const D = 2.2;
  const Hh = 1.55;
  P.push(at(box(W + 0.12, 0.18, D + 0.12, 0xd8d0c0), [0, 0.09, 0]));
  P.push(at(rbox(W, Hh, D, 0.06, c.wall), [0, 0.18 + Hh / 2, 0]));
  if (style % 3 === 0) P.push(at(gable(W, D, 1.0, c.roof), [0, 0.18 + Hh, 0]));
  else if (style % 3 === 1) {
    P.push(at(cone(W * 0.95, 1.1, c.roof, 4), [0, 0.18 + Hh + 0.55, 0], [0, Math.PI / 4, 0], [1, 1, D / W]));
  } else {
    P.push(at(rbox(W + 0.35, 0.28, D + 0.35, 0.1, c.roof), [0, 0.18 + Hh + 0.14, 0]));
    P.push(at(rbox(W * 0.6, 0.35, D * 0.6, 0.12, c.roof), [0, 0.18 + Hh + 0.45, 0]));
  }
  P.push(at(box(0.3, 0.7, 0.3, c.trim ?? 0xb0a090), [W * 0.28, 0.18 + Hh + 0.6, -D * 0.2]));
  // Door, step, windows, mailbox.
  const fz = D / 2 + 0.01;
  P.push(at(rbox(0.62, 1.05, 0.08, 0.03, c.door), [0, 0.18 + 0.52, fz]));
  P.push(at(ball(0.035, 0xe8c050, 6, 4), [0.2, 0.18 + 0.5, fz + 0.05]));
  P.push(at(box(0.9, 0.08, 0.35, 0xc8c0b0), [0, 0.04, fz + 0.2]));
  for (const x of [-0.85, 0.85]) {
    const w = windowParts(x, 0.18 + 0.95, fz);
    P.push(...w.frame);
    G.push(...w.glass);
  }
  P.push(at(cyl(0.035, 0.035, 0.75, 0x7a5a3a, 6), [1.25, 0.37, fz + 0.5]));
  P.push(at(rbox(0.3, 0.22, 0.38, 0.05, c.roof), [1.25, 0.8, fz + 0.5]));
  return assemble(P, G);
}

/** The player's home on a 4×3 plot: a little cottage with a porch lamp. */
export function homeModel(): THREE.Group {
  const g = houseModel({ wall: 0xf8f0e0, roof: 0x4a8ad8, door: 0x8a5a3a, trim: 0xd0c8b8 }, 0);
  g.scale.set(1.2, 1.1, 1.05);
  return g;
}

/** The shop: striped awning over a wide window, a sign with an acorn. */
export function shopModel(): THREE.Group {
  const P: Part[] = [];
  const G: Part[] = [];
  const W = 4.4;
  const D = 3.2;
  const Hh = 2.0;
  P.push(at(box(W + 0.15, 0.2, D + 0.15, 0xd8d0c0), [0, 0.1, 0]));
  P.push(at(rbox(W, Hh, D, 0.08, 0xf4e6c8), [0, 0.2 + Hh / 2, 0]));
  P.push(at(rbox(W + 0.4, 0.3, D + 0.4, 0.1, 0x6a9a4a), [0, 0.2 + Hh + 0.15, 0]));
  const fz = D / 2 + 0.02;
  for (let k = 0; k < 9; k++) P.push(at(box(W / 9, 0.06, 0.8, k % 2 ? 0xffffff : 0x4aa060), [-W / 2 + (k + 0.5) * (W / 9), 0.2 + Hh - 0.25, fz + 0.35], [0.45, 0, 0]));
  P.push(at(rbox(0.9, 1.3, 0.08, 0.03, 0x8a5a3a), [0, 0.2 + 0.65, fz]));
  for (const x of [-1.4, 1.4]) {
    const w = windowParts(x, 0.2 + 0.9, fz, 1.0, 0.8);
    P.push(...w.frame);
    G.push(...w.glass);
  }
  // Acorn sign.
  P.push(at(rbox(1.3, 0.6, 0.1, 0.05, 0xfff8e8), [0, 0.2 + Hh + 0.62, fz - 0.2]));
  P.push(at(ball(0.18, 0xb07038, 10, 8), [0, 0.2 + Hh + 0.58, fz - 0.12], [0, 0, 0], [0.9, 1.05, 0.5]));
  P.push(at(ball(0.2, 0x6a4a2a, 10, 6), [0, 0.2 + Hh + 0.72, fz - 0.12], [0, 0, 0], [1, 0.5, 0.5]));
  return assemble(P, G);
}

/** The museum: pale stone, columns, a round window, a dome. */
export function museumModel(): THREE.Group {
  const P: Part[] = [];
  const G: Part[] = [];
  const W = 5.4;
  const D = 4.2;
  const Hh = 2.3;
  P.push(at(box(W + 0.4, 0.3, D + 0.4, 0xd8d4cc), [0, 0.15, 0]));
  P.push(at(rbox(W, Hh, D, 0.05, 0xe8e2d8), [0, 0.3 + Hh / 2, 0]));
  P.push(at(ball(1.7, 0x6a8aa8, 16, 10), [0, 0.3 + Hh, -0.2], [0, 0, 0], [1, 0.75, 1]));
  P.push(at(gable(W + 0.2, 1.1, 0.8, 0xd8d2c8, 0.05), [0, 0.3 + Hh, D / 2 - 0.3]));
  const fz = D / 2 + 0.02;
  for (const x of [-2.2, -1.2, 1.2, 2.2]) P.push(at(cyl(0.16, 0.18, Hh, 0xf4f0e8, 10), [x, 0.3 + Hh / 2, fz + 0.3]));
  for (let k = 0; k < 3; k++) P.push(at(box(2.2 - k * 0.2, 0.1, 0.35, 0xd8d4cc), [0, 0.05 + k * 0.1, fz + 0.9 - k * 0.3]));
  P.push(at(rbox(1.0, 1.6, 0.08, 0.04, 0x5a3a2a), [0, 0.3 + 0.8, fz]));
  const r = new THREE.CircleGeometry(0.35, 16);
  const rw = at(r, [0, 0.3 + Hh + 0.4, fz + 0.28]);
  rw.deleteAttribute("uv");
  G.push(rw.toNonIndexed());
  return assemble(P, G.map((g) => ensureColor(g)));
}

function ensureColor(g: THREE.BufferGeometry): THREE.BufferGeometry {
  if (!g.attributes.color) {
    const n = g.attributes.position.count;
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}

/** The island office: a wide hall with a flag, the plaza stones in front. */
export function officeModel(): THREE.Group {
  const P: Part[] = [];
  const G: Part[] = [];
  const W = 5.6;
  const D = 3.0;
  const Hh = 2.0;
  P.push(at(box(W + 0.3, 0.22, D + 0.3, 0xd8d0c0), [0, 0.11, -0.8]));
  P.push(at(rbox(W, Hh, D, 0.08, 0xf0f4f8), [0, 0.22 + Hh / 2, -0.8]));
  P.push(at(gable(W, D, 1.2, 0x3a9a6a), [0, 0.22 + Hh, -0.8]));
  const fz = -0.8 + D / 2 + 0.02;
  P.push(at(rbox(1.2, 1.4, 0.08, 0.04, 0x9ad0e8), [0, 0.22 + 0.7, fz]));
  for (const x of [-1.9, 1.9]) {
    const w = windowParts(x, 0.22 + 1.1, fz, 0.8, 0.6);
    P.push(...w.frame);
    G.push(...w.glass);
  }
  // Flagpole.
  P.push(at(cyl(0.05, 0.06, 4.2, 0xd8d8d8, 8), [-3.4, 2.1, 1.2]));
  P.push(at(box(0.9, 0.55, 0.03, 0xf8f8f8), [-2.9, 3.8, 1.2]));
  P.push(at(ball(0.16, 0x3aa070, 10, 6), [-2.9, 3.8, 1.23], [0, 0, 0], [1, 1, 0.2]));
  // Plaza.
  for (let k = 0; k < 7; k++) P.push(at(cyl(1.6 - k * 0.2, 1.6 - k * 0.2, 0.03, k % 2 ? 0xd8ccb4 : 0xe8dcc4, 20), [0, 0.015 + k * 0.001, 1.6]));
  return assemble(P, G);
}

/** The campsite: a tent, a fire ring and a log. */
export function campModel(): THREE.Group {
  const P: Part[] = [];
  P.push(at(cone(1.4, 1.9, 0xe8a040, 4), [0, 0.95, -0.3], [0, Math.PI / 4, 0]));
  P.push(at(cone(0.5, 1.0, 0x5a3a2a, 4), [0, 0.5, 0.45], [0, Math.PI / 4, 0], [0.8, 1, 0.3]));
  for (let k = 0; k < 7; k++) P.push(at(ball(0.1, 0x8a8a8a, 6, 4), [1.4 + Math.cos(k) * 0.35, 0.06, 0.8 + Math.sin(k) * 0.35]));
  P.push(at(cone(0.18, 0.4, 0xffa030, 6), [1.4, 0.2, 0.8]));
  P.push(at(cyl(0.14, 0.14, 1.2, 0x8a5a3a, 8), [-1.3, 0.14, 1.0], [0, 0, Math.PI / 2]));
  return assemble(P, []);
}

/** The pier out to sea and the ferry that brings visitors. */
export function dockModel(len: number): THREE.Group {
  const P: Part[] = [];
  for (let k = 0; k < len * 3; k++) P.push(at(box(2.0, 0.08, 0.3, k % 2 ? 0xb08a60 : 0xa07a50), [1, 0.08, k * 0.333 + 0.16]));
  for (let k = 0; k <= len; k += 2) for (const x of [0.05, 1.95]) P.push(at(cyl(0.07, 0.07, 1.0, 0x7a5a3a, 6), [x, -0.3, k]));
  // The ferry: a round little boat with an awning.
  const bz = len + 1.1;
  P.push(at(ball(1.0, 0xf8f4ec, 16, 8), [2.6, -0.25, bz], [0, 0, 0], [1.0, 0.45, 1.6]));
  P.push(at(rbox(1.6, 0.14, 2.6, 0.06, 0x3a7ac8), [2.6, 0.1, bz]));
  for (const [x, z] of [
    [2.0, bz - 0.8],
    [3.2, bz - 0.8],
    [2.0, bz + 0.8],
    [3.2, bz + 0.8],
  ])
    P.push(at(cyl(0.04, 0.04, 1.1, 0xf8f8f8, 6), [x, 0.65, z]));
  P.push(at(rbox(1.5, 0.08, 1.9, 0.04, 0xe84a4a), [2.6, 1.2, bz]));
  return assemble(P, []);
}

export function plotModel(p: Plot, colors?: HouseColors, style = 0): THREE.Group {
  switch (p.kind) {
    case "house":
      return houseModel(colors ?? { wall: 0xf0e8d8, roof: 0xd86a4a, door: 0x7a5a3a }, style);
    case "home":
      return homeModel();
    case "shop":
      return shopModel();
    case "museum":
      return museumModel();
    case "office":
      return officeModel();
    case "camp":
      return campModel();
    case "dock":
      return dockModel(p.d);
  }
}

export function bridgeModel(b: Bridge): THREE.Group {
  const P: Part[] = [];
  const along = b.axis === 0 ? b.w : b.l;
  const across = b.axis === 0 ? b.l : b.w;
  const len = along + 0.8;
  for (let k = 0; k < Math.round(len * 3); k++) P.push(at(box(across + 0.1, 0.08, 0.3, k % 2 ? 0xc09060 : 0xb08050), [0, 0, -len / 2 + (k + 0.5) / 3]));
  for (const s of [-1, 1]) {
    P.push(at(box(0.08, 0.08, len, 0x8a6040), [s * (across / 2), 0.5, 0]));
    for (let k = 0; k <= Math.round(len); k++) P.push(at(cyl(0.05, 0.05, 0.5, 0x8a6040, 6), [s * (across / 2), 0.25, -len / 2 + k * (len / Math.round(len))]));
  }
  const g = assemble(P, []);
  g.position.set(b.x + b.w / 2, b.tier * TIER_H + 0.02, b.z + b.l / 2);
  g.rotation.y = b.axis === 0 ? Math.PI / 2 : 0;
  return g;
}
