/**
 * Bugs and fish. Bugs spawn round the player where they live (flowers, trunks, stumps, the
 * beach, water, lamplight, the air) for the month, hour and weather, and flee from someone
 * running at them. Fish show as shadows sized like the fish; cast near one and it circles,
 * nibbles, then bites — press at the bite. The net, the slingshot's balloon presents and the
 * odd wasp nest live here too.
 */
import * as THREE from "three";
import { sfx } from "../audio/sound";
import { clock } from "../core/clock";
import { BUGS, FISH, inSeason, type BugPlace, type Critter, type FishPlace } from "../data/critters";
import { item, josa } from "../data/items";
import { bugModel, fishModel } from "../render/critters";
import { mat } from "../render/stage";
import { bobberMesh } from "../render/tools";
import { DX, DZ, H, idx, inside, K, TIER_H, W } from "../world/island";
import { WATER_DROP } from "../world/terrain";
import type { Game } from "./game";
import type { Pad } from "./input";
import { wait } from "./game";

interface Bug {
  c: Critter;
  mesh: THREE.Object3D;
  home: THREE.Vector3;
  pos: THREE.Vector3;
  t: number;
  flee: boolean;
  gone: boolean;
}

interface Fish {
  c: Critter;
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  home: THREE.Vector3;
  place: FishPlace;
  y: number;
  state: "swim" | "approach" | "nibble" | "bite" | "flee";
  t: number;
  nibbles: number;
}

const BUG_MAT = mat(0xffffff, { vertexColors: true });
const SHADOW_MAT = new THREE.MeshBasicMaterial({ color: 0x0a2a3a, transparent: true, opacity: 0.45, depthWrite: false });

export class Critters {
  private bugs: Bug[] = [];
  private fish: Fish[] = [];
  private geoCache = new Map<string, THREE.BufferGeometry>();
  private spawnT = 0;
  fishing: { bob: THREE.Mesh; at: THREE.Vector3; fish: Fish | null; t: number; line: THREE.Line } | null = null;
  private balloon: { mesh: THREE.Object3D; pos: THREE.Vector3; v: THREE.Vector3; popped: boolean; vy: number } | null = null;
  private balloonT = 60;
  private waspT = 0;
  private waspMesh: THREE.Object3D | null = null;

  constructor(readonly g: Game) {}

  private geo(c: Critter, fish: boolean): THREE.BufferGeometry {
    let geo = this.geoCache.get(c.id);
    if (!geo) {
      geo = fish ? fishModel(c) : bugModel(c);
      this.geoCache.set(c.id, geo);
    }
    return geo;
  }

  private rain(): boolean {
    const k = this.g.weather.kind;
    return k === "rain" || k === "storm";
  }

  // ---------------------------------------------------------------- spawning

