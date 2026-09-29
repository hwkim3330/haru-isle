/**
 * A person on the island: the local player, or a visitor drawn from network updates. Walks
 * and runs with collision against tiles and cliffs, faces a target tile, holds a tool, and
 * can be moved through scripted motions (climbing a ladder, vaulting a river, walking into a
 * door, sitting down).
 */
import * as THREE from "three";
import { Animator, type Act, type Hold } from "../char/anim";
import { buildRig, type Look, type Rig } from "../char/body";
import { item } from "../data/items";
import { toolMesh } from "../render/tools";
import type { World } from "./world";

export interface Motion {
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  dur: number;
  arc: number;
  face?: number;
  act?: Act;
  done?: () => void;
}

/** A soft round shadow under every character (grounds them even when the sun is high). */
const BLOB = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(32, 32, 4, 32, 32, 30);
  r.addColorStop(0, "rgba(40,50,40,0.55)");
  r.addColorStop(1, "rgba(40,50,40,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false });
})();
const BLOB_GEO = new THREE.PlaneGeometry(0.8, 0.8).rotateX(-Math.PI / 2);

export class Person {
  rig: Rig;
  anim: Animator;
  readonly pos = new THREE.Vector3();
  yaw = 0;
  speed = 0;
  running = false;
  vx = 0;
  vz = 0;
  motion: Motion | null = null;
  toolId: string | null = null;
  private toolObj: THREE.Object3D | null = null;
  tag: HTMLDivElement | null = null;
  /** Visually shown inside a building (hidden outdoors). */
  hidden = false;

  constructor(
    readonly scene: THREE.Object3D,
    public look: Look,
    public name: string,
  ) {
    this.rig = buildRig(look);
    this.anim = new Animator(this.rig);
    scene.add(this.rig.root);
    this.blob = new THREE.Mesh(BLOB_GEO, BLOB);
    this.blob.renderOrder = 2;
    scene.add(this.blob);
  }

  private blob: THREE.Mesh;

  setLook(look: Look): void {
    this.look = look;
    const old = this.rig;
    this.scene.remove(old.root);
    this.rig = buildRig(look);
    this.anim = new Animator(this.rig);
    this.scene.add(this.rig.root);
    const t = this.toolId;
    this.toolId = null;
    this.hold(t);
  }

  /** Show a tool (or nothing) in the hand. */
  hold(id: string | null): void {
    if (id === this.toolId) return;
    this.toolId = id;
    if (this.toolObj) this.rig.hand.remove(this.toolObj);
    this.toolObj = null;
    if (!id) return;
    const d = item(id);
    if (!d.tool) return;
    const m = toolMesh(d.tool, d.tier);
    this.rig.hand.add(m);
    this.toolObj = m;
  }

  get tool(): string | null {
    return this.toolId ? (item(this.toolId).tool ?? null) : null;
  }

  /** The tile in front of the feet. */
  front(dist = 0.8): [number, number] {
    return [Math.floor(this.pos.x + Math.sin(this.yaw) * dist), Math.floor(this.pos.z + Math.cos(this.yaw) * dist)];
  }

  /** Facing snapped to one of four directions (0 +x, 1 +z, 2 -x, 3 -z). */
  dir4(): number {
    const a = Math.atan2(Math.sin(this.yaw), Math.cos(this.yaw));
    if (Math.abs(a) <= Math.PI / 4) return 1;
    if (Math.abs(a) >= (Math.PI * 3) / 4) return 3;
    return a > 0 ? 0 : 2;
  }

  play(a: Act): void {
    this.anim.play(a);
  }

  setHold(h: Hold): void {
    this.anim.hold = h;
  }

  /** Walk with collision. (mx, mz) is the wanted direction scaled 0..1. */
  walk(dt: number, mx: number, mz: number, run: boolean, w: World): void {
    const want = Math.hypot(mx, mz);
    const top = run ? 5.4 : 2.7;
    const tvx = mx * top;
    const tvz = mz * top;
    const acc = want > 0.01 ? 14 : 18;
    this.vx += (tvx - this.vx) * Math.min(1, dt * acc);
    this.vz += (tvz - this.vz) * Math.min(1, dt * acc);
    if (want > 0.01) {
      const ty = Math.atan2(mx, mz);
      let d = ty - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * 14);
    }
    const y = w.groundY(this.pos.x, this.pos.z);
    const nx = this.pos.x + this.vx * dt;
    const nz = this.pos.z + this.vz * dt;
    if (w.canStand(nx, nz, y)) {
      this.pos.x = nx;
      this.pos.z = nz;
    } else if (w.canStand(nx, this.pos.z, y)) {
      this.pos.x = nx;
      this.vz *= 0.5;
    } else if (w.canStand(this.pos.x, nz, y)) {
      this.pos.z = nz;
      this.vx *= 0.5;
    } else {
      this.vx *= 0.3;
      this.vz *= 0.3;
    }
    this.speed = Math.hypot(this.vx, this.vz);
    this.running = run && this.speed > 3.2;
    const gy = w.groundY(this.pos.x, this.pos.z);
    this.pos.y += (gy - this.pos.y) * Math.min(1, dt * 18);
  }

  /** Scripted move from here to there over dur seconds, with a hop of arc height. */
  moveTo(to: THREE.Vector3, dur: number, arc = 0, done?: () => void, act?: Act): void {
    this.motion = { from: this.pos.clone(), to: to.clone(), t: 0, dur, arc, done, act };
    if (act) this.anim.play(act);
    const dx = to.x - this.pos.x;
    const dz = to.z - this.pos.z;
    if (Math.hypot(dx, dz) > 0.05) this.yaw = Math.atan2(dx, dz);
  }

  stepMotion(dt: number): boolean {
    const m = this.motion;
    if (!m) return false;
    m.t += dt;
    const p = Math.min(1, m.t / m.dur);
    this.pos.lerpVectors(m.from, m.to, p);
    this.pos.y += Math.sin(p * Math.PI) * m.arc;
    this.speed = m.arc ? 0 : m.from.distanceTo(m.to) / m.dur;
    if (p >= 1) {
      this.motion = null;
      m.done?.();
    }
    return true;
  }

  /** Put the rig where the logic is and animate. */
  update(dt: number): void {
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.yaw;
    this.rig.root.visible = !this.hidden;
    this.blob.visible = !this.hidden;
    this.blob.position.set(this.pos.x, this.pos.y - this.anim.hop * 0 + 0.03, this.pos.z);
    const s = 1 - Math.min(0.5, this.anim.hop * 2);
    this.blob.scale.setScalar(s);
    this.anim.update(dt, this.speed, this.running);
  }

  dispose(): void {
    this.scene.remove(this.rig.root, this.blob);
    this.tag?.remove();
  }
}
