/**
 * The island's ground, water and waterfalls. A fine height field (4 samples a tile) is built
 * from signed distances to each tier, the land and the water, blurred so cliff corners come out
 * round; its colour is decided per pixel from tile textures (sand, water, paths the player lays)
 * so the look can change without rebuilding the mesh. The walking height is logical (tier,
 * ramp, bridge), never read off the mesh.
 */
import * as THREE from "three";
import { GLSL_NOISE, Noise } from "../core/noise";
import { mat, type Stage } from "../render/stage";
import { bridgeAt, DX, DZ, edt, H, idx, inside, K, rampAt, SEA_Y, TIER_H, W, type Island } from "./island";

const S = 4;
const NW = W * S + 1;
const NH = H * S + 1;
export const WATER_DROP = 0.2;

export const PATHS = ["none", "dirt", "stone", "brick", "wood"] as const;

export class Terrain {
  readonly hf = new Float32Array(NW * NH);
  readonly group = new THREE.Group();
  readonly tiles: THREE.DataTexture;
  readonly paths: THREE.DataTexture;
  readonly coast: THREE.DataTexture;
  readonly uniforms = {
    uGrassA: { value: new THREE.Color(0x8fd46a) },
    uGrassB: { value: new THREE.Color(0x79c257) },
    uSnow: { value: 0 },
  };
  /** Path type per tile (0 none). */
  readonly path = new Uint8Array(W * H);

  constructor(
    readonly I: Island,
    readonly stage: Stage,
  ) {
    this.tiles = this.tileTexture();
    this.paths = new THREE.DataTexture(new Uint8Array(W * H * 4), W, H, THREE.RGBAFormat);
    this.paths.minFilter = this.paths.magFilter = THREE.LinearFilter;
    this.paths.needsUpdate = true;
    this.coast = this.coastTexture();
    this.buildHeights();
    this.group.add(this.groundMesh(), this.seaMesh(), this.waterMesh(), ...this.fallMeshes());
  }

  // ---------------------------------------------------------------- data

  private tileTexture(): THREE.DataTexture {
    const I = this.I;
    const d = new Uint8Array(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      const k = I.kind[i];
      d[i * 4] = k === K.Sand || k === K.Sea || k === K.Pier || k === K.Rock ? 255 : 0;
      d[i * 4 + 1] = k === K.River || k === K.Pond ? 255 : 0;
      d[i * 4 + 2] = k === K.Rock ? 255 : 0;
      d[i * 4 + 3] = I.tier[i] * 120;
    }
    const t = new THREE.DataTexture(d, W, H, THREE.RGBAFormat);
    t.minFilter = t.magFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  }

  private coastTexture(): THREE.DataTexture {
    const I = this.I;
    const sea = (i: number) => I.kind[i] === K.Sea || I.kind[i] === K.Pier;
    const landD = edt((i) => !sea(i));
    const d = new Uint8Array(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      d[i * 4] = Math.min(255, landD[i] * 20);
      d[i * 4 + 1] = Math.min(255, I.seaDist[i] * 30);
    }
    const t = new THREE.DataTexture(d, W, H, THREE.RGBAFormat);
    t.minFilter = t.magFilter = THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    return t;
  }

  /** Signed distance (tiles, inside positive) at fine cell centres, blurred to round corners. */
  private sdf(mask: (i: number) => boolean, blur: number): Float32Array {
    const FW = W * S;
    const FH = H * S;
    const inM = (c: number) => mask(idx(Math.floor((c % FW) / S), Math.floor(Math.floor(c / FW) / S)));
    const dIn = edt((c) => inM(c), FW, FH);
    const dOut = edt((c) => !inM(c), FW, FH);
    const sd = new Float32Array(FW * FH);
    for (let c = 0; c < FW * FH; c++) sd[c] = (inM(c) ? dOut[c] - 0.5 : -(dIn[c] - 0.5)) / S;
    if (blur > 0) {
      const r = Math.ceil(blur * 2);
      const k: number[] = [];
      let ks = 0;
      for (let i = -r; i <= r; i++) {
        const v = Math.exp(-(i * i) / (2 * blur * blur));
        k.push(v);
        ks += v;
      }
      const tmp = new Float32Array(FW * FH);
      for (let z = 0; z < FH; z++)
        for (let x = 0; x < FW; x++) {
          let s = 0;
          for (let i = -r; i <= r; i++) s += sd[z * FW + Math.min(FW - 1, Math.max(0, x + i))] * k[i + r];
          tmp[z * FW + x] = s / ks;
        }
      for (let z = 0; z < FH; z++)
        for (let x = 0; x < FW; x++) {
          let s = 0;
          for (let i = -r; i <= r; i++) s += tmp[Math.min(FH - 1, Math.max(0, z + i)) * FW + x] * k[i + r];
          sd[z * FW + x] = s / ks;
        }
    }
    return sd;
  }

