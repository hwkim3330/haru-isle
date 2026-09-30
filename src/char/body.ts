/**
 * The chibi body everyone shares: a big head, a small round torso, stubby arms and legs, each
 * limb its own pivot so the animator can swing it. Animals add ears, a snout and a tail by
 * species; people add hair. Clothes are the torso's colours (plain, striped, two-tone).
 */
import * as THREE from "three";
import { at, ball, box, cone, cyl, merge, petal, rbox, torus, type Part } from "../render/geo";
import { mat } from "../render/stage";
import { faceGeometry, makeFace, type Face, type FaceDesc } from "./face";

export type Ears = "none" | "human" | "cat" | "rabbit" | "bear" | "dog" | "mouse" | "sheep" | "deer" | "pig" | "frog" | "fox" | "squirrel" | "koala" | "hamster" | "penguin" | "duck" | "otter";
export type Snout = "none" | "small" | "long" | "beak" | "flat" | "pig" | "wide" | "bill";
export type Tail = "none" | "cat" | "fluffy" | "bunny" | "curl" | "duck" | "long" | "squirrel" | "flat" | "stub";
export type Hair = "short" | "bob" | "spiky" | "pony" | "bun" | "long" | "curly" | "buzz";
export type Pattern = "plain" | "stripe" | "two" | "dot";

export interface Look {
  kind: "human" | "animal";
  fur: number;
  fur2: number;
  ears: Ears;
  snout: Snout;
  nose: number;
  tail: Tail;
  headScale: [number, number, number];
  shirt: number;
  shirt2: number;
  pattern: Pattern;
  pants: number;
  shoes: number;
  hair?: Hair;
  hairColor?: number;
  hat?: "cap" | "straw" | "beanie" | "bow" | null;
  hatColor?: number;
  face: FaceDesc;
  /** Overall size (kids vs grown-ups, big bears). */
  size?: number;
}

export interface Rig {
  root: THREE.Group;
  /** Bobs and leans (everything above the feet). */
  body: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  /** Where a held tool attaches. */
  hand: THREE.Group;
  tail: THREE.Group | null;
  face: Face;
  look: Look;
  height: number;
  meshes: THREE.Mesh[];
}

const MAT = mat(0xffffff, { vertexColors: true, rim: 0.22 });
const HEAD_R = 0.31;

/** A lathe whose rows are coloured by height (stripes, two-tone shirts). */
function latheC(profile: [number, number][], color: (y: number, k: number) => number, seg = 20): Part {
  // Lathe normals face out only when the profile climbs; sort it bottom to top.
  const pr = [...profile].sort((a, b) => a[1] - b[1]);
  const g = new THREE.LatheGeometry(pr.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  g.computeVertexNormals();
  const out = g.toNonIndexed();
  out.deleteAttribute("uv");
  const pos = out.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 3) {
    // Colour per triangle by its centre height, so bands have crisp edges.
    const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const z = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    c.set(color(y, Math.atan2(x, z)));
    for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (i + j) * 3);
  }
  out.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return out;
}

