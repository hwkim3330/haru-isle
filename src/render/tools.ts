/**
 * Tool models (held in the right hand, pointing forward along +z from the grip) and the
 * little things tools use: the fishing bobber, the net's hoop.
 */
import * as THREE from "three";
import type { ToolKind } from "../data/items";
import { at, ball, box, cone, cyl, merge, type Part } from "./geo";
import { mat } from "./stage";

const M = mat(0xffffff, { vertexColors: true });

function colorOf(tier: number, base: number): number {
  return tier >= 2 ? 0xe8c040 : base;
}

export function toolGeometry(t: ToolKind, tier = 1): THREE.BufferGeometry {
  const P: Part[] = [];
  const shaft = (len: number, c = 0xa87a4a) => P.push(at(cyl(0.02, 0.022, len, c, 6), [0, 0, len / 2], [Math.PI / 2, 0, 0]));
  switch (t) {
    case "shovel":
      shaft(0.7);
      P.push(at(box(0.16, 0.03, 0.2, colorOf(tier, 0xa8b0b8)), [0, 0, 0.8]));
      P.push(at(cone(0.08, 0.1, colorOf(tier, 0xa8b0b8), 4), [0, 0, 0.94], [Math.PI / 2, Math.PI / 4, 0], [1, 1, 0.25]));
      break;
    case "axe":
      shaft(0.55);
      P.push(at(box(0.04, 0.18, 0.12, colorOf(tier, 0x9aa0a8)), [0, 0.08, 0.5]));
      break;
    case "net": {
      shaft(0.75);
      const hoop = new THREE.TorusGeometry(0.16, 0.012, 5, 16).toNonIndexed();
      hoop.deleteAttribute("uv");
      const n = hoop.attributes.position.count;
      const c = new THREE.Color(colorOf(tier, 0xd8d8d8));
      hoop.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3).map((_, i) => [c.r, c.g, c.b][i % 3]), 3));
      P.push(at(hoop, [0, 0, 0.9], [Math.PI / 2, 0, 0]));
      P.push(at(cone(0.15, 0.25, 0xf8f8f0, 10), [0, -0.12, 0.9], [Math.PI, 0, 0], [1, 1, 1]));
      break;
    }
    case "rod":
      P.push(at(cyl(0.012, 0.02, 1.2, colorOf(tier, 0x8a6a3a), 6), [0, 0, 0.6], [Math.PI / 2, 0, 0]));
      P.push(at(cyl(0.035, 0.035, 0.04, 0x5a5a60, 8), [0, -0.04, 0.12], [0, 0, Math.PI / 2]));
      break;
    case "can":
      P.push(at(cyl(0.09, 0.1, 0.16, colorOf(tier, 0x6ac070), 10), [0, -0.1, 0.12]));
      P.push(at(cyl(0.015, 0.02, 0.22, colorOf(tier, 0x6ac070), 6), [0, -0.06, 0.26], [1.0, 0, 0]));
      P.push(at(cyl(0.04, 0.02, 0.04, colorOf(tier, 0x5aa060), 8), [0, 0.02, 0.36], [1.0, 0, 0]));
      break;
    case "slingshot":
      P.push(at(cyl(0.018, 0.018, 0.15, colorOf(tier, 0x8a5a3a), 6), [0, 0, 0.07], [Math.PI / 2, 0, 0]));
      for (const s of [-1, 1]) P.push(at(cyl(0.015, 0.015, 0.12, colorOf(tier, 0x8a5a3a), 6), [s * 0.04, 0.04, 0.17], [Math.PI / 2 - 0.4, 0, s * 0.5]));
      break;
    case "ladder":
      for (const s of [-1, 1]) P.push(at(box(0.04, 0.04, 0.9, 0xc89a6a), [s * 0.13, 0, 0.35]));
      for (let k = 0; k < 4; k++) P.push(at(box(0.26, 0.03, 0.03, 0xc89a6a), [0, 0, 0.05 + k * 0.22]));
      break;
    case "pole":
      P.push(at(cyl(0.02, 0.02, 1.6, 0xd8b070, 6), [0, 0, 0.4], [Math.PI / 2, 0, 0]));
      break;
  }
  return merge(P);
}

export function toolMesh(t: ToolKind, tier = 1): THREE.Mesh {
  const m = new THREE.Mesh(toolGeometry(t, tier), M);
  m.castShadow = true;
  return m;
}

export function bobberMesh(): THREE.Mesh {
  const m = new THREE.Mesh(merge([at(ball(0.06, 0xe84a4a, 10, 6), [0, 0.03, 0], [0, 0, 0], [1, 0.8, 1]), at(ball(0.061, 0xffffff, 10, 6), [0, 0.02, 0], [Math.PI, 0, 0], [1, 0.5, 1])]), M);
  return m;
}
