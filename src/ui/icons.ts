/**
 * Item icons, rendered from each item's own 3D model on a small offscreen canvas the first
 * time they're shown, and cached as images.
 */
import * as THREE from "three";
import { item } from "../data/items";
import { at, ball, blob, box, cone, cyl, merge, petal, rbox } from "../render/geo";
import { furnGeometry } from "../render/furniture";
import { flowerModel, fruitModel, shellModel, treeModel } from "../render/nature";
import { bugModel, fishModel } from "../render/critters";
import { toolGeometry } from "../render/tools";
import { FLOWER_COLORS } from "../render/nature";

let R: THREE.WebGLRenderer | null = null;
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(28, 1, 0.01, 50);
const cache = new Map<string, string>();
const M = new THREE.MeshToonMaterial({ vertexColors: true });
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8aa0, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(2, 4, 3);
scene.add(sun);

export function itemGeometry(id: string): THREE.BufferGeometry {
  const d = item(id);
  switch (d.kind) {
    case "tool":
      return toolGeometry(d.tool!, d.tier);
    case "fruit":
      return fruitModel(id).base;
    case "fish":
      return fishModel(d.critter!);
    case "bug":
      return bugModel(d.critter!);
    case "shell":
      return shellModel(+id.slice(5)).base;
    case "flower":
      return flowerModel(d.flower!.sp, d.flower!.col, 2).base;
    case "seed":
      return merge([at(rbox(0.3, 0.4, 0.06, 0.02, 0xf4ecd8), [0, 0.2, 0]), at(ball(0.08, FLOWER_COLORS[d.flower!.col], 8, 6), [0, 0.25, 0.04], [0, 0, 0], [1, 1, 0.3])]);
    case "sapling": {
      const t = treeModel(id === "cedar-sapling" ? "cedar" : "hard", 1, null, 2);
      return merge([t.base, t.leaf!]);
    }
    case "furniture":
      return furnGeometry(d.furn!.id, d.furn!.v);
    case "top":
      return merge([at(rbox(0.5, 0.5, 0.15, 0.08, d.cloth!.color), [0, 0.3, 0]), ...[-1, 1].map((s) => at(rbox(0.2, 0.25, 0.14, 0.06, d.cloth!.color), [s * 0.3, 0.45, 0], [0, 0, s * 0.6])), ...(d.cloth!.style === "stripe" ? [0.2, 0.35].map((y) => at(box(0.51, 0.05, 0.16, d.cloth!.color2), [0, y, 0])) : [])]);
    case "bottom":
      return d.cloth!.style === "skirt" ? cone(0.3, 0.4, d.cloth!.color, 10) : merge([-1, 1].map((s) => at(rbox(0.18, d.cloth!.style === "pants" ? 0.5 : 0.28, 0.15, 0.06, d.cloth!.color), [s * 0.1, 0.25, 0])));
    case "hat":
      return d.cloth!.style === "straw" ? merge([at(cyl(0.35, 0.35, 0.02, 0xe8cc80, 16), [0, 0, 0]), at(cyl(0.17, 0.2, 0.15, 0xe8cc80, 14), [0, 0.08, 0]), at(cyl(0.205, 0.205, 0.04, d.cloth!.color, 14), [0, 0.03, 0])]) : merge([at(ball(0.22, d.cloth!.color, 14, 8), [0, 0, 0], [0, 0, 0], [1, 0.7, 1])]);
    case "wall":
    case "floor":
      return merge([at(box(0.6, 0.6, 0.04, d.color!), [0, 0.3, 0]), at(box(0.62, 0.04, 0.06, 0xffffff), [0, 0.02, 0])]);
    case "recipe":
      return merge([at(rbox(0.45, 0.55, 0.02, 0.01, 0xf8f0d8), [0, 0.28, 0]), at(cyl(0.03, 0.03, 0.5, 0xc89a6a, 6), [0, 0.56, 0], [0, 0, Math.PI / 2])]);
    case "fossil":
      return merge([at(blob(0.22, 0xd8c8a0, 0.2, 3, 1, 0.1), [0, 0.15, 0], [0, 0, 0], [1.2, 0.7, 1])]);
    case "material":
      switch (id) {
        case "wood":
        case "softwood":
        case "hardwood": {
          const c = id === "wood" ? 0xa87a4a : id === "softwood" ? 0xd8b080 : 0x7a5034;
          return merge([at(cyl(0.1, 0.1, 0.5, c, 10), [0, 0.1, 0], [0, 0, Math.PI / 2]), at(cyl(0.1, 0.1, 0.5, c, 10), [0, 0.1, 0.2], [0, 0, Math.PI / 2]), at(cyl(0.1, 0.1, 0.5, c, 10), [0, 0.28, 0.1], [0, 0, Math.PI / 2])]);
        }
        case "branch":
          return merge([at(cyl(0.03, 0.04, 0.6, 0x8a5a3a, 5), [0, 0.05, 0], [0, 0, 1.3]), at(cyl(0.02, 0.025, 0.25, 0x8a5a3a, 5), [0.1, 0.12, 0], [0, 0, 0.4]), at(petal(0.1, 0.04, 0x5aa040), [0.15, 0.2, 0])]);
        case "stone":
          return blob(0.22, 0x9a9aa0, 0.15, 5, 1, 0.1);
        case "clay":
          return blob(0.22, 0xd8804a, 0.12, 6, 1, 0.06);
        case "iron":
          return merge([blob(0.22, 0x6a6a74, 0.15, 7, 1, 0.1), at(ball(0.05, 0xd8d8e0, 6, 4), [0.1, 0.12, 0.14])]);
        case "gold":
          return merge([blob(0.22, 0x8a7a50, 0.15, 8, 1, 0.1), at(ball(0.07, 0xf8d040, 6, 4), [0.08, 0.12, 0.14]), at(ball(0.05, 0xf8d040, 6, 4), [-0.1, 0.05, 0.16])]);
        case "weed":
          return merge([0, 1, 2, 3].map((k) => at(cone(0.05, 0.35, 0x5aa040, 4), [Math.cos(k) * 0.06, 0.15, Math.sin(k) * 0.06], [Math.sin(k) * 0.4, 0, Math.cos(k) * 0.4])));
        case "star":
          return merge([0, 1, 2, 3, 4].map((k) => at(cone(0.08, 0.25, 0xf8e060, 4), [0, 0, 0], [0, 0, (k / 5) * Math.PI * 2], [1, 1, 0.4])));
        default:
          return blob(0.2, 0xf0e0d0, 0.1, 9, 1, 0.1);
      }
    case "misc":
      if (id === "acorns") return merge([at(ball(0.25, 0xf8e8c0, 12, 8), [0, 0.22, 0], [0, 0, 0], [1, 0.9, 1]), at(cone(0.12, 0.15, 0xf8e8c0, 8), [0, 0.5, 0]), at(ball(0.08, 0xb07038, 8, 6), [0, 0.25, 0.22])]);
      if (id === "present" || id === "balloon") return merge([at(box(0.4, 0.35, 0.4, 0xe84a6a), [0, 0.18, 0]), at(box(0.42, 0.37, 0.08, 0xf8e060), [0, 0.18, 0]), at(box(0.08, 0.37, 0.42, 0xf8e060), [0, 0.18, 0])]);
      if (id === "radish" || id === "rotten-radish") return merge([at(ball(0.16, id === "radish" ? 0xf8f4f0 : 0x8a7a6a, 10, 8), [0, 0.18, 0], [0, 0, 0], [0.8, 1.3, 0.8]), ...[0, 1, 2].map((k) => at(petal(0.25, 0.06, 0x5aa040, 0.3), [0, 0.35, 0], [-1.2, k * 2.1, 0]))]);
      return merge([at(rbox(0.5, 0.35, 0.02, 0.01, 0xf8f4ec), [0, 0.2, 0])]);
  }
}