function torsoParts(L: Look): Part[] {
  // One smooth bean from the hips to the collar.
  const prof: [number, number][] = [
    [0.001, 0.16],
    [0.1, 0.165],
    [0.165, 0.2],
    [0.198, 0.27],
    [0.205, 0.35],
    [0.196, 0.43],
    [0.172, 0.51],
    [0.13, 0.575],
    [0.09, 0.61],
    [0.001, 0.625],
  ];
  // Rows every 0.0275 so colour bands (hem at 0.2, stripes every 0.055) fall on row edges.
  const rAt = (y: number) => {
    for (let k = 0; k < prof.length - 1; k++) {
      const [r0, y0] = prof[k];
      const [r1, y1] = prof[k + 1];
      if (y >= y0 && y <= y1) return r0 + ((r1 - r0) * (y - y0)) / Math.max(1e-6, y1 - y0);
    }
    return 0.001;
  };
  const dense: [number, number][] = [[0.001, 0.16], [0.1, 0.165], [0.165, 0.2]];
  for (let y = 0.2 + 0.0275; y < 0.61; y += 0.0275) dense.push([rAt(y), y]);
  dense.push([0.09, 0.61], [0.001, 0.625]);
  const shirt = (y: number): number => {
    if (y < 0.2) return L.pants;
    if (L.pattern === "stripe") return Math.floor((y - 0.2) / 0.055 + 1e-3) % 2 ? L.shirt2 : L.shirt;
    if (L.pattern === "two") return y < 0.36 ? L.shirt2 : L.shirt;
    return L.shirt;
  };
  const P: Part[] = [latheC(dense, shirt, 22)];
  if (L.pattern === "dot")
    for (let k = 0; k < 11; k++) {
      const a = (k / 11) * Math.PI * 2 + (k % 2) * 0.3;
      const y = 0.27 + (k % 3) * 0.085;
      const r = 0.2 - Math.abs(y - 0.35) * 0.25;
      P.push(at(ball(0.028, L.shirt2, 8, 6), [Math.sin(a) * r, y, Math.cos(a) * r], [0, a, 0], [1, 1, 0.35]));
    }
  // A collar and the neck.
  P.push(at(torus(0.095, 0.026, new THREE.Color(L.shirt).multiplyScalar(0.86).getHex(), 18), [0, 0.595, 0], [Math.PI / 2, 0, 0]));
  P.push(at(cyl(0.085, 0.095, 0.08, L.fur, 12), [0, 0.63, 0]));
  return P;
}

function earParts(L: Look): Part[] {
  const c = L.fur;
  const c2 = L.fur2;
  const R = HEAD_R;
  const P: Part[] = [];
  const both = (f: (s: number) => void) => [-1, 1].forEach(f);
  switch (L.ears) {
    case "human":
      both((s) => P.push(at(ball(0.06, c, 8, 6), [s * R * 0.97, -0.02, 0], [0, 0, 0], [0.5, 1, 0.8])));
      break;
    case "cat":
    case "fox":
      both((s) => {
        P.push(at(cone(0.1, 0.2, c, 4), [s * R * 0.55, R * 0.85, -0.02], [0, Math.PI / 4, -s * 0.35], [1, 1, 0.6]));
        P.push(at(cone(0.06, 0.12, c2, 4), [s * R * 0.55, R * 0.84, 0.02], [0, Math.PI / 4, -s * 0.35], [1, 1, 0.3]));
      });
      break;
    case "rabbit":
      both((s) => {
        P.push(at(ball(0.075, c, 10, 8), [s * R * 0.35, R * 1.35, 0], [0, 0, -s * 0.12], [0.75, 2.8, 0.5]));
        P.push(at(ball(0.045, c2, 8, 6), [s * R * 0.35, R * 1.35, 0.03], [0, 0, -s * 0.12], [0.7, 2.6, 0.3]));
      });
      break;
    case "bear":
    case "koala":
    case "hamster":
    case "otter": {
      const big = L.ears === "koala" ? 0.13 : L.ears === "otter" ? 0.05 : 0.08;
      both((s) => {
        P.push(at(ball(big, c, 10, 8), [s * R * 0.7, R * 0.72, -0.02], [0, 0, 0], [1, 1, 0.55]));
        P.push(at(ball(big * 0.6, c2, 8, 6), [s * R * 0.7, R * 0.72, 0.02], [0, 0, 0], [1, 1, 0.3]));
      });
      break;
    }
    case "dog":
      both((s) => P.push(at(ball(0.08, c2, 10, 8), [s * R * 0.9, R * 0.2, -0.02], [0, 0, s * 0.3], [0.55, 1.6, 0.8])));
      break;
    case "mouse":
      both((s) => {
        P.push(at(ball(0.14, c, 12, 8), [s * R * 0.72, R * 0.75, -0.04], [0, 0, 0], [1, 1, 0.3]));
        P.push(at(ball(0.1, c2, 10, 8), [s * R * 0.72, R * 0.75, -0.01], [0, 0, 0], [1, 1, 0.2]));
      });
      break;
    case "sheep":
      for (let k = 0; k < 9; k++) P.push(at(ball(0.11, c2, 8, 6), [Math.cos(k * 0.7 - 1.3) * R * 0.75, R * 0.55 + Math.sin(k * 0.7 - 1.3) * R * 0.3, -0.03]));
      both((s) => P.push(at(ball(0.06, c, 8, 6), [s * R * 1.0, 0, 0], [0, 0, 0], [1.4, 0.6, 0.6])));
      break;
    case "deer":
      both((s) => {
        P.push(at(ball(0.07, c, 8, 6), [s * R * 0.95, R * 0.35, 0], [0, 0, s * 0.8], [1.6, 0.6, 0.5]));
        P.push(at(cyl(0.022, 0.03, 0.26, 0xc8a878, 6), [s * R * 0.38, R * 1.05, -0.02], [0, 0, -s * 0.3]));
        P.push(at(cyl(0.018, 0.022, 0.14, 0xc8a878, 6), [s * R * 0.5, R * 1.15, -0.02], [0, 0, -s * 1.0]));
      });
      break;
    case "pig":
      both((s) => P.push(at(cone(0.08, 0.14, c, 4), [s * R * 0.62, R * 0.8, 0.05], [0.5, Math.PI / 4, -s * 0.4], [1, 1, 0.5])));
      break;
    case "frog":
      both((s) => {
        P.push(at(ball(0.1, c, 10, 8), [s * R * 0.42, R * 0.78, 0.05]));
      });
      break;
    case "squirrel":
      both((s) => {
        P.push(at(cone(0.07, 0.16, c, 5), [s * R * 0.5, R * 0.9, -0.02], [0, 0, -s * 0.2]));
        P.push(at(cone(0.02, 0.08, c2, 4), [s * R * 0.52, R * 1.05, -0.02], [0, 0, -s * 0.2]));
      });
      break;
    case "penguin":
    case "duck":
    case "none":
      break;
  }
  return P;
}

