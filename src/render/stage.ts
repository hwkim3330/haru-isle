/**
 * Renderer, scene and camera, and the look: soft toon light that follows the hour (warm
 * mornings, white noon, orange dusk, blue nights), a painted sky dome with a sun, moon and
 * stars, the "rolling log" curve (the ground falls away beyond the player, so the horizon
 * bends like a drum), and a tilt-shift blur that keeps a band round the player sharp.
 */
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

/** Distance from the camera where the ground starts to curve away, and how hard. */
export const CURVE = { start: 16, k: 0.011 };

// Every material bends through this chunk, but only for the perspective (player) camera: the
// sun's orthographic shadow pass stays flat, and shadow lookups use the unbent world position,
// so shadows stay glued to what casts them.
const NOCURVE = typeof location !== "undefined" && location.search.includes("nocurve");
if (!NOCURVE) THREE.ShaderChunk.project_vertex = THREE.ShaderChunk.project_vertex.replace(
  "gl_Position = projectionMatrix * mvPosition;",
  `if (projectionMatrix[3][3] < 0.5) { float cd = max(0.0, -mvPosition.z - ${CURVE.start.toFixed(1)}); mvPosition.y -= cd * cd * ${CURVE.k.toFixed(5)}; }
  gl_Position = projectionMatrix * mvPosition;`,
);

/** Where the player stands: things between them and the camera dissolve (see occluder()). */
export const PLAYER_U = { value: new THREE.Vector3(0, -99, 0) };

/**
 * Make a material dissolve where it hides the player: fragments above the player's feet, a
 * little nearer the camera (south), within a narrow column, are dithered away.
 */
export function occluder(m: THREE.Material): void {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r);
    sh.uniforms.uPlayer = PLAYER_U;
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vOccW;").replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\n{ vec4 wp = vec4(transformed, 1.0);\n #ifdef USE_INSTANCING\n wp = instanceMatrix * wp;\n #endif\n vOccW = (modelMatrix * wp).xyz; }");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vOccW; uniform vec3 uPlayer;").replace(
      "#include <clipping_planes_fragment>",
      `#include <clipping_planes_fragment>
      {
        vec3 d = vOccW - uPlayer;
        float k = smoothstep(1.6, 0.9, abs(d.x)) * smoothstep(0.2, 0.8, d.z) * smoothstep(4.5, 3.0, d.z) * smoothstep(0.6, 1.1, d.y);
        vec2 px = floor(gl_FragCoord.xy);
        float dither = fract(dot(px, vec2(0.5, 0.25)) + fract(px.y * 0.5) * 0.5);
        if (k * 0.8 > dither) discard;
      }`,
    );
  };
  const key = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => key() + "occ";
}

/** A soft four-step ramp: the toon look, but gentle. */
function ramp(): THREE.DataTexture {
  const v = [110, 170, 225, 255];
  const d = new Uint8Array(v.length * 4);
  v.forEach((x, i) => d.set([x, x, x, 255], i * 4));
  const t = new THREE.DataTexture(d, v.length, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}
export const RAMP = ramp();

/** The house material: toon-shaded, cool shade tint, soft rim. */
export function mat(color: number | THREE.Color, o: { map?: THREE.Texture; emissive?: number; transparent?: boolean; side?: THREE.Side; vertexColors?: boolean; rim?: number } = {}): THREE.MeshToonMaterial {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: RAMP, map: o.map ?? null, transparent: o.transparent ?? false, side: o.side ?? THREE.FrontSide, vertexColors: o.vertexColors ?? false });
  if (o.emissive) m.emissive = new THREE.Color(o.emissive);
  const rim = o.rim ?? 0.18;
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      "#include <opaque_fragment>",
      `{ vec3 V = normalize(vViewPosition); float r = pow(1.0 - clamp(dot(normal, V), 0.0, 1.0), 3.0);
         outgoingLight += diffuseColor.rgb * r * ${rim.toFixed(2)}; }
       #include <opaque_fragment>`,
    );
  };
  m.customProgramCacheKey = () => `mat${rim}`;
  return m;
}