  /** Average the four fine cells round a vertex. */
  private atVert(sd: Float32Array, i: number, j: number): number {
    const FW = W * S;
    const FH = H * S;
    let s = 0;
    let n = 0;
    for (const [a, b] of [
      [i - 1, j - 1],
      [i, j - 1],
      [i - 1, j],
      [i, j],
    ]) {
      if (a < 0 || b < 0 || a >= FW || b >= FH) continue;
      s += sd[b * FW + a];
      n++;
    }
    return s / n;
  }

  private buildHeights(): void {
    const I = this.I;
    const N = new Noise(I.seed + 5);
    const land = this.sdf((i) => I.kind[i] !== K.Sea && I.kind[i] !== K.Pier, 1.2);
    const t1 = this.sdf((i) => I.tier[i] >= 1, 1.6);
    const t2 = this.sdf((i) => I.tier[i] >= 2, 1.6);
    const wet = this.sdf((i) => I.kind[i] === K.River || I.kind[i] === K.Pond, 1.4);
    const cliff = (s: number) => {
      const t = Math.min(1, Math.max(0, (s + 0.12) / 0.22));
      return t * t * (3 - 2 * t);
    };
    for (let j = 0; j < NH; j++)
      for (let i = 0; i < NW; i++) {
        const x = i / S;
        const z = j / S;
        const L = this.atVert(land, i, j);
        const wob = N.n2(x * 1.7, z * 1.7) * 0.05 + N.n2(x * 0.5 + 9, z * 0.5) * 0.04;
        let y: number;
        if (L >= 0) y = -0.3 + 0.3 * Math.min(1, L / 2.6) ** 0.8;
        else y = -0.3 - 1.5 * Math.min(1, -L / 5) + N.n2(x * 0.3, z * 0.3) * 0.15;
        y += TIER_H * cliff(this.atVert(t1, i, j) + wob) + TIER_H * cliff(this.atVert(t2, i, j) + wob);
        const w = this.atVert(wet, i, j);
        y -= 0.72 * Math.min(1, Math.max(0, (w + 0.02) / 0.4));
        // Ramps: a sloped block on the low side.
        for (const r of I.ramps) {
          if (x < r.x - 0.001 || z < r.z - 0.001 || x > r.x + r.w + 0.001 || z > r.z + r.l + 0.001) continue;
          const q = rampAt(I, Math.min(r.x + r.w - 1e-4, x), Math.min(r.z + r.l - 1e-4, z));
          if (q) y = Math.max(y, (r.low + q.t) * TIER_H);
        }
        this.hf[j * NW + i] = y;
      }
  }

  /** Mesh height (visual) by bilinear lookup. */
  heightAt(x: number, z: number): number {
    const fx = Math.min(NW - 1.001, Math.max(0, x * S));
    const fz = Math.min(NH - 1.001, Math.max(0, z * S));
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const v = fz - j;
    const h = this.hf;
    return (h[j * NW + i] * (1 - u) + h[j * NW + i + 1] * u) * (1 - v) + (h[(j + 1) * NW + i] * (1 - u) + h[(j + 1) * NW + i + 1] * u) * v;
  }

