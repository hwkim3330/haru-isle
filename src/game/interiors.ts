/**
 * Walking into buildings. Each interior is a little room built on demand far from the island
 * and lit on its own: your home (furniture you place on a grid, wallpaper, floor, storage),
 * the shop and its keeper, the museum with its tanks, cases and fossil stands filling up as
 * you donate, the island office with its workbench, and each neighbour's room (they're home
 * at night, sometimes asleep).
 */
import * as THREE from "three";
import { sfx } from "../audio/sound";
import { buildRig, type Look } from "../char/body";
import { Animator } from "../char/anim";
import { clock } from "../core/clock";
import { rng } from "../core/noise";
import { FLOORS, item, josa, WALLS } from "../data/items";
import { at, blob, box, cyl, merge, rbox, type Part } from "../render/geo";
import { FURN_BY_ID, FURNITURE, furnGeometry } from "../render/furniture";
import { mat } from "../render/stage";
import { bugModel, fishModel } from "../render/critters";
import type { Action, Game } from "./game";
import type { Pad } from "./input";
import type { Building } from "./world";
import type { Placed } from "./save";

const ORIGIN = new THREE.Vector3(-400, 0, -400);
const M = mat(0xffffff, { vertexColors: true });

export interface Keeper {
  name: string;
  look: Look;
  rig: ReturnType<typeof buildRig>;
  anim: Animator;
  pos: THREE.Vector3;
  talk: () => Promise<void>;
}

interface Room {
  kind: string;
  group: THREE.Group;
  w: number;
  d: number;
  /** Solid tiles (furniture, counters, displays). */
  solid: Set<string>;
  keeper?: Keeper;
  b: Building;
}

export function keeperLook(kind: "beaver" | "hedgehog" | "capybara" | "seal"): Look {
  const base = {
    kind: "animal" as const,
    pattern: "plain" as const,
    shoes: 0x5a3a2a,
    headScale: [1.05, 0.95, 1] as [number, number, number],
    face: { eyes: "button" as const, eyeColor: 0x2a2a2a, mouth: "smile" as const, blush: 0xff9aa0, brows: null, spread: 0.4, eyeY: 0.5, mouthY: 0.78 },
  };
  switch (kind) {
    case "beaver":
      return { ...base, fur: 0x9a6a42, fur2: 0xe8c8a0, ears: "otter", snout: "wide", nose: 0x3a2a22, tail: "flat", shirt: 0x6ab070, shirt2: 0xffffff, pants: 0x9a6a42, hat: "cap", hatColor: 0x6ab070 };
    case "hedgehog":
      return { ...base, fur: 0x8a6a5a, fur2: 0xf0e0d0, ears: "hamster", snout: "long", nose: 0x2a1a1a, tail: "stub", shirt: 0x5a6a9a, shirt2: 0xf8f0e0, pattern: "two", pants: 0x4a4a5a, face: { ...base.face, eyes: "narrow" } };
    case "capybara":
      return { ...base, fur: 0xb08a5a, fur2: 0xc8a070, ears: "bear", snout: "wide", nose: 0x3a2a1a, tail: "none", shirt: 0x5ab8e8, shirt2: 0xffffff, pants: 0x3a5a8a, face: { ...base.face, eyes: "sleepy", mouth: "flat" } };
    case "seal":
      return { ...base, fur: 0xa8b0b8, fur2: 0xe8ecf0, ears: "none", snout: "small", nose: 0x2a2a2a, tail: "flat", shirt: 0x3a4a8a, shirt2: 0xffffff, pattern: "stripe", pants: 0x3a4a8a, hat: "cap", hatColor: 0xf8f8f8 };
  }
}

export class Interiors {
  room: Room | null = null;
  /** Whose house the player is in (for showing them inside). */
  hostOf: string | null = null;
  private light = new THREE.PointLight(0xfff0d8, 30, 20, 1.6);
  private camPos = new THREE.Vector3();

  constructor(readonly g: Game) {
    this.light.castShadow = false;
  }

  private key(x: number, z: number): string {
    return `${x},${z}`;
  }

  // ---------------------------------------------------------------- building rooms

