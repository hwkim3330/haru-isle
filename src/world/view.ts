/**
 * Draws what stands on the tiles: one instanced mesh per model variant (a grown apple tree
 * with fruit, a red tulip bud, …), rebuilt whenever the state marks itself dirty. Leaves share
 * a material the season tints and the wind sways.
 */
import * as THREE from "three";
import { clock } from "../core/clock";
import { furnGeometry } from "../render/furniture";
import { mat, occluder, type Stage } from "../render/stage";
import { bundleModel, digMarkModel, flowerModel, fruitModel, holeModel, rockModel, shellModel, shoreRockModel, stumpModel, treeModel, weedModel, type Model } from "../render/nature";
import { H, idx, K, W, type Island } from "./island";
import type { IslandState, Obj } from "./state";
import type { Terrain } from "./terrain";

interface Batch {
  base: THREE.InstancedMesh;
  leaf?: THREE.InstancedMesh;
  n: number;
}

const WIND = /* glsl */ `
  #ifdef USE_INSTANCING
    vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
  #else
    vec3 ip = vec3(0.0);
  #endif
  float sway = sin(uTime * 1.6 + ip.x * 0.7 + ip.z * 0.5) * 0.035 * max(0.0, transformed.y - 0.2);
  transformed.x += sway;
  transformed.z += sway * 0.6;
`;

export class ObjectView {
  readonly group = new THREE.Group();
  private readonly batches = new Map<string, Batch>();
  private readonly models = new Map<string, Model>();
  readonly baseMat = mat(0xffffff, { vertexColors: true });
  readonly leafMat = mat(0xffffff, { vertexColors: true });
  dirty = true;
  /** Held items that shouldn't draw on the ground (a tree being shaken, …). */
  readonly shake = new Map<number, number>();

  constructor(
    readonly I: Island,
    readonly S: IslandState,
    readonly terrain: Terrain,
    readonly stage: Stage,
  ) {
    const time = stage.time;
    this.leafMat.onBeforeCompile = ((prev) => (sh: THREE.WebGLProgramParametersWithUniforms, r: THREE.WebGLRenderer) => {
      prev(sh, r);
      sh.uniforms.uTime = time;
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nuniform float uTime;").replace("#include <begin_vertex>", "#include <begin_vertex>\n" + WIND);
    })(this.leafMat.onBeforeCompile);
    this.leafMat.customProgramCacheKey = () => "leaf";
    occluder(this.leafMat);
    occluder(this.baseMat);
    this.group.add(this.shoreRocks());
  }

  private model(key: string, make: () => Model): Model {
    let m = this.models.get(key);
    if (!m) {
      m = make();
      this.models.set(key, m);
    }
    return m;
  }

  private keyFor(o: Obj, i: number): [string, () => Model] | null {
    const seed = (i * 7) % 4;
    switch (o.t) {
      case "tree": {
        const st = o.stage === 3 && o.fruitN > 0 && o.fruit ? 4 : o.stage;
        return [`tree:${o.kind}:${st}:${o.fruit ?? ""}:${seed}`, () => treeModel(o.kind, st, o.fruit ?? null, seed + 1)];
      }
      case "stump":
        return ["stump", stumpModel];
      case "rock":
        return [`rock:${seed}`, () => rockModel(seed + 3)];
      case "flower":
        return [`flower:${o.sp}:${o.col}:${o.stage}`, () => flowerModel(o.sp, o.col, o.stage)];
      case "weed":
        return [`weed:${o.v}`, () => weedModel(o.v)];
      case "shell":
        return [`shell:${o.v}`, () => shellModel(o.v)];
      case "hole":
        return ["hole", holeModel];
      case "buried":
        return o.mark ? ["dig", digMarkModel] : null;
      case "item": {
        const fruit = ["apple", "orange", "pear", "peach", "persimmon", "coconut"].includes(o.id);
        if (fruit) return [`fruit:${o.id}`, () => fruitModel(o.id)];
        if (o.id.startsWith("shell")) return [`shell:${+o.id.slice(5)}`, () => shellModel(+o.id.slice(5))];
        return [`bundle`, () => bundleModel()];
      }
      case "furn": {
        const [, fid, v] = o.id.split(":");
        return [o.id, () => ({ base: furnGeometry(fid, +v) })];
      }
    }
  }

  private batch(key: string, m: Model): Batch {
    let b = this.batches.get(key);
    if (!b) {
      const cap = 16;
      const base = new THREE.InstancedMesh(m.base, this.baseMat, cap);
      base.castShadow = true;
      base.receiveShadow = true;
      base.frustumCulled = false;
      base.count = 0;
      this.group.add(base);
      let leaf: THREE.InstancedMesh | undefined;
      if (m.leaf) {
        leaf = new THREE.InstancedMesh(m.leaf, this.leafMat, cap);
        leaf.castShadow = true;
        leaf.receiveShadow = false;
        leaf.frustumCulled = false;
        leaf.count = 0;
        this.group.add(leaf);
      }
      b = { base, leaf, n: 0 };
      this.batches.set(key, b);
    }
    return b;
  }