function snoutParts(L: Look): Part[] {
  const R = HEAD_R;
  const P: Part[] = [];
  const y = -R * 0.3;
  const z = R * 0.86;
  switch (L.snout) {
    case "small":
      P.push(at(ball(0.1, L.fur2, 10, 8), [0, y, z], [0, 0, 0], [1.1, 0.75, 0.6]));
      P.push(at(ball(0.035, L.nose, 8, 6), [0, y + 0.04, z + 0.06], [0, 0, 0], [1.2, 0.8, 0.8]));
      break;
    case "long":
      P.push(at(ball(0.11, L.fur2, 10, 8), [0, y, z + 0.04], [0, 0, 0], [1.0, 0.8, 1.1]));
      P.push(at(ball(0.04, L.nose, 8, 6), [0, y + 0.04, z + 0.15], [0, 0, 0], [1.3, 0.9, 0.9]));
      break;
    case "wide":
      P.push(at(ball(0.14, L.fur2, 12, 8), [0, y - 0.01, z - 0.02], [0, 0, 0], [1.2, 0.7, 0.7]));
      P.push(at(ball(0.04, L.nose, 8, 6), [0, y + 0.04, z + 0.07], [0, 0, 0], [1.4, 0.8, 0.8]));
      break;
    case "pig":
      P.push(at(cyl(0.08, 0.085, 0.07, L.nose, 12), [0, y + 0.02, z + 0.02], [Math.PI / 2, 0, 0]));
      for (const s of [-1, 1]) P.push(at(ball(0.017, 0x7a3a4a, 6, 4), [s * 0.03, y + 0.02, z + 0.06], [0, 0, 0], [1, 1.3, 0.5]));
      break;
    case "flat":
      P.push(at(ball(0.035, L.nose, 8, 6), [0, y + 0.04, z + 0.02], [0, 0, 0], [1.3, 0.8, 0.7]));
      break;
    case "beak":
      P.push(at(cone(0.06, 0.14, L.nose, 8), [0, y + 0.03, z + 0.05], [Math.PI / 2, 0, 0], [1.2, 1, 0.6]));
      break;
    case "bill":
      P.push(at(ball(0.1, L.nose, 10, 8), [0, y, z + 0.05], [0, 0, 0], [1.2, 0.35, 1.0]));
      break;
    case "none":
      break;
  }
  return P;
}