/** A data-URL image of an item (square, transparent). */
export function icon(id: string): string {
  const c = cache.get(id);
  if (c) return c;
  if (!R) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 96;
    R = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, preserveDrawingBuffer: true });
    R.setClearColor(0x000000, 0);
  }
  let g: THREE.BufferGeometry;
  try {
    g = itemGeometry(id);
  } catch {
    g = box(0.3, 0.3, 0.3, 0xcccccc);
  }
  const mesh = new THREE.Mesh(g, M);
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const size = bb.getSize(new THREE.Vector3());
  const ctr = bb.getCenter(new THREE.Vector3());
  mesh.position.sub(ctr);
  const holder = new THREE.Group();
  holder.add(mesh);
  const d = item(id);
  holder.rotation.set(d.kind === "fish" ? 0 : 0.35, d.kind === "fish" ? Math.PI / 2 : -0.6, 0);
  scene.add(holder);
  const r = Math.max(size.x, size.y, size.z) * 0.72 + 0.01;
  cam.position.set(0, 0, r / Math.tan((cam.fov * Math.PI) / 360));
  cam.lookAt(0, 0, 0);
  R.render(scene, cam);
  const url = R.domElement.toDataURL();
  scene.remove(holder);
  g.dispose();
  cache.set(id, url);
  return url;
}