  private grow(b: Batch, need: number): void {
    const cap = b.base.instanceMatrix.count;
    if (need <= cap) return;
    const ncap = Math.max(need, cap * 2);
    const re = (old: THREE.InstancedMesh) => {
      const m = new THREE.InstancedMesh(old.geometry, old.material, ncap);
      m.castShadow = old.castShadow;
      m.receiveShadow = old.receiveShadow;
      m.frustumCulled = false;
      this.group.remove(old);
      this.group.add(m);
      return m;
    };
    b.base = re(b.base);
    if (b.leaf) b.leaf = re(b.leaf);
  }

  /** Rebuild every batch from the state (cheap: a few thousand matrices). */
  rebuild(): void {
    for (const b of this.batches.values()) b.n = 0;
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const lists = new Map<string, [number, Obj][]>();
    for (const k in this.S.objs) {
      const i = +k;
      const o = this.S.objs[i];
      const kf = this.keyFor(o, i);
      if (!kf) continue;
      const m = this.model(kf[0], kf[1]);
      this.batch(kf[0], m);
      let l = lists.get(kf[0]);
      if (!l) lists.set(kf[0], (l = []));
      l.push([i, o]);
    }
    for (const [key, l] of lists) {
      const b = this.batches.get(key)!;
      this.grow(b, l.length);
      for (const [i, o] of l) {
        const x = (i % W) + 0.5;
        const z = ((i / W) | 0) + 0.5;
        const y = this.terrain.groundY(x, z);
        const rot = o.t === "furn" ? (o.rot * Math.PI) / 2 : o.t === "item" ? 0 : ((i * 2654435761) % 628) / 100;
        q.setFromAxisAngle(up, rot);
        m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
        b.base.setMatrixAt(b.n, m4);
        b.leaf?.setMatrixAt(b.n, m4);
        b.n++;
      }
    }
    for (const b of this.batches.values()) {
      b.base.count = b.n;
      b.base.instanceMatrix.needsUpdate = true;
      if (b.leaf) {
        b.leaf.count = b.n;
        b.leaf.instanceMatrix.needsUpdate = true;
      }
    }
    this.dirty = false;
  }

  /** Decorative boulders along the rocky shore (not interactive). */
  private shoreRocks(): THREE.Object3D {
    const list: number[] = [];
    for (let i = 0; i < W * H; i++) if (this.I.kind[i] === K.Rock) list.push(i);
    const models = [0, 1, 2].map((s) => shoreRockModel(s + 1).base);
    const g = new THREE.Group();
    for (let s = 0; s < 3; s++) {
      const mine = list.filter((_, k) => k % 3 === s);
      const im = new THREE.InstancedMesh(models[s], this.baseMat, Math.max(1, mine.length));
      im.count = mine.length;
      const m4 = new THREE.Matrix4();
      mine.forEach((i, k) => {
        const x = (i % W) + 0.5;
        const z = ((i / W) | 0) + 0.5;
        m4.compose(new THREE.Vector3(x, this.terrain.heightAt(x, z), z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), k * 1.3), new THREE.Vector3(1, 1, 1).multiplyScalar(0.9 + ((k * 37) % 5) / 10));
        im.setMatrixAt(k, m4);
      });
      im.castShadow = true;
      im.receiveShadow = true;
      im.frustumCulled = false;
      g.add(im);
    }
    return g;
  }

  /** Season tint for leaves (spring fresh, summer deep, autumn gold, winter frosted). */
  setSeason(): void {
    const t = clock.yearT();
    const keys: [number, number][] = [
      [0.0, 0xc8d8d0],
      [0.15, 0xd8e8c8],
      [0.3, 0xffffff],
      [0.6, 0xe8ffe0],
      [0.78, 0xffe8a0],
      [0.86, 0xffb070],
      [0.94, 0xd8c8b0],
      [1.0, 0xc8d8d0],
    ];
    for (let k = 0; k < keys.length - 1; k++)
      if (t >= keys[k][0] && t <= keys[k + 1][0]) {
        const u = (t - keys[k][0]) / (keys[k + 1][0] - keys[k][0]);
        this.leafMat.color.set(keys[k][1]).lerp(new THREE.Color(keys[k + 1][1]), u);
      }
  }

  update(): void {
    if (this.dirty) this.rebuild();
  }

  /** Index helper for callers. */
  static at(x: number, z: number): number {
    return idx(x, z);
  }
}