function hairParts(L: Look): Part[] {
  const c = L.hairColor ?? 0x4a3020;
  const R = HEAD_R;
  const P: Part[] = [];
  // One smooth shell over the head. Where the face shows, vertices sink inside the skull,
  // leaving a fringe of rounded scallops over the brow.
  const shell = new THREE.SphereGeometry(R * 1.075, 40, 28);
  const sp = shell.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const bangs = L.hair === "spiky" ? 5 : L.hair === "bob" || L.hair === "long" ? 3 : 4;
  for (let i = 0; i < sp.count; i++) {
    v.fromBufferAttribute(sp, i).divideScalar(R * 1.075);
    const front = v.z;
    const ang = Math.atan2(v.x, v.z);
    // The fringe line: lower at the temples, scalloped across the forehead.
    const scallop = Math.abs(Math.sin(ang * bangs * 1.6 + 0.3)) * 0.1;
    const fringe = 0.34 + scallop - Math.max(0, Math.abs(ang) - 0.9) * 0.55;
    const sideburn = L.hair === "bob" || L.hair === "long" ? -0.55 : -0.2;
    const hideFace = front > -0.1 && v.y < fringe && Math.abs(ang) < 1.25;
    const hideNape = v.y < (front < -0.2 ? (L.hair === "bob" || L.hair === "long" ? -0.55 : -0.25) : sideburn);
    let k = 1;
    if (hideFace || hideNape) k = 0.92;
    else k = 1 + Math.max(0, v.y) * 0.03;
    sp.setXYZ(i, v.x * R * 1.075 * k, v.y * R * 1.075 * k, v.z * R * 1.075 * k);
  }
  shell.computeVertexNormals();
  P.push(at(paintC(shell, c), [0, 0.012, -0.01]));
  switch (L.hair) {
    case "spiky":
      for (let k = 0; k < 7; k++) P.push(at(cone(0.07, 0.2, c, 5), [Math.cos(k * 0.9) * R * 0.5, R * 0.95, Math.sin(k * 0.9) * R * 0.5 - 0.05], [Math.sin(k * 0.9) * 0.5, 0, -Math.cos(k * 0.9) * 0.5]));
      break;
    case "pony":
      P.push(at(ball(0.1, c, 10, 8), [0, R * 0.4, -R * 1.0], [0.5, 0, 0], [0.8, 1.6, 0.8]));
      break;
    case "bun":
      P.push(at(ball(0.12, c, 10, 8), [0, R * 1.05, -R * 0.2]));
      break;
    case "long":
      P.push(at(rbox(R * 1.9, R * 1.3, 0.12, 0.05, c), [0, -R * 0.3, -R * 0.8]));
      for (const s of [-1, 1]) P.push(at(rbox(0.12, R * 1.2, 0.14, 0.05, c), [s * R * 0.92, -R * 0.35, -R * 0.2]));
      break;
    case "bob":
      for (const s of [-1, 1]) P.push(at(ball(0.13, c, 10, 8), [s * R * 0.85, -R * 0.2, -R * 0.1], [0, 0, 0], [0.7, 1.1, 1.0]));
      P.push(at(ball(0.25, c, 12, 8), [0, -R * 0.15, -R * 0.55], [0, 0, 0], [1.2, 0.9, 0.7]));
      break;
    case "curly":
      for (let k = 0; k < 14; k++) P.push(at(ball(0.085, c, 8, 6), [Math.cos(k * 0.9) * R * 0.85, R * 0.4 + Math.sin(k * 1.7) * R * 0.3, Math.sin(k * 0.9) * R * 0.7 - 0.05]));
      break;
    case "buzz":
    case "short":
    default:
      break;
  }
  return P;
}

function paintC(g: THREE.BufferGeometry, c: number): Part {
  const out = g.toNonIndexed();
  out.deleteAttribute("uv");
  out.computeVertexNormals();
  const n = out.attributes.position.count;
  const col = new Float32Array(n * 3);
  const cc = new THREE.Color(c);
  for (let i = 0; i < n; i++) col.set([cc.r, cc.g, cc.b], i * 3);
  out.setAttribute("color", new THREE.BufferAttribute(col, 3));
  // Render both sides (open cap edge).
  return out;
}