interface Sky {
  top: THREE.Color;
  mid: THREE.Color;
  bot: THREE.Color;
  sun: THREE.Color;
  sunI: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiI: number;
}

const C = (h: number) => new THREE.Color(h);
/** Key hours of the day and their light. */
const KEYS: [number, Sky][] = [
  [0, { top: C(0x0a1030), mid: C(0x1a2a5a), bot: C(0x2a3a6a), sun: C(0x8a9ad8), sunI: 0.7, hemiSky: C(0x5a6aa8), hemiGround: C(0x2a3040), hemiI: 1.25 }],
  [5, { top: C(0x1a2050), mid: C(0x4a4a8a), bot: C(0xc08aa0), sun: C(0xffb080), sunI: 0.6, hemiSky: C(0x6a6aa0), hemiGround: C(0x3a3040), hemiI: 1.0 }],
  [7, { top: C(0x5aa0e8), mid: C(0x9ad0f0), bot: C(0xffd8b0), sun: C(0xffe0b0), sunI: 1.9, hemiSky: C(0xbad8ff), hemiGround: C(0x8a8060), hemiI: 1.25 }],
  [12, { top: C(0x3a8ae8), mid: C(0x80c0f8), bot: C(0xd8f0ff), sun: C(0xfff6e8), sunI: 2.5, hemiSky: C(0xd0e8ff), hemiGround: C(0x90a070), hemiI: 1.35 }],
  [16, { top: C(0x4a90e0), mid: C(0x90c8f0), bot: C(0xffe8c8), sun: C(0xffe8c0), sunI: 2.2, hemiSky: C(0xd0e0ff), hemiGround: C(0x9a9060), hemiI: 1.3 }],
  [18.3, { top: C(0x3a5ab0), mid: C(0xe89070), bot: C(0xffc070), sun: C(0xffa060), sunI: 1.6, hemiSky: C(0xc0a0c0), hemiGround: C(0x7a5a40), hemiI: 1.1 }],
  [19.6, { top: C(0x1a2a6a), mid: C(0x5a4a8a), bot: C(0xa06a8a), sun: C(0x9aa0d8), sunI: 0.8, hemiSky: C(0x6a6aa8), hemiGround: C(0x3a3040), hemiI: 1.2 }],
  [21, { top: C(0x0a1030), mid: C(0x1a2a5a), bot: C(0x2a3a6a), sun: C(0x8a9ad8), sunI: 0.7, hemiSky: C(0x5a6aa8), hemiGround: C(0x2a3040), hemiI: 1.25 }],
];

