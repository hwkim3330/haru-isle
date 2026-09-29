/**
 * Little effects: dust puffs when running, leaves off a shaken tree, dirt from a shovel,
 * sparkles, splashes, hearts and music notes, a "!" over heads. Pooled sprites.
 */
import * as THREE from "three";

interface Bit {
  s: THREE.Sprite;
  v: THREE.Vector3;
  life: number;
  max: number;
  grav: number;
  spin: number;
  grow: number;
}

function tex(draw: (g: CanvasRenderingContext2D) => void): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const T = {
  puff: tex((g) => {
    const r = g.createRadialGradient(32, 32, 4, 32, 32, 30);
    r.addColorStop(0, "rgba(255,255,255,1)");
    r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
  }),
  leaf: tex((g) => {
    g.fillStyle = "#6ab848";
    g.beginPath();
    g.ellipse(32, 32, 26, 12, 0.6, 0, Math.PI * 2);
    g.fill();
  }),
  spark: tex((g) => {
    g.fillStyle = "#fff6c0";
    g.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const r = k % 2 ? 10 : 30;
      g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
    }
    g.fill();
  }),
  heart: tex((g) => {
    g.fillStyle = "#ff6a8a";
    g.beginPath();
    g.moveTo(32, 54);
    g.bezierCurveTo(4, 34, 10, 8, 32, 22);
    g.bezierCurveTo(54, 8, 60, 34, 32, 54);
    g.fill();
  }),
  note: tex((g) => {
    g.fillStyle = "#5a8ae8";
    g.beginPath();
    g.ellipse(24, 46, 12, 9, -0.4, 0, Math.PI * 2);
    g.fill();
    g.fillRect(32, 10, 5, 36);
    g.fillRect(32, 10, 18, 6);
  }),
  bang: tex((g) => {
    g.fillStyle = "#fff";
    g.beginPath();
    g.arc(32, 32, 28, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#e84a4a";
    g.font = "bold 44px sans-serif";
    g.textAlign = "center";
    g.fillText("!", 32, 48);
  }),
  drop: tex((g) => {
    g.fillStyle = "#bfe8ff";
    g.beginPath();
    g.arc(32, 36, 16, 0, Math.PI * 2);
    g.fill();
  }),
  dirt: tex((g) => {
    g.fillStyle = "#8a6a48";
    g.beginPath();
    g.arc(32, 32, 20, 0, Math.PI * 2);
    g.fill();
  }),
  zzz: tex((g) => {
    g.fillStyle = "#8aa8e8";
    g.font = "bold 40px sans-serif";
    g.fillText("Z", 16, 46);
  }),
};
export type FxKind = keyof typeof T;

export class Fx {
  readonly group = new THREE.Group();
  private bits: Bit[] = [];
  private mats = new Map<FxKind, THREE.SpriteMaterial>();

  private mat(k: FxKind): THREE.SpriteMaterial {
    let m = this.mats.get(k);
    if (!m) {
      m = new THREE.SpriteMaterial({ map: T[k], transparent: true, depthWrite: false });
      this.mats.set(k, m);
    }
    return m;
  }

  emit(k: FxKind, at: THREE.Vector3, n = 1, o: { speed?: number; up?: number; grav?: number; life?: number; size?: number; spread?: number; grow?: number; color?: number } = {}): void {
    for (let i = 0; i < n; i++) {
      const m = this.mat(k).clone();
      if (o.color !== undefined) m.color.set(o.color);
      const s = new THREE.Sprite(m);
      const sp = o.spread ?? 0.2;
      s.position.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * sp, (Math.random() - 0.5) * sp * 0.5, (Math.random() - 0.5) * sp));
      const size = (o.size ?? 0.25) * (0.7 + Math.random() * 0.6);
      s.scale.setScalar(size);
      const a = Math.random() * Math.PI * 2;
      const spd = (o.speed ?? 1) * (0.5 + Math.random() * 0.8);
      const life = (o.life ?? 0.7) * (0.8 + Math.random() * 0.4);
      this.group.add(s);
      this.bits.push({ s, v: new THREE.Vector3(Math.cos(a) * spd, (o.up ?? 1.5) * (0.6 + Math.random() * 0.6), Math.sin(a) * spd), life, max: life, grav: o.grav ?? 4, spin: (Math.random() - 0.5) * 6, grow: o.grow ?? 0 });
    }
  }

  update(dt: number): void {
    for (let i = this.bits.length - 1; i >= 0; i--) {
      const b = this.bits[i];
      b.life -= dt;
      if (b.life <= 0) {
        this.group.remove(b.s);
        b.s.material.dispose();
        this.bits.splice(i, 1);
        continue;
      }
      b.v.y -= b.grav * dt;
      b.s.position.addScaledVector(b.v, dt);
      b.s.material.rotation += b.spin * dt;
      b.s.scale.multiplyScalar(1 + b.grow * dt);
      b.s.material.opacity = Math.min(1, (b.life / b.max) * 2);
    }
  }
}