function hatParts(L: Look): Part[] {
  const c = L.hatColor ?? 0xe84a4a;
  const R = HEAD_R;
  switch (L.hat) {
    case "cap":
      return [at(ball(R * 1.08, c, 16, 8), [0, R * 0.3, 0], [0, 0, 0], [1, 0.6, 1]), at(cyl(0.2, 0.2, 0.02, c, 12), [0, R * 0.42, R * 0.7], [0.15, 0, 0], [1, 1, 0.8])];
    case "straw":
      return [at(cyl(R * 1.6, R * 1.6, 0.02, 0xe8cc80, 18), [0, R * 0.6, 0]), at(cyl(R * 0.8, R * 0.95, 0.22, 0xe8cc80, 16), [0, R * 0.75, 0]), at(cyl(R * 0.97, R * 0.97, 0.05, c, 16), [0, R * 0.66, 0])];
    case "beanie":
      return [at(ball(R * 1.1, c, 16, 8), [0, R * 0.25, 0], [0, 0, 0], [1, 0.75, 1]), at(ball(0.07, 0xffffff, 8, 6), [0, R * 1.08, 0])];
    case "bow":
      return [at(ball(0.07, c, 8, 6), [R * 0.45, R * 0.85, 0.05], [0, 0, 0.5], [1.4, 0.8, 0.5]), at(ball(0.07, c, 8, 6), [R * 0.72, R * 0.72, 0.05], [0, 0, 0.5], [1.4, 0.8, 0.5])];
    default:
      return [];
  }
}

function tailParts(L: Look): Part[] {
  const c = L.fur;
  const c2 = L.fur2;
  switch (L.tail) {
    case "cat":
      return [at(cyl(0.025, 0.03, 0.32, c, 6), [0, 0.12, -0.04], [-0.8, 0, 0]), at(ball(0.035, c, 6, 4), [0, 0.24, -0.14])];
    case "fluffy":
      return [at(ball(0.1, c, 10, 8), [0, 0.1, -0.1], [-0.6, 0, 0], [0.8, 1.8, 0.8]), at(ball(0.07, c2, 8, 6), [0, 0.24, -0.2])];
    case "bunny":
      return [at(ball(0.07, c2, 8, 6), [0, 0, -0.03])];
    case "curl":
      return [colorize(at(new THREE.TorusGeometry(0.05, 0.015, 5, 10, Math.PI * 1.6), [0, 0.02, -0.06], [0, Math.PI / 2, 0]), c)];
    case "duck":
      return [at(cone(0.08, 0.12, c, 6), [0, 0.02, -0.05], [-1.9, 0, 0], [1.3, 1, 0.5])];
    case "long":
      return [at(cyl(0.03, 0.05, 0.36, c, 6), [0, 0.1, -0.12], [-1.1, 0, 0]), at(cone(0.04, 0.1, c2, 6), [0, 0.18, -0.28], [-1.3, 0, 0])];
    case "squirrel":
      return [at(ball(0.12, c, 10, 8), [0, 0.2, -0.12], [0.3, 0, 0], [0.8, 1.9, 0.7]), at(ball(0.1, c, 10, 8), [0, 0.45, -0.05], [0, 0, 0], [0.9, 1, 0.8])];
    case "flat":
      return [at(ball(0.12, c, 10, 8), [0, -0.02, -0.1], [0.4, 0, 0], [0.8, 0.25, 1.4])];
    case "stub":
      return [at(ball(0.05, c, 8, 6), [0, 0, -0.03])];
    default:
      return [];
  }
}

function colorize(g: THREE.BufferGeometry, c: number): Part {
  return paintC(g, c);
}