  /** Where feet stand: the tile's tier, a ramp's slope, a bridge deck, the pier. */
  groundY(x: number, z: number): number {
    const I = this.I;
    const r = rampAt(I, x, z);
    if (r) return (r.r.low + r.t) * TIER_H;
    const b = bridgeAt(I, x, z);
    if (b) return b.tier * TIER_H + 0.06;
    const tx = Math.floor(x);
    const tz = Math.floor(z);
    if (!inside(tx, tz)) return SEA_Y;
    const i = idx(tx, tz);
    const k = I.kind[i];
    if (k === K.Pier) return 0.12;
    if (k === K.Sand) return Math.max(this.heightAt(x, z), -0.28);
    return I.tier[i] * TIER_H;
  }

  setPath(x: number, z: number, type: number): void {
    const i = idx(x, z);
    this.path[i] = type;
    const d = this.paths.image.data as Uint8Array;
    for (let c = 0; c < 4; c++) d[i * 4 + c] = type === c + 1 ? 255 : 0;
    this.paths.needsUpdate = true;
  }

  // ---------------------------------------------------------------- meshes

  private groundMesh(): THREE.Mesh {
    const pos = new Float32Array(NW * NH * 3);
    const nor = new Float32Array(NW * NH * 3);
    for (let j = 0; j < NH; j++)
      for (let i = 0; i < NW; i++) {
        const k = j * NW + i;
        pos[k * 3] = i / S;
        pos[k * 3 + 1] = this.hf[k];
        pos[k * 3 + 2] = j / S;
        const hl = this.hf[j * NW + Math.max(0, i - 1)];
        const hr = this.hf[j * NW + Math.min(NW - 1, i + 1)];
        const hd = this.hf[Math.max(0, j - 1) * NW + i];
        const hu = this.hf[Math.min(NH - 1, j + 1) * NW + i];
        const n = new THREE.Vector3(hl - hr, 2 / S, hd - hu).normalize();
        nor.set([n.x, n.y, n.z], k * 3);
      }
    const idxs = new Uint32Array((NW - 1) * (NH - 1) * 6);
    let o = 0;
    for (let j = 0; j < NH - 1; j++)
      for (let i = 0; i < NW - 1; i++) {
        const a = j * NW + i;
        const b = a + 1;
        const c = a + NW;
        const d = c + 1;
        // Split along the flatter diagonal so cliff tops stay crisp.
        if (Math.abs(this.hf[a] - this.hf[d]) < Math.abs(this.hf[b] - this.hf[c])) idxs.set([a, c, d, a, d, b], o);
        else idxs.set([a, c, b, b, c, d], o);
        o += 6;
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    g.setIndex(new THREE.BufferAttribute(idxs, 1));
    const m = mat(0xffffff, { rim: 0.05 });
    const u = this.uniforms;
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = (sh, r) => {
      prev(sh, r);
      Object.assign(sh.uniforms, u, { uTiles: { value: this.tiles }, uPaths: { value: this.paths }, uCoast: { value: this.coast }, uTime: this.stage.time });
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWPos; varying vec3 vWN;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);");
      sh.fragmentShader = sh.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          varying vec3 vWPos; varying vec3 vWN;
          uniform sampler2D uTiles, uPaths, uCoast; uniform vec3 uGrassA, uGrassB; uniform float uSnow, uTime;
          ${GLSL_NOISE}`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          {
            vec2 tuv = vWPos.xz / vec2(${W}.0, ${H}.0);
            vec4 T = texture2D(uTiles, tuv);
            float n = vnoise(vWPos.xz * 1.3);
            float n2 = fbm2(vWPos.xz * 0.11);
            float up = vWN.y;
            // Grass: two tones in broad patches, and a scatter of little blade marks (a light
            // tip over a dark stroke) on a jittered grid, the way painted lawns look.
            vec3 grass = mix(uGrassA, uGrassB, smoothstep(0.35, 0.7, n2));
            grass *= 0.96 + 0.08 * vnoise(vWPos.xz * 0.45 + 7.0);
            vec2 tc = vWPos.xz * 2.6;
            vec2 cell = floor(tc);
            vec2 jit = vec2(hash12(cell), hash12(cell + 17.3)) - 0.5;
            vec2 tf = fract(tc) - 0.5 - jit * 0.5;
            float th = hash12(cell + 3.1);
            float blade = step(0.45, th) * (1.0 - smoothstep(0.035, 0.06, abs(tf.x + tf.y * 0.28))) * (1.0 - smoothstep(0.06, 0.2, abs(tf.y)));
            float tip = step(0.45, th) * (1.0 - smoothstep(0.03, 0.05, abs(tf.x + (tf.y + 0.08) * 0.28))) * (1.0 - smoothstep(0.02, 0.07, abs(tf.y + 0.12)));
            grass *= 1.0 - blade * 0.16;
            grass = mix(grass, grass * 1.18 + 0.02, tip * 0.6);
            float sandM = smoothstep(0.45, 0.58, T.r + (n - 0.5) * 0.3);
            float wetSand = 1.0 - smoothstep(0.0, 0.35, texture2D(uCoast, tuv).g * 8.0 / 30.0 * 3.0);
            vec3 sand = mix(vec3(0.96, 0.89, 0.70), vec3(0.93, 0.84, 0.64), n);
            sand = mix(sand, vec3(0.80, 0.72, 0.56), wetSand * 0.6);
            vec3 col = mix(grass, sand, sandM);
            // Paths the player laid.
            vec4 P = texture2D(uPaths, tuv);
            float pe = (n - 0.5) * 0.25;
            col = mix(col, mix(vec3(0.72, 0.58, 0.42), vec3(0.66, 0.52, 0.38), n), smoothstep(0.42, 0.55, P.r + pe));
            vec2 sg = fract(vWPos.xz * 1.6) - 0.5;
            float stoneMask = smoothstep(0.42, 0.55, P.g + pe);
            vec3 stone = mix(vec3(0.72, 0.72, 0.70), vec3(0.62, 0.62, 0.60), hash12(floor(vWPos.xz * 1.6)));
            stone *= 1.0 - smoothstep(0.38, 0.47, max(abs(sg.x), abs(sg.y))) * 0.25;
            col = mix(col, stone, stoneMask);
            vec2 bg = vec2(vWPos.x * 2.0 + step(0.5, fract(vWPos.z * 4.0)) * 0.5, vWPos.z * 4.0);
            vec3 brick = vec3(0.72, 0.36, 0.28) * (0.9 + 0.1 * hash12(floor(bg)));
            brick *= 1.0 - smoothstep(0.42, 0.5, max(abs(fract(bg.x) - 0.5), abs(fract(bg.y) - 0.5))) * 0.3;
            col = mix(col, brick, smoothstep(0.42, 0.55, P.b + pe));
            vec3 plank = vec3(0.62, 0.45, 0.30) * (0.88 + 0.12 * hash12(vec2(floor(vWPos.x * 3.0), 0.0)));
            plank *= 1.0 - smoothstep(0.44, 0.5, abs(fract(vWPos.x * 3.0) - 0.5)) * 0.3;
            col = mix(col, plank, smoothstep(0.42, 0.55, P.a + pe));
            // Cliffs: layered earth and stone, lighter under the lip, darker at the foot, and a
            // lighter rim of grass where the top rolls over the edge.
            float cl = 1.0 - smoothstep(0.42, 0.7, up);
            float lvl = fract((vWPos.y + 0.02) / ${TIER_H.toFixed(3)});
            float band = step(0.5, fract(vWPos.y * 2.4 + n * 0.5));
            vec3 rock = mix(vec3(0.66, 0.53, 0.42), vec3(0.56, 0.45, 0.36), band) * (0.92 + 0.08 * n);
            rock *= mix(0.78, 1.08, smoothstep(0.0, 0.85, lvl));
            rock = mix(rock, rock * 0.8, smoothstep(0.8, 0.96, lvl));
            col = mix(col, rock, cl);
            float lip = smoothstep(0.62, 0.72, up) * (1.0 - smoothstep(0.85, 0.95, up));
            col = mix(col, col * 1.12 + vec3(0.03, 0.04, 0.0), lip * (1.0 - sandM) * 0.8);
            // River and pond banks: damp earth down to the water.
            float bank = smoothstep(0.08, 0.35, T.g) * (1.0 - smoothstep(0.55, 0.85, up)) * (1.0 - cl * 0.5);
            col = mix(col, vec3(0.55, 0.47, 0.36) * (0.9 + 0.2 * n), bank * 0.85);
            // Under water: a pale bed.
            float bed = smoothstep(0.35, 0.7, T.g) * smoothstep(0.15, -0.25, vWPos.y - floor(vWPos.y + 0.5));
            col = mix(col, vec3(0.62, 0.66, 0.55), bed * 0.7);
            float seaBed = smoothstep(-0.25, -0.45, vWPos.y) * (1.0 - smoothstep(0.3, 0.7, T.g));
            col = mix(col, vec3(0.78, 0.74, 0.58), seaBed);
            // Rocky shore: grey stone.
            col = mix(col, vec3(0.55, 0.55, 0.56) * (0.85 + 0.2 * n), smoothstep(0.4, 0.7, T.b));
            // Snow settles on what faces up.
            col = mix(col, vec3(0.95, 0.97, 1.0), uSnow * smoothstep(0.6, 0.85, up) * (1.0 - bed) * smoothstep(0.3, 0.6, 1.0 - T.g));
            diffuseColor.rgb = col;
          }`,
        );
    };
    m.customProgramCacheKey = () => "ground";
    const mesh = new THREE.Mesh(g, m);
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    return mesh;
  }

  private seaMesh(): THREE.Mesh {
    const g = new THREE.PlaneGeometry(700, 700, 70, 70);
    g.rotateX(-Math.PI / 2);
    g.translate(W / 2, SEA_Y, H / 2);
    const m = new THREE.ShaderMaterial({
      transparent: true,
      fog: true,
      uniforms: { uCoast: { value: this.coast }, uTime: this.stage.time, uSun: { value: this.stage.sunDir }, uNight: this.stage.night, ...THREE.UniformsLib.fog },
      vertexShader: /* glsl */ `
        #include <common>
        #include <fog_pars_vertex>
        varying vec3 vW;
        void main() {
          vec3 transformed = position;
          vW = (modelMatrix * vec4(position, 1.0)).xyz;
          
          #include <project_vertex>
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        #include <common>
        #include <fog_pars_fragment>
        uniform sampler2D uCoast; uniform float uTime, uNight; uniform vec3 uSun; varying vec3 vW;
        ${GLSL_NOISE}
        void main() {
          vec2 tuv = vW.xz / vec2(${W}.0, ${H}.0);
          bool inMap = tuv.x > 0.0 && tuv.y > 0.0 && tuv.x < 1.0 && tuv.y < 1.0;
          float d = inMap ? texture2D(uCoast, tuv).r * 255.0 / 20.0 : 20.0;
          vec3 shallow = vec3(0.35, 0.85, 0.82);
          vec3 deep = vec3(0.10, 0.45, 0.72);
          vec3 c = mix(shallow, deep, smoothstep(0.5, 7.0, d));
          float w = vnoise(vW.xz * 0.9 + vec2(uTime * 0.25, uTime * 0.1)) * vnoise(vW.xz * 1.7 - vec2(uTime * 0.2, 0.0));
          c += vec3(0.9) * smoothstep(0.42, 0.5, w) * 0.25;
          // Surf: bands rolling in toward the beach.
          float band = sin(d * 5.0 - uTime * 1.6 + vnoise(vW.xz * 0.5) * 3.0);
          float foam = smoothstep(0.75, 0.95, band) * (1.0 - smoothstep(0.3, 1.6, d)) + (1.0 - smoothstep(0.0, 0.35, d));
          c = mix(c, vec3(1.0), clamp(foam, 0.0, 1.0) * 0.85);
          c *= mix(1.0, 0.3, uNight);
          float a = mix(0.62, 0.92, smoothstep(0.2, 3.0, d));
          gl_FragColor = vec4(c, max(a, foam * 0.9));
          #include <fog_fragment>
        }`,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    return mesh;
  }

  private waterMesh(): THREE.Mesh {
    const I = this.I;
    const pos: number[] = [];
    const ids: number[] = [];
    const wetT = (x: number, z: number, t: number) => inside(x, z) && (I.kind[idx(x, z)] === K.River || I.kind[idx(x, z)] === K.Pond) && I.tier[idx(x, z)] === t;
    for (let z = 0; z < H; z++)
      for (let x = 0; x < W; x++) {
        const i = idx(x, z);
        const k = I.kind[i];
        if (k !== K.River && k !== K.Pond) continue;
        const t = I.tier[i];
        const y = t * TIER_H - WATER_DROP;
        const e = (dx: number, dz: number) => {
          if (wetT(x + dx, z + dz, t)) return 0;
          // Toward the sea or a lower tier's water: meet it; toward land: tuck under the bank.
          if (inside(x + dx, z + dz) && I.kind[idx(x + dx, z + dz)] === K.Sea) return 0.6;
          return 0.12;
        };
        const x0 = x - e(-1, 0);
        const x1 = x + 1 + e(1, 0);
        const z0 = z - e(0, -1);
        const z1 = z + 1 + e(0, 1);
        const b = pos.length / 3;
        pos.push(x0, y, z0, x1, y, z0, x0, y, z1, x1, y, z1);
        ids.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(ids);
    const m = new THREE.ShaderMaterial({
      transparent: true,
      fog: true,
      depthWrite: false,
      uniforms: { uTiles: { value: this.tiles }, uTime: this.stage.time, uNight: this.stage.night, ...THREE.UniformsLib.fog },
      vertexShader: /* glsl */ `
        #include <common>
        #include <fog_pars_vertex>
        varying vec3 vW;
        void main() {
          vec3 transformed = position;
          vW = (modelMatrix * vec4(position, 1.0)).xyz;
          
          #include <project_vertex>
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        #include <common>
        #include <fog_pars_fragment>
        uniform sampler2D uTiles; uniform float uTime, uNight; varying vec3 vW;
        ${GLSL_NOISE}
        void main() {
          vec2 tuv = vW.xz / vec2(${W}.0, ${H}.0);
          float wet = texture2D(uTiles, tuv).g;
          vec3 c = mix(vec3(0.38, 0.76, 0.86), vec3(0.18, 0.54, 0.78), smoothstep(0.6, 1.0, wet));
          float r = vnoise(vW.xz * 2.2 + vec2(uTime * 0.6, uTime * 0.35)) * vnoise(vW.xz * 3.1 - vec2(uTime * 0.4, -uTime * 0.2));
          c += vec3(0.85, 0.95, 1.0) * smoothstep(0.34, 0.42, r) * 0.22;
          float edge = 1.0 - smoothstep(0.55, 0.85, wet + (vnoise(vW.xz * 4.0 + uTime) - 0.5) * 0.2);
          c = mix(c, vec3(0.92, 0.98, 1.0), edge * 0.45);
          c *= mix(1.0, 0.3, uNight);
          gl_FragColor = vec4(c, 0.8 + edge * 0.15);
          #include <fog_fragment>
        }`,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    return mesh;
  }

  private fallMeshes(): THREE.Object3D[] {
    const I = this.I;
    const out: THREE.Object3D[] = [];
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uTime: this.stage.time, uNight: this.stage.night },
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; vec3 transformed = position; 
        #include <project_vertex>
      }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uNight; varying vec2 vUv;
        ${GLSL_NOISE}
        void main() {
          float s = vnoise(vec2(vUv.x * 14.0, vUv.y * 3.0 + uTime * 3.5));
          vec3 c = mix(vec3(0.55, 0.85, 0.95), vec3(1.0), smoothstep(0.45, 0.75, s));
          c = mix(c, vec3(1.0), smoothstep(0.75, 1.0, vUv.y) * 0.6 + smoothstep(0.25, 0.0, vUv.y) * 0.8);
          c *= mix(1.0, 0.35, uNight);
          gl_FragColor = vec4(c, 0.92);
        }`,
    });
    const seen = new Set<string>();
    for (const f of I.falls) {
      const px = -DZ[f.dir];
      const pz = DX[f.dir];
      // The full width of water crossing this edge.
      let a = 0;
      let b = 0;
      const crosses = (k: number) => {
        const x = f.x + px * k;
        const z = f.z + pz * k;
        const nx = x + DX[f.dir];
        const nz = z + DZ[f.dir];
        return inside(nx, nz) && I.kind[idx(x, z)] === K.River && I.tier[idx(x, z)] === f.tier && I.kind[idx(nx, nz)] === K.River && I.tier[idx(nx, nz)] < f.tier;
      };
      while (crosses(a - 1)) a--;
      while (crosses(b + 1)) b++;
      const key = `${f.x + px * a},${f.z + pz * a},${f.dir}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const width = b - a + 1;
      const yTop = f.tier * TIER_H - WATER_DROP;
      const yBot = (f.tier - 1) * TIER_H - WATER_DROP;
      const g = new THREE.PlaneGeometry(width + 0.3, 1, 1, 8);
      const p = g.attributes.position as THREE.BufferAttribute;
      const uv = g.attributes.uv as THREE.BufferAttribute;
      for (let v = 0; v < p.count; v++) {
        const t = uv.getY(v); // 1 at top
        const drop = 1 - t;
        p.setXYZ(v, p.getX(v), yBot + (yTop - yBot) * t, Math.sin(drop * Math.PI * 0.5) * 0.35 + 0.02);
      }
      g.computeVertexNormals();
      const mesh = new THREE.Mesh(g, m);
      // Edge line between the two tiles, centred across the span.
      const ex = f.x + 0.5 + DX[f.dir] * 0.5 + px * ((a + b) / 2);
      const ez = f.z + 0.5 + DZ[f.dir] * 0.5 + pz * ((a + b) / 2);
      mesh.position.set(ex, 0, ez);
      mesh.rotation.y = Math.atan2(DX[f.dir], DZ[f.dir]);
      mesh.frustumCulled = false;
      mesh.renderOrder = 3;
      out.push(mesh);
      // Spray at the foot.
      const spray = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }));
      for (let k = 0; k < width; k++) {
        const s = spray.clone();
        s.position.set(ex + px * (k - (width - 1) / 2) + DX[f.dir] * 0.45, yBot + 0.05, ez + pz * (k - (width - 1) / 2) + DZ[f.dir] * 0.45);
        s.scale.set(1.2, 0.5, 1.2);
        s.userData.spray = k;
        out.push(s);
      }
    }
    return out;
  }

  /** Seasonal grass colours through the year (t = 0 Jan 1). */
  setSeason(yearT: number, snow: number): void {
    const keys: [number, number, number][] = [
      [0.0, 0x9ab87a, 0x86a86a],
      [0.2, 0x8ed26a, 0x72c055],
      [0.35, 0x7ccf5a, 0x5db84a],
      [0.6, 0x5cc050, 0x43a842],
      [0.75, 0x8ec05a, 0x70a84a],
      [0.85, 0xb8b060, 0x98984c],
      [1.0, 0x9ab87a, 0x86a86a],
    ];
    for (let k = 0; k < keys.length - 1; k++)
      if (yearT >= keys[k][0] && yearT <= keys[k + 1][0]) {
        const t = (yearT - keys[k][0]) / (keys[k + 1][0] - keys[k][0]);
        this.uniforms.uGrassA.value.set(keys[k][1]).lerp(new THREE.Color(keys[k + 1][1]), t);
        this.uniforms.uGrassB.value.set(keys[k][2]).lerp(new THREE.Color(keys[k + 1][2]), t);
      }
    this.uniforms.uSnow.value = snow;
  }

  update(t: number): void {
    for (const o of this.group.children)
      if (o.userData.spray !== undefined) {
        const s = 1 + Math.sin(t * 6 + o.userData.spray * 1.7) * 0.15;
        o.scale.set(1.2 * s, 0.5 * s, 1.2 * s);
      }
  }
}
