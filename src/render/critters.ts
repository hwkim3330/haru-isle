/**
 * Fish and bug models, procedural by kind: a fish body sized by its shadow with colours from
 * a small table, and bugs by body plan (butterfly, beetle, dragonfly, cicada, hopper, bee,
 * spider, snail, crab, …).
 */
import * as THREE from "three";
import type { Critter } from "../data/critters";
import { at, ball, box, cone, cyl, merge, petal, type Part } from "./geo";

const FISH_COL: Record<string, [number, number]> = {
  koi: [0xf8f4f0, 0xe84a3a],
  goldfish: [0xf8903a, 0xf8d050],
  clownfish: [0xf8803a, 0xffffff],
  "sea-bream": [0xf8908a, 0xf8d0c0],
  salmon: [0xa8b0c0, 0xf8a090],
  tuna: [0x3a4a7a, 0xc8d0e0],
  marlin: [0x3a5aa8, 0xc8d8f0],
  shark: [0x7a8a9a, 0xe8ecf0],
  "whale-shark": [0x4a5a7a, 0xf0f0f8],
  arowana: [0xe8c050, 0xf8f0c0],
  piranha: [0x8a8a9a, 0xe84a4a],
  puffer: [0xe8d8a0, 0x8a7a5a],
  octopus: [0xe86a5a, 0xf8b0a0],
  squid: [0xf8e8e0, 0xf0a0a0],
  seahorse: [0xf8b050, 0xf8d890],
  jellyfish: [0xe0e8ff, 0xf8c8e0],
  sunfish: [0x9aa0b0, 0xe8e8f0],
  manta: [0x3a4a5a, 0xf0f0f0],
  bluegill: [0x6a8a7a, 0x3a5aa8],
  frog: [0x6ab048, 0xe8f0b0],
  tadpole: [0x3a3a3a, 0x5a5a5a],
  crawfish: [0xd84a3a, 0xe87a5a],
  softshell: [0x7a7a4a, 0xa8a870],
  coelacanth: [0x3a4a6a, 0xa8b0c8],
};