function skyAt(h: number): Sky {
  let a = KEYS[KEYS.length - 1];
  let b = KEYS[0];
  for (let k = 0; k < KEYS.length; k++) {
    const nx = KEYS[(k + 1) % KEYS.length];
    const t1 = k + 1 < KEYS.length ? nx[0] : 24;
    if (h >= KEYS[k][0] && h < t1) {
      a = KEYS[k];
      b = [t1, nx[1]];
      break;
    }
  }
  const t = (h - a[0]) / Math.max(1e-3, b[0] - a[0]);
  const s = t * t * (3 - 2 * t);
  const L = (x: THREE.Color, y: THREE.Color) => x.clone().lerp(y, s);
  const A = a[1];
  const B = b[1];
  return { top: L(A.top, B.top), mid: L(A.mid, B.mid), bot: L(A.bot, B.bot), sun: L(A.sun, B.sun), sunI: A.sunI + (B.sunI - A.sunI) * s, hemiSky: L(A.hemiSky, B.hemiSky), hemiGround: L(A.hemiGround, B.hemiGround), hemiI: A.hemiI + (B.hemiI - A.hemiI) * s };
}

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 1, 0.5, 600);
  readonly sun = new THREE.DirectionalLight(0xffffff, 2.4);
  readonly hemi = new THREE.HemisphereLight(0xd0e8ff, 0x90a070, 1.3);
  readonly time = { value: 0 };
  /** 0 day … 1 night, for lamps and windows. */
  readonly night = { value: 0 };
  readonly weather = { value: 0 };
  private readonly composer: EffectComposer;
  private readonly skyU: Record<string, THREE.IUniform>;
  private readonly tilt: ShaderPass[] = [];
  readonly sunDir = new THREE.Vector3(0.4, 0.8, 0.35).normalize();
  /** Where the camera looks (the player), and how far back it sits. */
  readonly focus = new THREE.Vector3();
  zoom = 1;
  camYaw = 0;
  private camPos = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.NeutralToneMapping;
    this.renderer = r;
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -34;
    sc.right = sc.top = 34;
    sc.near = 1;
    sc.far = 160;
    sc.updateProjectionMatrix();
    this.scene.add(this.sun, this.sun.target, this.hemi);
    this.scene.fog = new THREE.Fog(0xd8f0ff, 60, 170);
    this.skyU = {
      uTop: { value: new THREE.Color() },
      uMid: { value: new THREE.Color() },
      uBot: { value: new THREE.Color() },
      uSun: { value: this.sunDir },
      uNight: this.night,
      uTime: this.time,
    };
    this.scene.add(this.makeSky());
    const size = new THREE.Vector2(window.innerWidth, window.innerHeight);
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(r, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    for (const dir of [
      [1, 0],
      [0, 1],
    ]) {
      const p = new ShaderPass(TILT);
      p.uniforms.uDir.value = new THREE.Vector2(dir[0], dir[1]);
      this.tilt.push(p);
      this.composer.addPass(p);
    }
    const grade = new ShaderPass(GRADE);
    this.composer.addPass(grade);
    this.composer.addPass(new OutputPass());
    window.addEventListener("resize", () => this.resize());
    this.resize();
  }

  private makeSky(): THREE.Mesh {
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: this.skyU,
      vertexShader: /* glsl */ `varying vec3 vDir; void main() { vDir = normalize(position); vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0); gl_Position = p.xyww; }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop, uMid, uBot, uSun; uniform float uNight, uTime; varying vec3 vDir;
        float h21(vec2 p) { p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
        void main() {
          vec3 d = normalize(vDir);
          float y = d.y;
          vec3 c = y > 0.12 ? mix(uMid, uTop, smoothstep(0.12, 0.7, y)) : mix(uBot, uMid, smoothstep(-0.1, 0.12, y));
          float s = max(0.0, dot(d, normalize(uSun)));
          c += vec3(1.0, 0.9, 0.7) * (smoothstep(0.9975, 0.999, s) * 1.2 + pow(s, 24.0) * 0.25) * (1.0 - uNight);
          // Moon opposite the sun at night, and stars.
          float m = max(0.0, dot(d, normalize(vec3(-uSun.x, abs(uSun.y) + 0.3, -uSun.z))));
          c += vec3(0.9, 0.95, 1.0) * smoothstep(0.9985, 0.9992, m) * uNight;
          vec2 g = vec2(atan(d.z, d.x) * 60.0, y * 90.0);
          float st = step(0.985, h21(floor(g))) * smoothstep(0.1, 0.4, y) * (0.6 + 0.4 * sin(uTime * 2.0 + h21(floor(g)) * 40.0));
          c += vec3(st) * uNight;
          // Soft clouds.
          vec2 q = d.xz / max(0.15, y) * 0.8 + vec2(uTime * 0.004, 0.0);
          float cl = smoothstep(0.55, 0.8, fract(sin(dot(floor(q * 2.0), vec2(12.9, 78.2))) * 43758.5) * 0.0 + (sin(q.x * 3.1) * sin(q.y * 2.3 + q.x) * 0.5 + 0.5) * (sin(q.x * 7.3 + 1.0) * 0.25 + 0.75));
          c = mix(c, mix(vec3(1.0), uBot, 0.35), cl * smoothstep(0.03, 0.2, y) * 0.55);
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const s = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), m);
    s.frustumCulled = false;
    s.renderOrder = -10;
    return s;
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    for (const p of this.tilt) p.uniforms.uRes.value.set(w, h);
  }

  /** Light and sky for an hour of the day (0..24), with overcast 0..1. */
  setHour(h: number, overcast = 0): void {
    const s = skyAt(h);
    const grey = new THREE.Color(0x9aa4b0);
    const o = overcast;
    this.skyU.uTop.value.copy(s.top).lerp(grey, o * 0.7);
    this.skyU.uMid.value.copy(s.mid).lerp(grey, o * 0.7);
    this.skyU.uBot.value.copy(s.bot).lerp(grey, o * 0.6);
    this.sun.color.copy(s.sun);
    this.sun.intensity = s.sunI * (1 - o * 0.55);
    this.hemi.color.copy(s.hemiSky).lerp(grey, o * 0.5);
    this.hemi.groundColor.copy(s.hemiGround);
    this.hemi.intensity = s.hemiI;
    // The sun's arc: east at 6, high at noon, west at 18; the moon's light from the other side.
    const a = ((h - 6) / 12) * Math.PI;
    const day = h > 5.5 && h < 19.5;
    const ang = day ? a : a + Math.PI;
    this.sunDir.set(Math.cos(ang) * 0.9, 0.5 + Math.max(0, Math.sin(ang)) * 0.45, 0.62).normalize();
    this.night.value = h < 5 || h > 20.5 ? 1 : h < 7 ? 1 - (h - 5) / 2 : h > 18.5 ? (h - 18.5) / 2 : 0;
    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(this.skyU.uBot.value).lerp(this.skyU.uMid.value, 0.4);
  }

  /** Keep the camera behind and above the focus, easing after it. */
  updateCamera(dt: number): void {
    const dist = 15 * this.zoom;
    const pitch = 0.78;
    const back = new THREE.Vector3(Math.sin(this.camYaw), 0, Math.cos(this.camYaw));
    const want = this.focus.clone().addScaledVector(back, Math.cos(pitch) * dist).add(new THREE.Vector3(0, Math.sin(pitch) * dist, 0));
    if (this.camPos.lengthSq() === 0) this.camPos.copy(want);
    this.camPos.lerp(want, 1 - Math.exp(-dt * 6));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.focus.x, this.focus.y + 0.6, this.focus.z);
    // Sun shadow box on the focus, snapped to texels.
    const t = this.focus;
    const step = 68 / 2048;
    const sx = Math.round(t.x / step) * step;
    const sz = Math.round(t.z / step) * step;
    this.sun.target.position.set(sx, 0, sz);
    this.sun.position.set(sx + this.sunDir.x * 60, this.sunDir.y * 60, sz + this.sunDir.z * 60);
  }

  render(dt: number): void {
    this.time.value += dt;
    this.composer.render();
  }
}

/** Tilt-shift: a separable blur whose radius grows away from a sharp band round the focus. */
const TILT = {
  uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2(1, 0) }, uRes: { value: new THREE.Vector2(1, 1) } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform vec2 uDir, uRes; varying vec2 vUv;
    void main() {
      float y = vUv.y;
      float amt = smoothstep(0.66, 1.0, y) * 0.8 + smoothstep(0.14, 0.0, y) * 0.4;
      vec2 st = uDir / uRes * amt * 2.6;
      vec4 c = texture2D(tDiffuse, vUv) * 0.227;
      c += (texture2D(tDiffuse, vUv + st * 1.38) + texture2D(tDiffuse, vUv - st * 1.38)) * 0.316;
      c += (texture2D(tDiffuse, vUv + st * 3.23) + texture2D(tDiffuse, vUv - st * 3.23)) * 0.070;
      gl_FragColor = c;
    }`,
};

const GRADE = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 x = max(c.rgb, 0.0);
      if (any(isnan(x))) x = vec3(0.0);
      float l = dot(x, vec3(0.299, 0.587, 0.114));
      x = mix(vec3(l), x, 1.08);
      float v = smoothstep(1.25, 0.35, length(vUv - 0.5) * 1.3);
      x *= mix(0.86, 1.0, v);
      gl_FragColor = vec4(x, 1.0);
    }`,
};