function limb(len: number, r: number, c: number, end: number, endR: number, sleeve?: number): Part[] {
  const P: Part[] = [at(latheC([[0.001, 0.02], [r * 0.9, 0], [r, -len * 0.5], [r * 0.85, -len], [0.001, -len - 0.01]], () => c, 10), [0, 0, 0])];
  if (sleeve !== undefined) P.push(at(latheC([[r * 1.35, 0.03], [r * 1.45, -len * 0.25], [r * 1.35, -len * 0.5], [r * 1.1, -len * 0.52]], () => sleeve, 12), [0, 0, 0]));
  P.push(at(ball(endR, end, 12, 8), [0, -len - 0.01, 0.005], [0, 0, 0], [1, 0.95, 1]));
  return P;
}

export function buildRig(L: Look): Rig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const meshes: THREE.Mesh[] = [];
  const mk = (parts: Part[], parent: THREE.Object3D) => {
    if (!parts.length) return null;
    const m = new THREE.Mesh(merge(parts), MAT);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    meshes.push(m);
    return m;
  };
  const penguin = L.ears === "penguin" || L.ears === "duck";
  mk(torsoParts(L), body);
  if (penguin) mk([at(ball(0.16, L.fur2, 12, 8), [0, 0.38, 0.06], [0, 0, 0], [1, 1.3, 0.7])], body);
  // Head.
  const head = new THREE.Group();
  head.position.set(0, 0.62 + HEAD_R * 0.92, 0);
  body.add(head);
  const hs = L.headScale;
  const skull = new THREE.Group();
  skull.scale.set(hs[0], hs[1], hs[2]);
  head.add(skull);
  const headParts: Part[] = [at(ball(HEAD_R, L.fur, 24, 16), [0, 0, 0])];
  if (L.kind === "animal" && (L.snout === "none" || L.snout === "flat" || L.snout === "beak" || L.snout === "bill")) {
    // A lighter muzzle patch keeps flat-faced animals readable.
    headParts.push(at(ball(HEAD_R * 0.55, L.fur2, 14, 10), [0, -HEAD_R * 0.38, HEAD_R * 0.55], [0, 0, 0], [1.1, 0.7, 0.6]));
  }
  mk([...headParts, ...earParts(L), ...snoutParts(L), ...(L.kind === "human" ? hairParts(L) : []), ...hatParts(L)], skull);
  const face = makeFace(L.face);
  const fm = new THREE.Mesh(faceGeometry(HEAD_R), face.mat);
  fm.renderOrder = 5;
  skull.add(fm);
  // Arms from the shoulders.
  const arm = (s: number) => {
    const g = new THREE.Group();
    g.position.set(s * 0.2, 0.53, 0);
    body.add(g);
    mk(limb(0.2, 0.042, L.fur, L.fur, 0.062, L.pattern === "stripe" ? L.shirt2 : L.shirt), g);
    g.rotation.z = s * 0.25;
    return g;
  };
  const armL = arm(1);
  const armR = arm(-1);
  const hand = new THREE.Group();
  hand.position.set(0, -0.22, 0.02);
  armR.add(hand);
  const leg = (s: number) => {
    const g = new THREE.Group();
    g.position.set(s * 0.09, 0.2, 0);
    root.add(g);
    mk([at(latheC([[0.068, 0.02], [0.066, -0.06], [0.058, -0.12], [0.001, -0.13]], () => L.pants, 12), [0, 0, 0]), at(ball(0.078, L.shoes, 14, 10), [0, -0.15, 0.035], [0, 0, 0], [1, 0.62, 1.35])], g);
    return g;
  };
  const legL = leg(1);
  const legR = leg(-1);
  let tail: THREE.Group | null = null;
  const tp = tailParts(L);
  if (tp.length) {
    tail = new THREE.Group();
    tail.position.set(0, 0.24, -0.17);
    body.add(tail);
    mk(tp, tail);
  }
  const size = L.size ?? 1;
  root.scale.setScalar(size);
  return { root, body, head, armL, armR, legL, legR, hand, tail, face, look: L, height: (0.62 + HEAD_R * 2) * size, meshes };
}

/** A tiny grey figure for loading screens and the far LOD. */
export function silhouette(): Part {
  return merge([at(box(0.3, 0.5, 0.2, 0x888888), [0, 0.25, 0]), at(ball(0.25, 0x888888), [0, 0.7, 0]), at(petal(0.1, 0.05, 0x888888), [0, 0, 0])]);
}
