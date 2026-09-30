/**
 * A tiny modelling kit: primitives coloured per vertex, moved into place, merged into one
 * geometry. Every prop, building, item and critter in the game is made from these.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type Part = THREE.BufferGeometry;

/** Colour a geometry (drops uvs, makes it non-indexed so everything merges). */
export function paint(g: THREE.BufferGeometry, color: number | THREE.Color, jitter = 0): Part {
  const out = g.index ? g.toNonIndexed() : g;
  out.deleteAttribute("uv");
  if (!out.attributes.normal) out.computeVertexNormals();
  const n = out.attributes.position.count;
  const c = new THREE.Color(color);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const j = jitter ? 1 + (hash(i * 0.37 + n) - 0.5) * jitter : 1;
    col[i * 3] = c.r * j;
    col[i * 3 + 1] = c.g * j;
    col[i * 3 + 2] = c.b * j;
  }
  out.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return out;
}

function hash(x: number): number {
  const s = Math.sin(x * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();

/** Move a part: position, rotation (xyz euler), scale. */
export function at(g: Part, p: [number, number, number], r: [number, number, number] = [0, 0, 0], s: number | [number, number, number] = 1): Part {
  tmpQ.setFromEuler(tmpE.set(r[0], r[1], r[2]));
  const sc = typeof s === "number" ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s);
  tmpM.compose(new THREE.Vector3(...p), tmpQ, sc);
  g.applyMatrix4(tmpM);
  return g;
}

export function merge(parts: Part[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts, false)!;
  g.computeBoundingSphere();
  return g;
}

// Primitives (all return coloured, non-indexed parts).
export const box = (w: number, h: number, d: number, c: number, jit = 0) => paint(new THREE.BoxGeometry(w, h, d), c, jit);
export const cyl = (rt: number, rb: number, h: number, c: number, seg = 10, jit = 0) => paint(new THREE.CylinderGeometry(rt, rb, h, seg), c, jit);
export const cone = (r: number, h: number, c: number, seg = 10) => paint(new THREE.ConeGeometry(r, h, seg), c);
export const ball = (r: number, c: number, w = 12, h = 8, jit = 0) => paint(new THREE.SphereGeometry(r, w, h), c, jit);
export const torus = (r: number, t: number, c: number, seg = 16) => paint(new THREE.TorusGeometry(r, t, 6, seg), c);

/** A rounded box: a box whose corners are pulled toward a sphere (soft furniture, houses). */
export function rbox(w: number, h: number, d: number, round: number, c: number, seg = 3): Part {
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const hw = w / 2 - round;
  const hh = h / 2 - round;
  const hd = d / 2 - round;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const cx = Math.max(-hw, Math.min(hw, v.x));
    const cy = Math.max(-hh, Math.min(hh, v.y));
    const cz = Math.max(-hd, Math.min(hd, v.z));
    const dir = new THREE.Vector3(v.x - cx, v.y - cy, v.z - cz);
    if (dir.lengthSq() > 1e-9) dir.normalize().multiplyScalar(round);
    p.setXYZ(i, cx + dir.x, cy + dir.y, cz + dir.z);
  }
  g.computeVertexNormals();
  return paint(g, c);
}

/** A lumpy blob (tree canopies, rocks, bushes). */
export function blob(r: number, c: number, lump = 0.18, seed = 1, detail = 2, jit = 0): Part {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().normalize();
    const k = 1 + (Math.sin(n.x * 5.1 + seed) * Math.sin(n.y * 4.3 + seed * 2) * Math.sin(n.z * 4.7 + seed * 3)) * lump * 2;
    p.setXYZ(i, v.x * k, v.y * k, v.z * k);
  }
  // Shared-vertex normals so the lumps shade smoothly.
  const merged = mergeVerts(g);
  merged.computeVertexNormals();
  return paint(merged, c, jit);
}

function mergeVerts(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const p = g.attributes.position as THREE.BufferAttribute;
  const map = new Map<string, number>();
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
    let j = map.get(k);
    if (j === undefined) {
      j = pos.length / 3;
      map.set(k, j);
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
    }
    idx.push(j);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setIndex(idx);
  return out;
}

/** A lathe from a profile of [radius, y] points. */
export function lathe(profile: [number, number][], c: number, seg = 14): Part {
  const g = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    seg,
  );
  g.computeVertexNormals();
  return paint(g, c);
}

/** A flat leaf/petal shape lying in the xz plane pointing +z, cupped a little. */
export function petal(len: number, wid: number, c: number, cup = 0.3): Part {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(wid, len * 0.25, wid * 0.8, len * 0.8, 0, len);
  s.bezierCurveTo(-wid * 0.8, len * 0.8, -wid, len * 0.25, 0, 0);
  const g = new THREE.ShapeGeometry(s, 6);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    // Shape is in xy; lay it in xz and cup it.
    p.setXYZ(i, x, (x * x) / Math.max(1e-3, wid * wid) * cup * wid, y);
  }
  g.computeVertexNormals();
  const d = paint(g, c);
  // Two-sided: add the flipped copy.
  const back = d.clone();
  const bp = back.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < bp.count; i += 3) {
    for (const a of ["position", "color", "normal"]) {
      const at = back.attributes[a] as THREE.BufferAttribute;
      const t = [at.getX(i + 1), at.getY(i + 1), at.getZ(i + 1)];
      at.setXYZ(i + 1, at.getX(i + 2), at.getY(i + 2), at.getZ(i + 2));
      at.setXYZ(i + 2, t[0], t[1], t[2]);
    }
  }
  const bn = back.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < bn.count; i++) bn.setXYZ(i, -bn.getX(i), -bn.getY(i), -bn.getZ(i));
  return merge([d, back]);
}

/** Extrude a 2D outline (xy) by depth along z, centred. */
export function slab(pts: [number, number][], depth: number, c: number, bevel = 0.01): Part {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 6 });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return paint(g, c);
}