  private shell(w: number, d: number, wall: number, floor: number): { g: THREE.Group; parts: Part[] } {
    const P: Part[] = [];
    const wd = WALLS[wall] ?? WALLS[0];
    const fd = FLOORS[floor] ?? FLOORS[0];
    for (let z = 0; z < d; z++)
      for (let x = 0; x < w; x++) {
        let c = fd[1];
        if (fd[3] === "check") c = (x + z) % 2 ? fd[1] : fd[2];
        else if (fd[3] === "tile" || fd[3] === "grid") c = (x + z) % 2 ? fd[1] : new THREE.Color(fd[1]).lerp(new THREE.Color(fd[2]), 0.4).getHex();
        else if (fd[3] === "plank") c = z % 2 ? fd[1] : fd[2];
        P.push(at(box(1.0, 0.1, 1.0, c), [x + 0.5, -0.05, z + 0.5]));
        if (fd[3] === "dot" && (x + z) % 2) P.push(at(box(0.2, 0.01, 0.2, fd[2]), [x + 0.5, 0.005, z + 0.5]));
      }
    const H = 2.8;
    // Back and side walls.
    P.push(at(box(w + 0.4, H, 0.2, wd[1]), [w / 2, H / 2, -0.1]));
    P.push(at(box(0.2, H, d + 0.2, wd[1]), [-0.1, H / 2, d / 2]));
    P.push(at(box(0.2, H, d + 0.2, wd[1]), [w + 0.1, H / 2, d / 2]));
    const pat = wd[3];
    if (pat === "stripe") for (let k = 0; k < w * 2; k += 2) P.push(at(box(0.25, H, 0.02, wd[2]), [k / 2 + 0.25, H / 2, 0.01]));
    if (pat === "dot") for (let k = 0; k < w * 3; k++) P.push(at(box(0.12, 0.12, 0.02, wd[2]), [0.3 + (k % (w * 1.5)) * 0.66, 0.6 + Math.floor(k / (w * 1.5)) * 0.9, 0.01]));
    if (pat === "plank") for (let k = 0; k < 7; k++) P.push(at(box(w, 0.03, 0.02, wd[2]), [w / 2, 0.35 + k * 0.38, 0.01]));
    if (pat === "brick") for (let k = 0; k < 9; k++) P.push(at(box(w, 0.02, 0.02, wd[2]), [w / 2, 0.3 + k * 0.28, 0.01]));
    if (pat === "grid") for (let k = 0; k < w; k++) P.push(at(box(0.03, H, 0.02, wd[2]), [k + 0.5, H / 2, 0.01]));
    // Skirting.
    P.push(at(box(w, 0.14, 0.04, 0xffffff), [w / 2, 0.07, 0.02]));
    // A dark void round the room so the outside never shows.
    P.push(at(box(w + 40, 0.1, d + 40, 0x2a2420), [w / 2, -0.2, d / 2]));
    P.push(at(box(w + 40, 16, 0.2, 0x2a2420), [w / 2, 6, -0.6]));
    for (const s of [-1, 1]) P.push(at(box(0.2, 16, d + 40, 0x2a2420), [w / 2 + s * (w / 2 + 0.6), 6, d / 2]));
    const g = new THREE.Group();
    const m = new THREE.Mesh(merge(P), M);
    m.receiveShadow = true;
    g.add(m);
    // Door mat at the front.
    const mat2 = new THREE.Mesh(merge([at(box(1.2, 0.02, 0.6, 0x8a5a3a), [w / 2, 0.01, d - 0.3])]), M);
    g.add(mat2);
    return { g, parts: P };
  }

  private addFurn(r: Room, id: string, x: number, z: number, rot: number): void {
    const [, fid, v] = id.split(":");
    const def = FURN_BY_ID.get(fid);
    if (!def) return;
    const m = new THREE.Mesh(furnGeometry(fid, +v), M);
    m.castShadow = m.receiveShadow = true;
    const [sw, sd] = rot % 2 ? [def.size[1], def.size[0]] : def.size;
    m.position.set(x + sw / 2, 0, z + sd / 2);
    m.rotation.y = (rot * Math.PI) / 2;
    m.userData.furn = { id, x, z, rot };
    r.group.add(m);
    for (let dz = 0; dz < sd; dz++) for (let dx = 0; dx < sw; dx++) if (def.cat !== "decor" || fid !== "rug") r.solid.add(this.key(x + dx, z + dz));
  }