export function fishModel(c: Critter): THREE.BufferGeometry {
  const s = 0.14 + (c.size ?? 2) * 0.07;
  const [a, b] = FISH_COL[c.id] ?? [0x8a9ab0, 0xe8ecf0];
  const P: Part[] = [];
  if (c.id === "octopus" || c.id === "squid") {
    P.push(at(ball(s * 0.7, a, 12, 8), [0, s * 0.5, 0], [0, 0, 0], [1, c.id === "squid" ? 1.8 : 1.2, 1]));
    for (let k = 0; k < 8; k++) P.push(at(cyl(0.02, 0.035, s * 1.1, b, 5), [Math.cos(k * 0.8) * s * 0.35, -s * 0.2, Math.sin(k * 0.8) * s * 0.35], [Math.sin(k * 0.8) * 0.5, 0, -Math.cos(k * 0.8) * 0.5]));
    return merge(P);
  }
  if (c.id === "jellyfish") return merge([at(ball(s, a, 12, 8), [0, 0, 0], [0, 0, 0], [1, 0.6, 1]), ...[0, 1, 2, 3].map((k) => at(cyl(0.01, 0.01, s * 1.5, b, 4), [Math.cos(k * 1.6) * s * 0.4, -s * 0.8, Math.sin(k * 1.6) * s * 0.4]))]);
  if (c.id === "crawfish") return merge([at(ball(s * 0.5, a, 10, 8), [0, 0, 0], [0, 0, 0], [0.8, 0.6, 2]), ...[-1, 1].map((k) => at(ball(s * 0.25, a, 8, 6), [k * s * 0.35, 0, s * 0.9], [0, 0, 0], [0.8, 0.5, 1.4]))]);
  if (c.id === "frog") return merge([at(ball(s * 0.6, a, 10, 8), [0, 0, 0], [0, 0, 0], [1, 0.7, 1.1]), ...[-1, 1].map((k) => at(ball(s * 0.18, b, 6, 4), [k * s * 0.3, s * 0.35, s * 0.3]))]);
  if (c.id === "softshell") return merge([at(ball(s * 0.7, a, 12, 6), [0, 0, 0], [0, 0, 0], [1, 0.35, 1.2]), at(ball(s * 0.2, b, 8, 6), [0, 0, s * 0.9])]);
  if (c.id === "seahorse") return merge([at(ball(s * 0.3, a, 8, 6), [0, s * 0.5, 0], [0, 0, 0], [1, 1.3, 1]), at(ball(s * 0.35, a, 8, 6), [0, 0, 0], [0, 0, 0], [0.8, 1.4, 1]), at(cone(s * 0.1, s * 0.4, b, 6), [0, -s * 0.6, -s * 0.1], [Math.PI, 0, 0])]);
  if (c.id === "manta") return merge([at(ball(s, a, 12, 6), [0, 0, 0], [0, 0, 0], [1.6, 0.18, 1]), at(cyl(0.01, 0.02, s * 1.4, a, 4), [0, 0, -s * 1.2], [Math.PI / 2, 0, 0])]);
  // A fish: body, tail, fins, eye.
  const long = c.id === "eel" || c.id === "gar" || c.id === "loach" || c.id === "arowana" ? 2.2 : c.id === "sunfish" || c.id === "puffer" ? 0.8 : 1.3;
  const tall = c.id === "sunfish" ? 1.3 : c.id === "puffer" ? 1 : 0.7;
  P.push(at(ball(s * 0.5, a, 14, 10), [0, 0, 0], [0, 0, 0], [0.55, tall, long]));
  P.push(at(ball(s * 0.42, b, 12, 8), [0, -s * 0.08, s * 0.05], [0, 0, 0], [0.5, tall * 0.7, long * 0.9]));
  P.push(at(petal(s * 0.5, s * 0.3, a, 0), [0, 0, -s * 0.5 * long], [Math.PI / 2, Math.PI, 0], [1, 1, 1]));
  P.push(at(petal(s * 0.35, s * 0.15, a, 0), [0, s * 0.3 * tall, 0], [Math.PI / 2 + 0.6, Math.PI, 0]));
  for (const k of [-1, 1]) P.push(at(ball(s * 0.07, 0x1a1a1a, 6, 4), [k * s * 0.24, s * 0.08, s * 0.4 * long]));
  if (c.id === "marlin") P.push(at(cone(0.03, s * 0.9, a, 5), [0, 0, s * long * 0.9], [Math.PI / 2, 0, 0]));
  if (c.id === "shark" || c.id === "whale-shark") P.push(at(petal(s * 0.5, s * 0.3, a, 0), [0, s * 0.4, 0], [Math.PI / 2 + 0.3, Math.PI, 0]));
  return merge(P);
}