  private pickCritter(list: Critter[], place: string): Critter | null {
    const m = clock.month();
    const h = clock.hour();
    const rain = this.rain();
    const ok = list.filter((c) => c.place === place && inSeason(c, m, h, rain));
    if (!ok.length) return null;
    const weights = ok.map((c) => [1, 1, 0.5, 0.22, 0.12, 0.05][c.rarity] * (c.rain ? 3 : 1));
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let k = 0; k < ok.length; k++) if ((r -= weights[k]) <= 0) return ok[k];
    return ok[0];
  }

  private spawnBug(): void {
    const g = this.g;
    const w = g.world;
    const P = g.player.pos;
    for (let a = 0; a < 20; a++) {
      const x = Math.floor(P.x + (Math.random() - 0.5) * 36);
      const z = Math.floor(P.z + (Math.random() - 0.5) * 30);
      if (!inside(x, z) || Math.hypot(x - P.x, z - P.z) < 6) continue;
      const i = idx(x, z);
      const o = w.S.objs[i];
      const k = w.I.kind[i];
      const night = clock.hour() < 5 || clock.hour() >= 19;
      let place: BugPlace | null = null;
      let at = new THREE.Vector3(x + 0.5, w.groundY(x + 0.5, z + 0.5), z + 0.5);
      if (o?.t === "flower" && o.stage === 2) {
        place = this.rain() && Math.random() < 0.5 ? "rain" : "flower";
        at.y += 0.4;
      } else if (o?.t === "tree" && o.stage === 3) {
        place = o.kind === "palm" ? "palm" : "tree";
        at.add(new THREE.Vector3(0, 0.6 + Math.random() * 0.5, 0.18));
      } else if (o?.t === "stump") {
        place = "stump";
        at.y += 0.3;
      } else if (o?.t === "rock" && this.rain()) {
        place = "rain";
        at.y += 0.55;
      } else if (k === K.Sand && w.I.seaDist[i] < 3 && !o) place = "beach";
      else if ((k === K.River || k === K.Pond) && !o) {
        place = "water";
        at.y = w.I.tier[i] * TIER_H - WATER_DROP + 0.02;
      } else if (k === K.Grass && !o) {
        const nearHouse = w.buildings.some((b) => Math.hypot(b.door[0] - x, b.door[1] - z) < 4);
        place = night && nearHouse && Math.random() < 0.5 ? "light" : Math.random() < 0.5 ? (night ? "night-fly" : "fly") : "ground";
        if (place === "fly" || place === "night-fly" || place === "light") at.y += 0.9 + Math.random() * 0.6;
      }
      if (!place) continue;
      const c = this.pickCritter(BUGS, place);
      if (!c) continue;
      const mesh = new THREE.Mesh(this.geo(c, false), BUG_MAT);
      mesh.castShadow = true;
      if (c.id === "firefly") {
        const glow = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xe8ff80 }));
        mesh.add(glow);
      }
      g.stage.scene.add(mesh);
      this.bugs.push({ c, mesh, home: at.clone(), pos: at.clone(), t: Math.random() * 10, flee: false, gone: false });
      return;
    }
  }

  private fishPlace(x: number, z: number): FishPlace | null {
    const w = this.g.world;
    if (!inside(x, z)) return null;
    const i = idx(x, z);
    const k = w.I.kind[i];
    if (k === K.Pond) return "pond";
    if (k === K.River) {
      if (w.I.tier[i] >= 1) return "clifftop";
      for (let r = 1; r <= 4; r++) for (let d = 0; d < 4; d++) if (inside(x + DX[d] * r, z + DZ[d] * r) && w.I.kind[idx(x + DX[d] * r, z + DZ[d] * r)] === K.Sea) return "mouth";
      return "river";
    }
    if (k === K.Sea) {
      const dock = w.plot("dock");
      if (dock && Math.hypot(x - dock.x, z - (dock.z + dock.d)) < 4) return "pier";
      return "sea";
    }
    return null;
  }

  private spawnFish(): void {
    const g = this.g;
    const w = g.world;
    const P = g.player.pos;
    for (let a = 0; a < 30; a++) {
      const x = Math.floor(P.x + (Math.random() - 0.5) * 34);
      const z = Math.floor(P.z + (Math.random() - 0.5) * 28);
      const place = this.fishPlace(x, z);
      if (!place) continue;
      // Sea fish near the shore only (you can't reach far out).
      if (place === "sea" && inside(x, z)) {
        let near = false;
        for (let d = 0; d < 4 && !near; d++) for (let r = 1; r <= 3; r++) if (inside(x + DX[d] * r, z + DZ[d] * r) && w.I.kind[idx(x + DX[d] * r, z + DZ[d] * r)] !== K.Sea) near = true;
        if (!near) continue;
      }
      const list = place === "mouth" ? [...FISH.filter((f) => f.place === "mouth"), ...FISH.filter((f) => f.place === "river")] : place === "pier" ? [...FISH.filter((f) => f.place === "pier"), ...FISH.filter((f) => f.place === "sea")] : place === "clifftop" ? [...FISH.filter((f) => f.place === "clifftop"), ...FISH.filter((f) => f.place === "river")] : FISH.filter((f) => f.place === place);
      const m = clock.month();
      const h = clock.hour();
      const ok = list.filter((c) => inSeason(c, m, h, this.rain()));
      if (!ok.length) continue;
      const weights = ok.map((c) => [1, 1, 0.5, 0.22, 0.12, 0.05][c.rarity] * (c.rain ? 3 : 1));
      let r = Math.random() * weights.reduce((s, v) => s + v, 0);
      let c = ok[0];
      for (let k = 0; k < ok.length; k++) if ((r -= weights[k]) <= 0) {
        c = ok[k];
        break;
      }
      const s = 0.18 + (c.size ?? 2) * 0.09;
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 16), SHADOW_MAT);
      mesh.rotation.x = -Math.PI / 2;
      mesh.scale.set(s * 0.55, s, 1);
      const y = (place === "sea" || place === "pier" ? -0.35 : w.I.tier[idx(x, z)] * TIER_H - WATER_DROP) - 0.05;
      const pos = new THREE.Vector3(x + 0.5, y, z + 0.5);
      mesh.position.copy(pos);
      mesh.renderOrder = 1;
      g.stage.scene.add(mesh);
      this.fish.push({ c, mesh, pos, vel: new THREE.Vector3(), home: pos.clone(), place, y, state: "swim", t: 0, nibbles: 0 });
      return;
    }
  }

  // ---------------------------------------------------------------- the frame

  update(dt: number, pad: Pad, modal: boolean): void {
    const g = this.g;
    const P = g.player;
    if (g.where !== "out") {
      for (const b of this.bugs) b.mesh.visible = false;
      for (const f of this.fish) f.mesh.visible = false;
      return;
    }
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 0.5;
      if (this.bugs.length < 12) this.spawnBug();
      if (this.fish.length < 10) this.spawnFish();
    }
    const tnow = g.stage.time.value;
    for (const b of this.bugs) {
      b.mesh.visible = true;
      b.t += dt;
      const d = b.pos.distanceTo(P.pos);
      const scary = (P.running && d < 5) || (P.speed > 2.5 && d < 1.6);
      if (!b.flee && scary && b.c.place !== "rock") {
        b.flee = true;
        sfx("swing");
      }
      const flying = ["fly", "night-fly", "light"].includes(b.c.place);
      if (b.flee) {
        const away = b.pos.clone().sub(P.pos).setY(0).normalize();
        b.pos.addScaledVector(away, dt * 5).add(new THREE.Vector3(0, dt * 3, 0));
        if (b.pos.y > b.home.y + 6) b.gone = true;
      } else if (flying) {
        b.pos.set(b.home.x + Math.sin(b.t * 0.7) * 1.5 + Math.sin(b.t * 1.9) * 0.4, b.home.y + Math.sin(b.t * 2.3) * 0.25, b.home.z + Math.cos(b.t * 0.6) * 1.2);
      } else if (b.c.place === "ground" || b.c.place === "beach") {
        b.pos.x = b.home.x + Math.sin(b.t * 0.4) * 0.8;
        b.pos.z = b.home.z + Math.cos(b.t * 0.3) * 0.8;
        b.pos.y = g.world.groundY(b.pos.x, b.pos.z) + 0.02;
      } else if (b.c.place === "water") {
        b.pos.x = b.home.x + Math.sin(b.t * 0.5) * 0.5;
        b.pos.z = b.home.z + Math.cos(b.t * 0.45) * 0.5;
      }
      const prev = b.mesh.position.clone();
      b.mesh.position.copy(b.pos);
      const mv = b.pos.clone().sub(prev);
      if (mv.lengthSq() > 1e-6) b.mesh.rotation.y = Math.atan2(mv.x, mv.z);
      // Flap wings (butterflies) by squashing.
      if (flying && b.c.id.includes("butter") || b.c.id.includes("swallow") || b.c.id.includes("moth") || b.c.id.includes("white")) b.mesh.scale.set(0.3 + Math.abs(Math.sin(tnow * 14 + b.t)) * 0.7, 1, 1);
      if (d > 45) b.gone = true;
    }
    this.bugs = this.bugs.filter((b) => {
      if (b.gone) g.stage.scene.remove(b.mesh);
      return !b.gone;
    });
    for (const f of this.fish) {
      f.mesh.visible = true;
      f.t += dt;
      if (f.state === "swim") {
        if (f.t > 1.5 + Math.random() * 2) {
          f.t = 0;
          const a = Math.random() * Math.PI * 2;
          f.vel.set(Math.cos(a), 0, Math.sin(a)).multiplyScalar(0.4 + Math.random() * 0.4);
        }
        const nx = f.pos.x + f.vel.x * dt;
        const nz = f.pos.z + f.vel.z * dt;
        if (this.fishPlace(Math.floor(nx), Math.floor(nz)) && Math.hypot(nx - f.home.x, nz - f.home.z) < 3) {
          f.pos.x = nx;
          f.pos.z = nz;
        } else f.vel.multiplyScalar(-1);
        // Frightened by running on the bank.
        if (P.running && P.pos.distanceTo(f.pos) < 3) f.state = "flee";
      } else if (f.state === "flee") {
        f.mesh.scale.multiplyScalar(1 - dt * 2);
        if (f.mesh.scale.y < 0.05) f.state = "flee";
      }
      f.mesh.position.set(f.pos.x, f.y, f.pos.z);
      if (f.vel.lengthSq() > 1e-4) f.mesh.rotation.z = -Math.atan2(f.vel.x, f.vel.z);
    }
    this.fish = this.fish.filter((f) => {
      const drop = (f.state === "flee" && f.mesh.scale.y < 0.06) || f.pos.distanceTo(P.pos) > 45;
      if (drop) g.stage.scene.remove(f.mesh);
      return !drop;
    });
    this.updateFishing(dt, pad, modal);
    this.updateBalloon(dt);
    this.updateWasps(dt);
  }

  // ---------------------------------------------------------------- net

  async swingNet(): Promise<void> {
    const g = this.g;
    const P = g.player;
    g.busy++;
    P.play("net");
    sfx("swing");
    await wait(200);
    const f = new THREE.Vector3(Math.sin(P.yaw), 0, Math.cos(P.yaw));
    const hit = this.bugs.find((b) => {
      const d = b.pos.clone().sub(P.pos);
      const flat = new THREE.Vector3(d.x, 0, d.z);
      return flat.length() < 1.7 && flat.normalize().dot(f) > 0.3 && d.y < 2.4 && !b.flee;
    });
    if (this.waspMesh && this.waspMesh.position.distanceTo(P.pos) < 2) {
      this.g.stage.scene.remove(this.waspMesh);
      this.waspMesh = null;
      this.waspT = 0;
      await this.caught(BUGS.find((b) => b.id === "wasp")!, false);
    } else if (hit) {
      hit.gone = true;
      g.stage.scene.remove(hit.mesh);
      g.wearTool();
      await wait(250);
      await this.caught(hit.c, false);
    } else {
      // A near miss scares whatever was close.
      for (const b of this.bugs) if (b.pos.distanceTo(P.pos) < 3) b.flee = true;
    }
    await wait(250);
    g.busy--;
  }

  /** The catch pose, the line, the pockets, the guide. */
  private async caught(c: Critter, isFish: boolean): Promise<void> {
    const g = this.g;
    const id = `${isFish ? "fish" : "bug"}:${c.id}`;
    const P = g.player;
    const show = new THREE.Mesh(this.geo(c, isFish), BUG_MAT);
    show.scale.setScalar(isFish ? 1.3 : 2.2);
    show.position.set(0, P.rig.height + 0.35, 0);
    P.rig.root.add(show);
    P.play("joy");
    sfx("catch");
    const first = !g.profile.caught.includes(id);
    if (first) g.profile.caught.push(id);
    g.villagers.noteCatch(c.name);
    const lines = [c.line];
    if (first) lines.push(`도감에 ${josa(c.name, "이가")} 등록되었다!`);
    await g.ui.say("", lines);
    P.rig.root.remove(show);
    g.give(id, 1, true);
    g.ui.toast(`${josa(item(id).name, "을를")} 주머니에 넣었다.`, id);
  }

  // ---------------------------------------------------------------- fishing

  /** Where a cast from here would land: water 1–3 tiles ahead. */
  castSpot(): THREE.Vector3 | null {
    const g = this.g;
    const P = g.player;
    const d = new THREE.Vector3(Math.sin(P.yaw), 0, Math.cos(P.yaw));
    for (const k of [2.2, 1.6, 2.8, 1.2]) {
      const x = P.pos.x + d.x * k;
      const z = P.pos.z + d.z * k;
      const place = this.fishPlace(Math.floor(x), Math.floor(z));
      if (!place) continue;
      const i = idx(Math.floor(x), Math.floor(z));
      const y = place === "sea" || place === "pier" ? -0.35 : g.world.I.tier[i] * TIER_H - WATER_DROP;
      return new THREE.Vector3(x, y, z);
    }
    return null;
  }

  cast(at: THREE.Vector3): void {
    const g = this.g;
    const P = g.player;
    P.play("cast");
    sfx("cast");
    const bob = bobberMesh();
    bob.position.copy(at);
    g.stage.scene.add(bob);
    const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xf8f8f8 }));
    line.frustumCulled = false;
    g.stage.scene.add(line);
    P.setHold("fish");
    this.fishing = { bob, at: at.clone(), fish: null, t: 0, line };
  }

  private endFishing(): void {
    const F = this.fishing;
    if (!F) return;
    this.g.stage.scene.remove(F.bob, F.line);
    this.g.player.setHold("none");
    this.fishing = null;
  }

  private updateFishing(dt: number, pad: Pad, modal: boolean): void {
    const F = this.fishing;
    if (!F) return;
    const g = this.g;
    const P = g.player;
    F.t += dt;
    // The line from the rod tip to the bobber.
    const tip = new THREE.Vector3();
    g.player.rig.hand.getWorldPosition(tip);
    tip.add(new THREE.Vector3(Math.sin(P.yaw) * 1.1, 0.5, Math.cos(P.yaw) * 1.1));
    const pos = F.line.geometry.attributes.position as THREE.BufferAttribute;
    pos.setXYZ(0, tip.x, tip.y, tip.z);
    pos.setXYZ(1, F.bob.position.x, F.bob.position.y + 0.05, F.bob.position.z);
    pos.needsUpdate = true;
    F.bob.position.y = F.at.y + Math.sin(F.t * 3) * 0.01;
    if (modal) return;
    if ((Math.hypot(pad.x, pad.z) > 0.3 || pad.back) && F.t > 0.35) {
      if (F.fish) F.fish.state = "flee";
      this.endFishing();
      return;
    }
    // Find a fish that notices.
    if (!F.fish && F.t > 0.6) {
      const f = this.fish.filter((f) => f.state === "swim" && f.pos.distanceTo(F.at) < 3.6).sort((a, b) => a.pos.distanceTo(F.at) - b.pos.distanceTo(F.at))[0];
      if (f) {
        F.fish = f;
        f.state = "approach";
        f.t = 0;
        f.nibbles = 1 + Math.floor(Math.random() * 4);
      }
    }
    const f = F.fish;
    if (f) {
      if (f.state === "approach") {
        const to = F.at.clone().sub(f.pos).setY(0);
        const d = to.length();
        if (d < 0.35 + (f.c.size ?? 2) * 0.05) {
          f.state = "nibble";
          f.t = 0;
        } else {
          f.vel.copy(to.normalize().multiplyScalar(0.7));
          f.pos.addScaledVector(f.vel, dt);
        }
      } else if (f.state === "nibble") {
        f.t += dt;
        if (f.t > 1.1) {
          f.t = 0;
          f.nibbles--;
          F.bob.position.y = F.at.y - 0.04;
          sfx("drop");
          g.fx.emit("drop", F.at, 3, { spread: 0.1, up: 0.8, life: 0.3, size: 0.06 });
          if (f.nibbles <= 0) {
            f.state = "bite";
            f.t = 0;
            sfx("bite");
            g.fx.emit("drop", F.at, 10, { spread: 0.3, up: 1.6, life: 0.5, size: 0.1 });
          }
        }
      } else if (f.state === "bite") {
        f.t += dt;
        F.bob.position.y = F.at.y - 0.18;
        if (f.t > 0.75) {
          f.state = "flee";
          this.endFishing();
          g.ui.toast("놓쳤다… 물고기가 도망갔다.");
          return;
        }
      }
    }
    if (pad.act && F.t > 0.35) {
      if (f && f.state === "bite") {
        g.stage.scene.remove(f.mesh);
        this.fish = this.fish.filter((x) => x !== f);
        this.endFishing();
        g.wearTool();
        g.busy++;
        void this.caught(f.c, true).then(() => g.busy--);
      } else {
        if (f) f.state = "flee";
        this.endFishing();
        g.player.play("cast");
      }
    }
  }

  // ---------------------------------------------------------------- slingshot and balloons

  private updateBalloon(dt: number): void {
    const g = this.g;
    const P = g.player.pos;
    if (!this.balloon) {
      this.balloonT -= dt;
      if (this.balloonT <= 0) {
        this.balloonT = 120 + Math.random() * 120;
        const grp = new THREE.Group();
        const colors = [0xe84a4a, 0xf8d050, 0x5a9ae8];
        colors.forEach((c, k) => {
          const b = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10), mat(c));
          b.position.set((k - 1) * 0.35, 1.0 + (k % 2) * 0.15, 0);
          grp.add(b);
        });
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.4), mat(0xf8f0e0));
        grp.add(box);
        g.stage.scene.add(grp);
        const pos = new THREE.Vector3(P.x - 25, 5.5, P.z - 4 + Math.random() * 8);
        this.balloon = { mesh: grp, pos, v: new THREE.Vector3(1.4, 0, 0), popped: false, vy: 0 };
      }
      return;
    }
    const b = this.balloon;
    if (b.popped) {
      b.vy -= 9 * dt;
      b.pos.y += b.vy * dt;
      const gy = g.world.groundY(b.pos.x, b.pos.z);
      if (b.pos.y <= gy) {
        g.stage.scene.remove(b.mesh);
        const x = Math.floor(b.pos.x);
        const z = Math.floor(b.pos.z);
        const spot = g.world.freeTile(x, z) ? [x, z] : g.nearestFree();
        if (spot[0] >= 0) void g.doOp({ op: "drop", x: spot[0], z: spot[1], id: "present", n: 1, rot: 0 }, true);
        this.balloon = null;
        return;
      }
    } else {
      b.pos.addScaledVector(b.v, dt);
      b.pos.y = 5.5 + Math.sin(g.stage.time.value * 1.3) * 0.3;
      if (b.pos.x > P.x + 30) {
        g.stage.scene.remove(b.mesh);
        this.balloon = null;
        return;
      }
    }
    b.mesh.position.copy(b.pos);
  }

  async shoot(): Promise<void> {
    const g = this.g;
    const P = g.player;
    g.busy++;
    P.play("slingshot");
    sfx("swing");
    await wait(250);
    const b = this.balloon;
    if (b && !b.popped) {
      const d = b.pos.clone().sub(P.pos).setY(0);
      const f = new THREE.Vector3(Math.sin(P.yaw), 0, Math.cos(P.yaw));
      if (d.length() < 8 && d.normalize().dot(f) > 0.8) {
        b.popped = true;
        b.mesh.children.slice(0, 3).forEach((c) => (c.visible = false));
        sfx("rockhit");
        g.fx.emit("spark", b.pos, 8, { spread: 0.8, up: 1, life: 0.6, size: 0.25 });
        g.wearTool();
      }
    }
    await wait(250);
    g.busy--;
  }

  // ---------------------------------------------------------------- wasps

  wasps(at: THREE.Vector3): void {
    const m = new THREE.Mesh(this.geo(BUGS.find((b) => b.id === "wasp")!, false), BUG_MAT);
    m.scale.setScalar(1.5);
    m.position.copy(at).add(new THREE.Vector3(0, 1.5, 0));
    this.g.stage.scene.add(m);
    this.waspMesh = m;
    this.waspT = 3.2;
    sfx("wasp");
  }

  private updateWasps(dt: number): void {
    if (!this.waspMesh) return;
    const P = this.g.player;
    this.waspT -= dt;
    const to = P.pos.clone().add(new THREE.Vector3(0, 1, 0)).sub(this.waspMesh.position);
    this.waspMesh.position.addScaledVector(to, Math.min(1, dt * 1.6));
    this.waspMesh.position.y += Math.sin(this.g.stage.time.value * 20) * 0.02;
    if (this.waspT <= 0) {
      this.g.stage.scene.remove(this.waspMesh);
      this.waspMesh = null;
      P.play("sad");
      sfx("fail");
      this.g.ui.toast("아얏! 벌에 쏘였다…");
    }
  }
}

void H;
void W;