  private keeper(r: Room, kind: Parameters<typeof keeperLook>[0], name: string, x: number, z: number, talk: () => Promise<void>): void {
    const look = keeperLook(kind);
    const rig = buildRig(look);
    rig.root.position.set(x, 0, z);
    r.group.add(rig.root);
    r.keeper = { name, look, rig, anim: new Animator(rig), pos: new THREE.Vector3(x, 0, z), talk };
    r.solid.add(this.key(Math.floor(x), Math.floor(z)));
  }

  private build(kind: string, b: Building): Room {
    const g = this.g;
    const p = g.profile;
    if (kind === "home") {
      const s = p.home.size;
      const { g: grp } = this.shell(s, s, p.home.wall, p.home.floor);
      const r: Room = { kind, group: grp, w: s, d: s, solid: new Set(), b };
      for (const it of p.home.items) this.addFurn(r, it.id, it.x, it.z, it.rot);
      return r;
    }
    if (kind === "shop") {
      const { g: grp } = this.shell(8, 6, 2, 0);
      const r: Room = { kind, group: grp, w: 8, d: 6, solid: new Set(), b };
      this.addFurn(r, "furn:counter:0", 3, 1, 0);
      // Shelves of the day's goods.
      const stock = g.services.stock();
      stock.furniture.slice(0, 6).forEach((id, k) => this.addFurn(r, id, k < 3 ? 0 : 7, 1 + (k % 3) * 1.5, k < 3 ? 1 : 3));
      this.keeper(r, "beaver", "보리", 4, 0.7, () => g.services.shop());
      return r;
    }
    if (kind === "museum") {
      const { g: grp } = this.shell(12, 9, 8, 6);
      const r: Room = { kind, group: grp, w: 12, d: 9, solid: new Set(), b };
      this.keeper(r, "hedgehog", "솔방울 박사", 6, 1.2, () => g.services.museum());
      this.displays(r);
      return r;
    }
    if (kind === "office") {
      const { g: grp } = this.shell(9, 6, 9, 1);
      const r: Room = { kind, group: grp, w: 9, d: 6, solid: new Set(), b };
      this.addFurn(r, "furn:counter:1", 3, 1, 0);
      this.addFurn(r, "furn:desk:0", 7, 1, 0);
      this.addFurn(r, "furn:potted:0", 0, 0, 0);
      this.addFurn(r, "furn:bookshelf:0", 1, 0, 0);
      this.keeper(r, "capybara", "카피", 4, 0.7, () => g.services.office());
      return r;
    }
    // A neighbour's room: furniture from their seed.
    const n = g.villagers.byId(b.owner!)!;
    const R = rng(n.v.seed * 13);
    const { g: grp } = this.shell(6, 6, Math.floor(R() * WALLS.length), Math.floor(R() * FLOORS.length));
    const r: Room = { kind, group: grp, w: 6, d: 6, solid: new Set(), b };
    const beds = FURNITURE.filter((f) => f.cat === "bed" && f.size[0] <= 2);
    const bed = beds[Math.floor(R() * beds.length)];
    this.addFurn(r, `furn:${bed.id}:${Math.floor(R() * bed.colors.length)}`, 0, 0, 0);
    const small = FURNITURE.filter((f) => f.size[0] === 1 && f.size[1] === 1 && f.cat !== "outdoor");
    for (let k = 0; k < 7; k++) {
      const f = small[Math.floor(R() * small.length)];
      const x = 2 + Math.floor(R() * 4);
      const z = Math.floor(R() * 4);
      if (!r.solid.has(this.key(x, z))) this.addFurn(r, `furn:${f.id}:${Math.floor(R() * f.colors.length)}`, x, z, 0);
    }
    return r;
  }