export function bugModel(c: Critter): THREE.BufferGeometry {
  const id = c.id;
  const P: Part[] = [];
  const has = (...k: string[]) => k.some((x) => id.includes(x));
  if (has("butterfly", "swallowtail", "peacock", "white", "moth", "atlas")) {
    const col = id === "cabbage-white" ? 0xf8f8f0 : id === "yellow-butterfly" ? 0xf8e060 : id === "peacock" ? 0x3aa878 : id === "blue-butterfly" ? 0x7ab8f8 : id === "moth" ? 0xc8b890 : id === "atlas" || id === "atlas-moth" ? 0xc8603a : 0xf8c040;
    const sc = id === "atlas-moth" ? 1.8 : 1;
    P.push(at(cyl(0.012, 0.012, 0.1 * sc, 0x3a3a3a, 4), [0, 0, 0], [Math.PI / 2, 0, 0]));
    for (const s of [-1, 1]) {
      P.push(at(petal(0.1 * sc, 0.07 * sc, col, 0.1), [0, 0, 0.01], [0, s * 1.3, 0]));
      P.push(at(petal(0.07 * sc, 0.05 * sc, col, 0.1), [0, 0, -0.01], [0, s * 2.2, 0]));
    }
    return merge(P);
  }
  if (has("dragonfly", "darner")) {
    const col = id === "red-dragonfly" ? 0xe84a3a : id === "darner" ? 0x3a8a6a : 0x5a8ac8;
    P.push(at(cyl(0.012, 0.018, 0.2, col, 5), [0, 0, -0.04], [Math.PI / 2, 0, 0]));
    P.push(at(ball(0.03, col, 8, 6), [0, 0, 0.07]));
    for (const s of [-1, 1]) for (const z of [0.02, -0.02]) P.push(at(petal(0.12, 0.025, 0xe8f4ff, 0), [0, 0.01, z], [0, s * Math.PI / 2 + (z > 0 ? -0.2 : 0.2) * s, 0]));
    return merge(P);
  }
  if (has("stag", "rhino", "longhorn", "jewel", "diving", "dung", "ladybug", "pill")) {
    const col = id === "ladybug" ? 0xe83a3a : id === "jewel-beetle" ? 0x3ac890 : id === "rhino-beetle" ? 0x6a3a2a : id === "pill-bug" ? 0x6a6a74 : 0x3a2a24;
    const sz = id === "ladybug" ? 0.05 : id === "pill-bug" ? 0.045 : id === "giant-stag" ? 0.1 : 0.075;
    P.push(at(ball(sz, col, 12, 8), [0, sz * 0.5, 0], [0, 0, 0], [1, 0.6, 1.4]));
    P.push(at(ball(sz * 0.5, 0x2a2a2a, 8, 6), [0, sz * 0.4, sz * 1.3]));
    if (id === "ladybug") for (let k = 0; k < 6; k++) P.push(at(ball(sz * 0.18, 0x1a1a1a, 5, 4), [Math.cos(k) * sz * 0.5, sz * 0.8, Math.sin(k) * sz * 0.8]));
    if (has("stag")) for (const s of [-1, 1]) P.push(at(cone(0.012, sz * 1.2, 0x3a2a1a, 4), [s * sz * 0.25, sz * 0.4, sz * 2], [Math.PI / 2, 0, -s * 0.3]));
    if (id === "rhino-beetle") P.push(at(cone(0.02, sz * 1.4, 0x3a2a1a, 5), [0, sz * 0.9, sz * 1.6], [0.9, 0, 0]));
    if (id === "longhorn") for (const s of [-1, 1]) P.push(at(cyl(0.004, 0.004, 0.2, 0x2a2a2a, 3), [s * 0.04, sz, sz * 2], [1.2, 0, s * 0.4]));
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) P.push(at(cyl(0.004, 0.004, sz * 1.2, 0x1a1a1a, 3), [s * sz * 0.9, sz * 0.2, (k - 1) * sz * 0.6], [0, 0, s * 1.2]));
    return merge(P);
  }
  if (has("cicada")) {
    const col = id === "big-cicada" ? 0x2a2a2a : 0x5a6a3a;
    P.push(at(ball(0.05, col, 10, 8), [0, 0, 0], [0, 0, 0], [1, 0.7, 1.6]));
    for (const s of [-1, 1]) P.push(at(petal(0.12, 0.04, 0xd8e8f0, 0), [s * 0.02, 0.03, 0.04], [0, Math.PI + s * 0.25, 0]));
    return merge(P);
  }
  if (has("grasshopper", "cricket", "katydid", "mantis", "walking")) {
    const col = id.includes("cricket") ? 0x3a2a1a : id === "orchid-mantis" ? 0xf8c0d8 : id === "walking-stick" ? 0x8a6a3a : 0x6ab048;
    const len = id === "walking-stick" ? 0.3 : id.includes("mantis") ? 0.2 : 0.14;
    P.push(at(cyl(0.018, 0.022, len, col, 6), [0, 0.03, 0], [Math.PI / 2, 0, 0]));
    P.push(at(ball(0.025, col, 8, 6), [0, 0.04, len * 0.55]));
    for (const s of [-1, 1]) P.push(at(cyl(0.006, 0.006, len * 0.8, col, 3), [s * 0.03, 0.05, -len * 0.1], [0.4, 0, s * 0.3]));
    return merge(P);
  }
  if (has("bee", "wasp", "fly", "mosquito", "firefly", "ant", "flea")) {
    const col = id === "firefly" ? 0x3a3a3a : id === "ant" ? 0x2a1a1a : id === "fly" || id === "mosquito" ? 0x4a4a50 : 0xf8c030;
    const sz = id === "ant" || id === "flea" ? 0.025 : id === "wasp" ? 0.05 : 0.035;
    P.push(at(ball(sz, col, 8, 6), [0, 0, -sz], [0, 0, 0], [1, 1, 1.4]));
    if (id === "bee" || id === "wasp") for (const z of [-sz * 1.2, -sz * 0.4]) P.push(at(cyl(sz * 0.95, sz * 0.95, sz * 0.3, 0x2a2a2a, 8), [0, 0, z], [Math.PI / 2, 0, 0]));
    if (id === "firefly") P.push(at(ball(sz * 0.9, 0xd8ff60, 8, 6), [0, 0, -sz * 1.6]));
    P.push(at(ball(sz * 0.7, 0x2a2a2a, 8, 6), [0, 0, sz * 0.6]));
    if (id !== "ant" && id !== "flea") for (const s of [-1, 1]) P.push(at(petal(sz * 2, sz * 0.8, 0xe8f4ff, 0), [0, sz * 0.5, 0], [0, s * 2.4, 0]));
    return merge(P);
  }
  if (has("spider", "tarantula", "scorpion")) {
    const col = id === "tarantula" ? 0x4a3a2a : id === "scorpion" ? 0x8a3a2a : 0x2a2a2a;
    const sz = id === "spider" ? 0.04 : 0.07;
    P.push(at(ball(sz, col, 10, 8), [0, sz * 0.7, -sz * 0.6]));
    P.push(at(ball(sz * 0.7, col, 8, 6), [0, sz * 0.6, sz * 0.6]));
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) P.push(at(cyl(0.006, 0.006, sz * 2.2, col, 3), [s * sz, sz * 0.5, (k - 1.5) * sz * 0.5], [0, 0, s * 1.0]));
    if (id === "scorpion") P.push(at(cyl(0.012, 0.02, sz * 3, col, 5), [0, sz * 1.8, -sz * 1.6], [-0.6, 0, 0]));
    return merge(P);
  }
  if (id === "snail") return merge([at(ball(0.06, 0xc8a070, 10, 8), [0, 0.07, -0.02]), at(cyl(0.025, 0.03, 0.14, 0xb8b0a0, 6), [0, 0.02, 0.02], [Math.PI / 2, 0, 0])]);
  if (has("crab")) {
    const col = id === "coconut-crab" ? 0x5a4aa8 : id === "hermit-crab" ? 0xe8b890 : 0xe8603a;
    P.push(at(ball(0.07, col, 10, 8), [0, 0.05, 0], [0, 0, 0], [1.3, 0.6, 1]));
    for (const s of [-1, 1]) P.push(at(ball(0.035, col, 8, 6), [s * 0.1, 0.06, 0.06]));
    if (id === "hermit-crab") P.push(at(cone(0.07, 0.14, 0xf0e0c8, 8), [0, 0.1, -0.05], [-0.8, 0, 0]));
    return merge(P);
  }
  if (id === "water-strider") {
    P.push(at(cyl(0.01, 0.012, 0.1, 0x3a3a3a, 4), [0, 0.01, 0], [Math.PI / 2, 0, 0]));
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) P.push(at(cyl(0.003, 0.003, 0.14, 0x3a3a3a, 3), [s * 0.05, 0.005, (k - 1) * 0.04], [0, 0, s * 1.4]));
    return merge(P);
  }
  if (id === "bagworm") return merge([at(cone(0.04, 0.14, 0x8a7a4a, 6), [0, 0, 0], [Math.PI, 0, 0])]);
  return merge([at(box(0.05, 0.05, 0.08, 0x3a3a3a), [0, 0.02, 0])]);
}
