/**
 * Shooting stars: on some clear nights they streak across the sky. Press R to look up; press
 * Space while one is falling to make a wish. Each wish leaves a star shard on the beach the
 * next morning.
 */
import * as THREE from "three";
import { sfx } from "../audio/sound";
import { clock } from "../core/clock";
import { rng } from "../core/noise";
import type { Game } from "./game";

interface Streak {
  line: THREE.Mesh;
  t: number;
  life: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
}

export class Meteors {
  lookUp = 0;
  private want = 0;
  private streaks: Streak[] = [];
  private nextT = 3;
  private mat = new THREE.MeshBasicMaterial({ color: 0xfff6c0, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
  wishedTonight = 0;

  constructor(readonly g: Game) {}

  /** Tonight is a shooting-star night (clear sky, 7 pm – 4 am, some nights). */
  tonight(): boolean {
    const h = clock.hour();
    if (!(h >= 19 || h < 4)) return false;
    if (this.g.weather.kind !== "sun") return false;
    const d = clock.day() - (h < 4 ? 1 : 0);
    return rng(this.g.island.seed * 7 + d * 131)() < 0.35 || new URLSearchParams(location.search).has("stars");
  }

  toggleLook(): void {
    this.want = this.want ? 0 : 1;
  }

  get looking(): boolean {
    return this.lookUp > 0.8;
  }

  /** Space while looking up: a wish if a star is falling right now. */
  wish(): boolean {
    if (!this.looking) return false;
    const live = this.streaks.find((s) => s.t < s.life * 0.8);
    this.g.player.play("bow");
    if (!live) {
      this.g.ui.toast("…소원을 빌려면 별똥별이 떨어질 때!");
      return true;
    }
    this.wishedTonight++;
    this.g.island.wishes = (this.g.island.wishes ?? 0) + 1;
    sfx("joy");
    this.g.ui.toast(`별똥별에 소원을 빌었다! (${this.wishedTonight})`);
    return true;
  }

  update(dt: number): void {
    const g = this.g;
    if (g.where !== "out" || g.ui.modal) this.want = 0;
    this.lookUp += (this.want - this.lookUp) * Math.min(1, dt * 3);
    g.stage.lookUp = this.lookUp;
    const on = this.tonight();
    if (on && this.lookUp > 0.3) {
      this.nextT -= dt;
      if (this.nextT <= 0) {
        this.nextT = 2 + Math.random() * 6;
        const cam = g.stage.camera.position;
        const from = cam.clone().add(new THREE.Vector3(-30 + Math.random() * 60, 55 + Math.random() * 15, -110 - Math.random() * 30));
        const to = from.clone().add(new THREE.Vector3(18 + Math.random() * 12, -14, 4));
        const geo = new THREE.CylinderGeometry(0.02, 0.35, 1, 6, 1, true);
        geo.translate(0, -0.5, 0);
        const line = new THREE.Mesh(geo, this.mat.clone());
        line.frustumCulled = false;
        line.renderOrder = 20;
        g.stage.scene.add(line);
        this.streaks.push({ line, t: 0, life: 0.9, from, to });
      }
    }
    for (const s of this.streaks) {
      s.t += dt;
      const p = Math.min(1, s.t / s.life);
      const head = s.from.clone().lerp(s.to, p);
      const tail = s.from.clone().lerp(s.to, Math.max(0, p - 0.35));
      const d = head.clone().sub(tail);
      s.line.position.copy(head);
      s.line.scale.set(1, Math.max(0.01, d.length()), 1);
      s.line.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize().multiplyScalar(-1));
      (s.line.material as THREE.MeshBasicMaterial).opacity = 1 - p;
    }
    this.streaks = this.streaks.filter((s) => {
      if (s.t < s.life) return true;
      g.stage.scene.remove(s.line);
      s.line.geometry.dispose();
      return false;
    });
  }
}