  /** Tanks, cases and stands for what's been donated. */
  private displays(r: Room): void {
    const donated = this.g.island.museum;
    const fish = donated.filter((d) => d.startsWith("fish:"));
    const bugs = donated.filter((d) => d.startsWith("bug:"));
    const fossils = donated.filter((d) => d.startsWith("fossil:"));
    const P: Part[] = [];
    // Left wall: framed aquarium tanks with sand, weed and stones; right wall: glass-domed bug
    // cases on pedestals; middle: fossil plinths with brass plaques; a runner carpet down the hall.
    for (let k = 0; k < 4; k++) {
      const z = 1.5 + k * 1.8;
      P.push(at(rbox(1.9, 0.55, 1.0, 0.04, 0x6a4a34), [0.95, 0.28, z]));
      P.push(at(box(1.8, 0.1, 0.9, 0xe8d8a8), [0.95, 0.6, z]));
      for (let j = 0; j < 3; j++) P.push(at(cyl(0.015, 0.02, 0.4 + j * 0.1, 0x3a9a4a, 5), [0.4 + j * 0.5, 0.8 + j * 0.05, z - 0.25 + (j % 2) * 0.3], [0.1 * j, 0, 0.15 * (j - 1)]));
      P.push(at(blob(0.12, 0x9a9aa0, 0.2, k, 1), [1.4, 0.68, z + 0.2], [0, 0, 0], [1.2, 0.6, 1]));
      for (const [x, zz] of [[0.05, -0.45], [1.85, -0.45], [0.05, 0.45], [1.85, 0.45]] as [number, number][]) P.push(at(box(0.06, 1.05, 0.06, 0x3a3a40), [x, 1.05, z + zz]));
      P.push(at(box(1.9, 0.06, 1.0, 0x3a3a40), [0.95, 1.58, z]));
      r.solid.add(this.key(0, 1 + k * 2)).add(this.key(1, 1 + k * 2)).add(this.key(0, 2 + k * 2)).add(this.key(1, 2 + k * 2));
      P.push(at(cyl(0.18, 0.22, 0.8, 0xe8e0d0, 12), [11.1, 0.4, z]));
      P.push(at(cyl(0.3, 0.3, 0.06, 0x8a6a4a, 16), [11.1, 0.83, z]));
      r.solid.add(this.key(10, 1 + k * 2)).add(this.key(11, 1 + k * 2)).add(this.key(10, 2 + k * 2)).add(this.key(11, 2 + k * 2));
    }
    for (let k = 0; k < 6; k++) {
      const x = 3.5 + (k % 3) * 2.5;
      const z = 3.5 + Math.floor(k / 3) * 2.5;
      P.push(at(rbox(1.2, 0.35, 1.2, 0.05, 0xd8d4cc), [x, 0.18, z]));
      P.push(at(rbox(1.0, 0.06, 1.0, 0.03, 0x5a6a8a), [x, 0.38, z]));
      P.push(at(box(0.4, 0.14, 0.03, 0xd8b050), [x, 0.3, z + 0.61], [-0.3, 0, 0]));
      r.solid.add(this.key(Math.floor(x), Math.floor(z)));
    }
    P.push(at(box(2.2, 0.02, 8.0, 0x8a3a4a), [6, 0.01, 4.8]));
    for (let k = 0; k < 2; k++) P.push(at(box(2.3, 0.021, 0.1, 0xd8b050), [6, 0.012, 0.85 + k * 7.9]));
    const m = new THREE.Mesh(merge(P), M);
    m.receiveShadow = true;
    r.group.add(m);
    const glass = new THREE.MeshBasicMaterial({ color: 0x7ac8f0, transparent: true, opacity: 0.3, depthWrite: false });
    for (let k = 0; k < 4; k++) {
      const tank = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.95, 0.88), glass);
      tank.position.set(0.95, 1.1, 1.5 + k * 1.8);
      r.group.add(tank);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.25, depthWrite: false }));
      dome.position.set(11.1, 0.86, 1.5 + k * 1.8);
      r.group.add(dome);
    }
    fish.slice(0, 16).forEach((id, k) => {
      const f = new THREE.Mesh(fishModel(item(id).critter!), M);
      f.position.set(0.5 + (k % 2) * 0.8, 0.95 + ((k >> 1) % 2) * 0.3, 1.3 + Math.floor(k / 4) * 1.8 + ((k >> 1) % 2) * 0.3);
      f.rotation.y = Math.PI / 2;
      f.userData.swim = k;
      r.group.add(f);
    });
    bugs.slice(0, 16).forEach((id, k) => {
      const b = new THREE.Mesh(bugModel(item(id).critter!), M);
      b.position.set(11.1 + ((k % 4) - 1.5) * 0.08, 0.9, 1.5 + Math.floor(k / 4) * 1.8 + ((k % 4) - 1.5) * 0.09);
      b.scale.setScalar(1.3);
      r.group.add(b);
    });
    fossils.slice(0, 6).forEach((id, k) => {
      const x = 3.5 + (k % 3) * 2.5;
      const z = 3.5 + Math.floor(k / 3) * 2.5;
      const f = new THREE.Mesh(fossilModel(id), M);
      f.position.set(x, 0.42, z);
      f.castShadow = true;
      r.group.add(f);
    });
  }

  // ---------------------------------------------------------------- in and out

  async enter(kind: string, b: Building): Promise<void> {
    const g = this.g;
    if (kind === "house") {
      const n = g.villagers.byId(b.owner!);
      if (n && !n.inside && clock.hour() >= 6 && clock.hour() < 22) {
        await g.ui.say("", [`${n.v.name}은(는) 외출 중인 것 같다.`.replace("은(는)", /[가-힣]$/.test(n.v.name) && (n.v.name.charCodeAt(n.v.name.length - 1) - 0xac00) % 28 ? "은" : "는")]);
        return;
      }
      const h = clock.hour();
      if (h >= 23 || h < 6) {
        await g.ui.say("", ["불이 꺼져 있다. 이미 자고 있나 보다…"]);
        return;
      }
    }
    if (kind === "shop" && (clock.hour() < 8 || clock.hour() >= 22)) {
      await g.ui.say("", ["잡화점은 문을 닫았다. (영업 8시~22시)"]);
      return;
    }
    g.busy++;
    sfx("door");
    await g.ui.fade(true);
    const r = this.build(kind, b);
    r.group.position.copy(ORIGIN);
    r.group.add(this.light);
    this.light.position.set(r.w / 2, 2.4, r.d / 2);
    g.stage.scene.add(r.group);
    g.world.group.visible = false;
    g.fx.group.visible = true;
    this.room = r;
    g.where = kind;
    this.hostOf = kind === "house" ? (b.owner ?? null) : null;
    const P = g.player;
    P.pos.set(ORIGIN.x + r.w / 2, 0, ORIGIN.z + r.d - 0.6);
    P.yaw = Math.PI;
    if (kind === "house") {
      const n = g.villagers.byId(b.owner!);
      if (n) {
        n.p.pos.set(ORIGIN.x + 3.5, 0, ORIGIN.z + 2.5);
        n.p.hidden = false;
        n.p.setHold(clock.hour() >= 22 ? "sleep" : "none");
        if (clock.hour() >= 22) n.p.pos.set(ORIGIN.x + 1, 0.45, ORIGIN.z + 1);
      }
    }
    this.camPos.set(0, 0, 0);
    await g.ui.fade(false);
    g.busy--;
    if (kind === "home" && !g.profile.home.items.length && !g.profile.recipes.includes("_homeTip")) {
      g.profile.recipes.push("_homeTip");
      await g.ui.say("", ["여기가 우리 집! 가방에서 가구를 골라 '방에 두기'로 꾸밀 수 있다.", "옷장이나 서랍장을 두면 보관함을 쓸 수 있다."]);
    }
  }

  async exit(): Promise<void> {
    const g = this.g;
    const r = this.room;
    if (!r) return;
    g.busy++;
    sfx("door");
    await g.ui.fade(true);
    g.stage.scene.remove(r.group);
    g.world.group.visible = true;
    this.room = null;
    if (this.hostOf) {
      const n = g.villagers.byId(this.hostOf);
      if (n) {
        n.p.setHold("none");
        const [dx, dz] = r.b.door;
        n.p.pos.set(dx + 0.5, g.world.groundY(dx + 0.5, dz + 0.5), dz + 0.5);
      }
    }
    this.hostOf = null;
    g.where = "out";
    const [x, z] = r.b.door;
    g.player.pos.set(x + 0.5, g.world.groundY(x + 0.5, z + 0.8), z + 0.8);
    g.player.yaw = 0;
    g.stage.focus.copy(g.player.pos);
    await g.ui.fade(false);
    g.busy--;
  }

  rebuild(): void {
    const r = this.room;
    if (!r) return;
    const g = this.g;
    g.stage.scene.remove(r.group);
    const nr = this.build(r.kind, r.b);
    nr.group.position.copy(ORIGIN);
    nr.group.add(this.light);
    g.stage.scene.add(nr.group);
    this.room = nr;
  }

  // ---------------------------------------------------------------- inside

  private local(): [number, number] {
    const P = this.g.player.pos;
    return [P.x - ORIGIN.x, P.z - ORIGIN.z];
  }

  walk(dt: number, pad: Pad): void {
    const r = this.room!;
    const P = this.g.player;
    const [lx, lz] = this.local();
    // Walk out of the door.
    if (lz > r.d - 0.4 && pad.z > 0.5 && Math.abs(lx - r.w / 2) < 1) {
      void this.exit();
      return;
    }
    const want = Math.hypot(pad.x, pad.z);
    const sp = pad.run ? 4 : 2.4;
    P.vx += (pad.x * sp - P.vx) * Math.min(1, dt * 14);
    P.vz += (pad.z * sp - P.vz) * Math.min(1, dt * 14);
    if (want > 0.01) {
      const ty = Math.atan2(pad.x, pad.z);
      P.yaw += Math.atan2(Math.sin(ty - P.yaw), Math.cos(ty - P.yaw)) * Math.min(1, dt * 14);
    }
    const ok = (x: number, z: number) => x > 0.3 && z > 0.3 && x < r.w - 0.3 && z < r.d - 0.2 && !r.solid.has(this.key(Math.floor(x), Math.floor(z)));
    const nx = lx + P.vx * dt;
    const nz = lz + P.vz * dt;
    if (ok(nx, nz)) {
      P.pos.x = ORIGIN.x + nx;
      P.pos.z = ORIGIN.z + nz;
    } else if (ok(nx, lz)) P.pos.x = ORIGIN.x + nx;
    else if (ok(lx, nz)) P.pos.z = ORIGIN.z + nz;
    P.speed = Math.hypot(P.vx, P.vz);
    P.running = pad.run && P.speed > 3;
    P.pos.y = 0;
  }

  actionFor(): Action | null {
    const r = this.room;
    if (!r) return null;
    const g = this.g;
    const P = g.player;
    const [lx, lz] = this.local();
    const fx = Math.floor(lx + Math.sin(P.yaw) * 0.8);
    const fz = Math.floor(lz + Math.cos(P.yaw) * 0.8);
    if (r.keeper) {
      const k = r.keeper;
      const d = Math.hypot(k.pos.x - lx, k.pos.z - lz);
      if (d < 2.3) return { label: `${k.name}에게 말 걸기`, run: () => this.talkKeeper() };
    }
    if (r.kind === "house" && this.hostOf) {
      const n = g.villagers.byId(this.hostOf);
      if (n && n.p.pos.distanceTo(P.pos) < 1.6) {
        if (n.p.anim.hold === "sleep") return { label: `${n.v.name}이(가) 자고 있다`, run: () => g.ui.say("", ["쿨쿨… 깨우지 말자."]).then(() => {}) };
        return { label: `${n.v.name}에게 말 걸기`, run: () => g.villagers.talk(n) };
      }
    }
    // Furniture in front.
    const m = r.group.children.find((c) => c.userData.furn && fx >= c.userData.furn.x && fz >= c.userData.furn.z && fx < c.userData.furn.x + FURN_BY_ID.get(c.userData.furn.id.split(":")[1])!.size[c.userData.furn.rot % 2 ? 1 : 0] && fz < c.userData.furn.z + FURN_BY_ID.get(c.userData.furn.id.split(":")[1])!.size[c.userData.furn.rot % 2 ? 0 : 1]);
    if (m) {
      const f = m.userData.furn as Placed;
      const def = FURN_BY_ID.get(f.id.split(":")[1])!;
      return { label: `${item(f.id).name}`, run: () => this.useFurn(f, def.use) };
    }
    if (lz > r.d - 1.2 && Math.abs(lx - r.w / 2) < 1) return { label: "밖으로 나가기", run: () => this.exit() };
    return null;
  }

  private async talkKeeper(): Promise<void> {
    const k = this.room!.keeper!;
    k.anim.talking = true;
    await k.talk();
    k.anim.talking = false;
  }

  private async useFurn(f: Placed, use: string | null): Promise<void> {
    const g = this.g;
    const home = this.room?.kind === "home";
    const opts: string[] = [];
    if (use === "sit") opts.push("앉기");
    if (use === "lie") opts.push("눕기");
    if (use === "music") opts.push("음악 틀기");
    if (use === "tv") opts.push("텔레비전 보기");
    if (use === "open" && home) opts.push("보관함 열기");
    if (home) opts.push("돌리기", "집어넣기");
    opts.push("그만두기");
    const k = await g.ui.say("", [`${item(f.id).name}.`], { choices: opts });
    const c = opts[k];
    if (c === "앉기" || c === "눕기") {
      g.player.setHold(c === "앉기" ? "sit" : "sleep");
      g.player.pos.set(ORIGIN.x + f.x + 0.5, c === "눕기" ? 0.45 : 0.25, ORIGIN.z + f.z + 0.5);
      await g.ui.say("", [c === "앉기" ? "잠깐 쉬어 가자…" : "폭신폭신… 스르르…"]);
      g.player.setHold("none");
      g.player.pos.y = 0;
      g.player.pos.z = ORIGIN.z + f.z + 1.5;
    }
    if (c === "음악 틀기") {
      sfx("fanfare");
      g.fx.emit("note", g.player.pos.clone().add(new THREE.Vector3(0, 1.4, 0)), 6, { up: 1, grav: -0.3, life: 1.5, size: 0.25, spread: 1 });
    }
    if (c === "텔레비전 보기") await g.ui.say("", ["…오늘의 날씨. 섬에는 " + { sun: "맑은 하늘이", cloud: "구름이", rain: "비가", storm: "폭풍이", snow: "눈이" }[g.weather.kind] + " 이어지겠습니다."]);
    if (c === "보관함 열기") await this.storage();
    if (c === "돌리기" || c === "집어넣기") {
      const items = g.profile.home.items;
      const i = items.findIndex((x) => x.x === f.x && x.z === f.z && x.id === f.id);
      if (i < 0) return;
      if (c === "돌리기") items[i].rot = (items[i].rot + 1) % 4;
      else {
        items.splice(i, 1);
        g.give(f.id, 1);
      }
      sfx("drop");
      this.rebuild();
    }
  }

  /** Put a piece of furniture down in the home, in front of the player. */
  placeHome(id: string): void {
    const g = this.g;
    const r = this.room;
    if (!r || r.kind !== "home") return;
    const def = FURN_BY_ID.get(id.split(":")[1])!;
    const P = g.player;
    const [lx, lz] = this.local();
    const rot = (P.dir4() + 2) % 4;
    const [sw, sd] = rot % 2 ? [def.size[1], def.size[0]] : def.size;
    const fx = Math.floor(lx + Math.sin(P.yaw) * 1.1 - (sw - 1) / 2);
    const fz = Math.floor(lz + Math.cos(P.yaw) * 1.1 - (sd - 1) / 2);
    for (let dz = 0; dz < sd; dz++)
      for (let dx = 0; dx < sw; dx++) {
        const x = fx + dx;
        const z = fz + dz;
        if (x < 0 || z < 0 || x >= r.w || z >= r.d - 1 || r.solid.has(this.key(x, z)) || (Math.floor(lx) === x && Math.floor(lz) === z)) {
          g.ui.toast("거기엔 놓을 자리가 없어.");
          sfx("fail");
          return;
        }
      }
    g.pockets.take(id, 1);
    g.profile.home.items.push({ id, x: fx, z: fz, rot: rot === 1 || rot === 3 ? (rot + 2) % 4 : rot });
    sfx("drop");
    this.rebuild();
  }

  decorate(slot: number): void {
    const g = this.g;
    const s = g.pockets.slots[slot];
    if (!s) return;
    const d = item(s.id);
    const k = +s.id.split(":")[1];
    g.pockets.takeAt(slot);
    if (d.kind === "wall") {
      g.pockets.add(`wall:${g.profile.home.wall}`);
      g.profile.home.wall = k;
    } else {
      g.pockets.add(`floor:${g.profile.home.floor}`);
      g.profile.home.floor = k;
    }
    sfx("joy");
    this.rebuild();
  }

  store(slot: number): void {
    const g = this.g;
    const s = g.pockets.takeAt(slot, 999);
    if (!s) return;
    g.pockets.storage.push(s);
    g.ui.toast(`${josa(item(s.id).name, "을를")} 보관함에 넣었다.`);
  }

  private async storage(): Promise<void> {
    const g = this.g;
    const st = g.pockets.storage;
    if (!st.length) {
      await g.ui.say("", ["보관함이 비어 있다. 가방에서 '보관함에 넣기'로 넣을 수 있다."]);
      return;
    }
    await g.ui.menu(
      "보관함",
      st.map((s) => ({ label: item(s.id).name, icon: s.id, right: s.n > 1 ? `×${s.n}` : "" })),
      {
        onPick: (i) => {
          const s = st[i];
          if (!s) return true;
          if (!g.pockets.fits(s.id, s.n)) {
            g.ui.toast("주머니가 가득 찼어.");
            return false;
          }
          st.splice(i, 1);
          g.pockets.add(s.id, s.n, s.wear);
          g.ui.toast(`${josa(item(s.id).name, "을를")} 꺼냈다.`, s.id);
          return st.length === 0;
        },
      },
    );
  }

  camera(dt: number): void {
    const r = this.room;
    if (!r) return;
    const st = this.g.stage;
    const P = this.g.player.pos;
    const cx = ORIGIN.x + r.w / 2 + (P.x - ORIGIN.x - r.w / 2) * 0.35;
    const want = new THREE.Vector3(cx, 7 + r.d * 0.45, ORIGIN.z + r.d + 5.5 + r.d * 0.25);
    if (this.camPos.lengthSq() === 0) this.camPos.copy(want);
    this.camPos.lerp(want, 1 - Math.exp(-dt * 6));
    st.camera.position.copy(this.camPos);
    st.camera.lookAt(cx, 0.5, ORIGIN.z + r.d * 0.55);
    st.focus.set(ORIGIN.x + r.w / 2, 0, ORIGIN.z + r.d / 2);
    st.sun.target.position.copy(st.focus);
    st.sun.position.copy(st.focus).add(new THREE.Vector3(3, 20, 12));
  }

  update(dt: number): void {
    const r = this.room;
    if (!r) return;
    if (r.keeper) {
      const k = r.keeper;
      const P = this.g.player.pos;
      const want = Math.atan2(P.x - ORIGIN.x - k.pos.x, P.z - ORIGIN.z - k.pos.z);
      k.rig.root.rotation.y += Math.atan2(Math.sin(want - k.rig.root.rotation.y), Math.cos(want - k.rig.root.rotation.y)) * Math.min(1, dt * 4);
      k.anim.update(dt, 0);
    }
    const t = this.g.stage.time.value;
    for (const c of r.group.children) if (c.userData.swim !== undefined) c.position.z += Math.sin(t * 1.2 + c.userData.swim) * 0.004;
  }
}

