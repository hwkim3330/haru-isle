/**
 * Weather, the same for everyone on an island: each three-hour block of each day rolls sun,
 * clouds, rain, a storm or (in winter) snow from the island seed. Rain and snow fall round the
 * camera; the ground whitens in snowy months.
 */
import * as THREE from "three";
import { clock } from "../core/clock";
import { rng } from "../core/noise";
import type { Stage } from "../render/stage";
import type { World } from "./world";

export type Sky = "sun" | "cloud" | "rain" | "storm" | "snow";

const q = typeof location === "undefined" ? new URLSearchParams() : new URLSearchParams(location.search);

export class Weather {
  kind: Sky = "sun";
  overcast = 0;
  private drops: THREE.LineSegments;
  private flakes: THREE.Points;
  private n = 1400;
  private key = "";
  private flash = 0;
  get lightning(): boolean {
    return this.kind === "storm" && this.flash > 0;
  }

  constructor(
    readonly stage: Stage,
    readonly world: World,
  ) {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(this.n * 6);
    for (let i = 0; i < this.n; i++) {
      const x = (Math.random() - 0.5) * 60;
      const y = Math.random() * 24;
      const z = (Math.random() - 0.5) * 60;
      p.set([x, y, z, x + 0.05, y - 0.55, z + 0.02], i * 6);
    }
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    this.drops = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xcfe4ff, transparent: true, opacity: 0.55 }));
    this.drops.frustumCulled = false;
    this.drops.visible = false;
    const fg = new THREE.BufferGeometry();
    const fp = new Float32Array(this.n * 3);
    for (let i = 0; i < this.n; i++) fp.set([(Math.random() - 0.5) * 60, Math.random() * 24, (Math.random() - 0.5) * 60], i * 3);
    fg.setAttribute("position", new THREE.BufferAttribute(fp, 3));
    this.flakes = new THREE.Points(fg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.9 }));
    this.flakes.frustumCulled = false;
    this.flakes.visible = false;
    stage.scene.add(this.drops, this.flakes);
  }

  /** The sky for a block of hours on a day. */
  static roll(seed: number, day: number, hour: number, month: number): Sky {
    const forced = q.get("wx") as Sky | null;
    if (forced) return forced;
    const R = rng(seed * 991 + day * 13 + Math.floor(hour / 3) * 7);
    // A day has a mood; blocks vary around it.
    const D = rng(seed * 57 + day * 3)();
    const r = R() * 0.6 + D * 0.4;
    const winter = month === 12 || month <= 2;
    const wet = month === 6 || month === 7 ? 0.35 : month === 9 ? 0.25 : 0.15;
    if (r < 1 - wet - 0.2) return "sun";
    if (r < 1 - wet) return "cloud";
    if (winter) return "snow";
    if (month >= 7 && month <= 9 && r > 0.97) return "storm";
    return "rain";
  }

  update(dt: number, hour: number): { kind: Sky; overcast: number } {
    const m = clock.month();
    const key = `${clock.day()}:${Math.floor(hour / 3)}`;
    if (key !== this.key) {
      this.key = key;
      this.kind = Weather.roll(this.world.I.seed, clock.day(), hour, m);
    }
    const want = this.kind === "sun" ? 0 : this.kind === "cloud" ? 0.45 : this.kind === "snow" ? 0.55 : this.kind === "storm" ? 0.9 : 0.75;
    this.overcast += (want - this.overcast) * Math.min(1, dt * 0.5);
    const f = this.stage.focus;
    const rain = this.kind === "rain" || this.kind === "storm";
    this.drops.visible = rain;
    this.flakes.visible = this.kind === "snow";
    if (rain) {
      const p = this.drops.geometry.attributes.position as THREE.BufferAttribute;
      const a = p.array as Float32Array;
      const sp = this.kind === "storm" ? 26 : 18;
      for (let i = 0; i < this.n; i++) {
        const o = i * 6;
        a[o + 1] -= sp * dt;
        a[o + 4] -= sp * dt;
        if (a[o + 1] < -2) {
          const x = f.x + (Math.random() - 0.5) * 60;
          const z = f.z + (Math.random() - 0.5) * 60;
          const y = 16 + Math.random() * 8;
          a.set([x, y, z, x + 0.05, y - 0.55, z + 0.02], o);
        }
      }
      p.needsUpdate = true;
      if (this.kind === "storm") {
        this.flash -= dt;
        if (this.flash < -6 && Math.random() < dt * 0.3) this.flash = 0.15;
      }
    }
    if (this.kind === "snow") {
      const p = this.flakes.geometry.attributes.position as THREE.BufferAttribute;
      const a = p.array as Float32Array;
      const t = this.stage.time.value;
      for (let i = 0; i < this.n; i++) {
        const o = i * 3;
        a[o + 1] -= 1.6 * dt;
        a[o] += Math.sin(t + i) * 0.4 * dt;
        if (a[o + 1] < -2) a.set([f.x + (Math.random() - 0.5) * 60, 16 + Math.random() * 8, f.z + (Math.random() - 0.5) * 60], o);
      }
      p.needsUpdate = true;
    }
    // Snow cover through the snowy months.
    const snowy = m === 12 || m === 1 || m === 2 ? 1 : 0;
    this.world.terrain.setSeason(clock.yearT(), snowy);
    this.world.view.setSeason();
    return { kind: this.kind, overcast: this.overcast };
  }
}