/** A fossil on a stand: a jumble of bones shaped by its id. */
export function fossilModel(id: string): THREE.BufferGeometry {
  const R = rng([...id].reduce((s, c) => s * 31 + c.charCodeAt(0), 7));
  const P: Part[] = [];
  const bone = 0xe8dcc0;
  const skull = id.includes("skull") || id.includes("sabertooth");
  if (skull) {
    P.push(at(box(0.5, 0.35, 0.7, bone), [0, 0.35, 0]));
    P.push(at(box(0.08, 0.08, 0.08, 0x3a3020), [0.18, 0.45, 0.2]));
    P.push(at(box(0.08, 0.08, 0.08, 0x3a3020), [-0.18, 0.45, 0.2]));
    for (let k = 0; k < 6; k++) P.push(at(box(0.04, 0.1, 0.04, 0xffffff), [-0.2 + k * 0.08, 0.13, 0.32]));
    if (id.includes("tri")) for (const s of [-1, 1]) P.push(at(box(0.06, 0.4, 0.06, bone), [s * 0.15, 0.7, 0.2], [0.5, 0, 0]));
  } else {
    const n = 5 + Math.floor(R() * 5);
    for (let k = 0; k < n; k++) P.push(at(box(0.1, 0.1 + R() * 0.2, 0.4 + R() * 0.3, bone), [(R() - 0.5) * 0.5, 0.2 + R() * 0.4, (R() - 0.5) * 0.5], [R() * 2, R() * 3, R() * 2]));
  }
  return merge(P);
}

void josa;
