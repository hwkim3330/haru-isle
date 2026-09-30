/**
 * The neighbours' lives. Each resident wakes and sleeps by temperament, walks the island on
 * real paths (A* over the tiles, ramps and bridges included), and picks something to do:
 * stroll to the plaza, sing, read, exercise, fish, chase bugs, water flowers, chat with a
 * neighbour, come over to say hi. Talking picks lines for the hour, weather, season, hobby,
 * gossip and your latest catch; gifts, favours and friendship build over the days. Campers
 * visit and, if you ask, move in.
 */
import * as THREE from "three";
import { sfx } from "../audio/sound";
import type { Hold } from "../char/anim";
import { clock, inHours } from "../core/clock";
import { rng } from "../core/noise";
import { BUGS, FISH, inSeason } from "../data/critters";
import { ASK, BYE, CATCH_TALK, CLOUD_SHAPES, CRAZES, FIRST, fill, GOSSIP, GREET, HOBBY, ISLAND, OPEN, pick, SEASON, THANKS, WEATHER } from "../data/dialogue";
import { item, ITEMS, josa } from "../data/items";
import { HOBBIES, makeVillager, SPECIES, STYLES, TEMPERS, type Villager } from "../data/species";
import { FURNITURE } from "../render/furniture";
import { DX, DZ, H, idx, inside, W } from "../world/island";
import type { Game } from "./game";
import { Person } from "./player";
import type { Resident } from "./save";

type Task = { kind: "go"; path: [number, number][]; i: number; then?: Task } | { kind: "hold"; hold: Hold; t: number } | { kind: "idle"; t: number } | { kind: "home" } | { kind: "chat"; with: NPC; t: number } | { kind: "visit"; t: number };

export class NPC {
  p: Person;
  task: Task = { kind: "idle", t: 1 };
  inside = false;
  talking = false;
  bubble: HTMLDivElement;
  bubbleT = 0;
  path: [number, number][] | null = null;
  constructor(
    readonly v: Villager,
    readonly r: Resident,
    scene: THREE.Object3D,
  ) {
    this.p = new Person(scene, v.look, v.name);
    this.bubble = document.createElement("div");
    this.bubble.className = "bubble";
    this.bubble.hidden = true;
    document.getElementById("ui")!.appendChild(this.bubble);
  }

  vars(g: Game, extra: Record<string, string> = {}): Record<string, string> {
    const n = this.v.name;
    const c = n.charCodeAt(n.length - 1);
    const fin = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
    return { p: g.profile.name, me: n, meYa: n + (fin ? "이야" : "야"), meYe: n + (fin ? "이에요" : "예요"), meDa: n + (fin ? "이다" : "다"), meRa: n + (fin ? "이라고" : "라고"), c: this.v.catch, ...extra };
  }
}

export class Villagers {
  readonly list: NPC[] = [];
  private readonly g: Game;
  private camperNpc: NPC | null = null;
  private lastCatch: string | null = null;
  /** Visiting: neighbours are driven by the host's updates, not by our own planning. */
  puppetMode = false;
  private targets = new Map<string, { x: number; y: number; z: number; yaw: number; s: number; h: boolean; hold: string }>();

  constructor(g: Game) {
    this.g = g;
    const isl = g.island;
    if (!isl.residents.length) {
      // A new island: five neighbours of five different kinds.
      const taken = new Set<string>();
      const R = rng(isl.seed * 17 + 5);
      for (let k = 0; k < 5; k++) {
        const v = makeVillager(Math.floor(R() * 1e9), taken);
        taken.add(v.species);
        isl.residents.push({ seed: v.seed, friend: 0, talkedDay: -1, giftDay: -1, plot: k, movedIn: clock.day() });
      }
    }
    for (const r of isl.residents) this.list.push(new NPC(makeVillager(r.seed), r, g.stage.scene));
  }

  byId(id: string): NPC | undefined {
    return this.list.find((n) => n.v.id === id);
  }

  /** Villagers in plot order, for the houses. */
  houseOrder(): (Villager | null)[] {
    const plots = this.g.world.I.plots.filter((p) => p.kind === "house").length;
    const out: (Villager | null)[] = new Array(plots).fill(null);
    for (const n of this.list) if (n.r.plot < plots) out[n.r.plot] = n.v;
    return out;
  }

  save(): Resident[] {
    return this.list.map((n) => n.r);
  }

  noteCatch(name: string): void {
    this.lastCatch = name;
  }

  // ---------------------------------------------------------------- the day

  private house(n: NPC) {
    return this.g.world.building("house", n.v.id);
  }

  private awake(n: NPC, h: number): boolean {
    const t = TEMPERS[n.v.temper];
    return inHours(h, t.wake, t.sleep);
  }

  /** Place everyone for the start of a day (or when the game loads). */
  morning(): void {
    const h = clock.hour();
    for (const n of this.list) {
      const b = this.house(n);
      if (!b) continue;
      const [dx, dz] = b.door;
      if (!this.awake(n, h)) {
        n.inside = true;
        n.p.hidden = true;
        n.p.pos.set(dx + 0.5, this.g.world.groundY(dx + 0.5, dz + 0.5), dz + 0.5);
        n.task = { kind: "home" };
        continue;
      }
      // Somewhere near home.
      const t = this.randomSpot(dx, dz, 10) ?? [dx, dz];
      n.inside = false;
      n.p.hidden = false;
      n.p.pos.set(t[0] + 0.5, this.g.world.groundY(t[0] + 0.5, t[1] + 0.5), t[1] + 0.5);
      n.task = { kind: "idle", t: Math.random() * 3 };
    }
    this.rollCamper();
  }

  private randomSpot(x0: number, z0: number, r: number): [number, number] | null {
    const w = this.g.world;
    for (let k = 0; k < 40; k++) {
      const x = Math.floor(x0 + (Math.random() - 0.5) * r * 2);
      const z = Math.floor(z0 + (Math.random() - 0.5) * r * 2);
      if (w.passable(x, z) && !w.obj(x, z)) return [x, z];
    }
    return null;
  }

  /** A* over walkable tiles with the same step rule the player has. */
  findPath(from: [number, number], to: [number, number], limit = 4000): [number, number][] | null {
    const w = this.g.world;
    const s = idx(from[0], from[1]);
    const t = idx(to[0], to[1]);
    if (!inside(to[0], to[1]) || !w.passable(to[0], to[1])) return null;
    const g = new Map<number, number>([[s, 0]]);
    const came = new Map<number, number>();
    const open: [number, number][] = [[0, s]];
    const hy = (i: number) => w.groundY((i % W) + 0.5, Math.floor(i / W) + 0.5);
    let n = 0;
    while (open.length && n++ < limit) {
      let bi = 0;
      for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
      const [, i] = open.splice(bi, 1)[0];
      if (i === t) {
        const path: [number, number][] = [];
        let c = i;
        while (c !== s) {
          path.push([c % W, Math.floor(c / W)]);
          c = came.get(c)!;
        }
        return path.reverse();
      }
      const x = i % W;
      const z = Math.floor(i / W);
      const yi = hy(i);
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d];
        const nz = z + DZ[d];
        if (!inside(nx, nz) || !w.passable(nx, nz)) continue;
        const j = idx(nx, nz);
        if (Math.abs(hy(j) - yi) > 0.5) continue;
        const ng = g.get(i)! + 1 + (w.obj(nx, nz) ? 0.5 : 0);
        if (ng < (g.get(j) ?? Infinity)) {
          g.set(j, ng);
          came.set(j, i);
          open.push([ng + Math.abs(nx - to[0]) + Math.abs(nz - to[1]), j]);
        }
      }
    }
    return null;
  }

  private goTo(n: NPC, to: [number, number], then?: Task): boolean {
    const from: [number, number] = [Math.floor(n.p.pos.x), Math.floor(n.p.pos.z)];
    const path = this.findPath(from, to);
    if (!path) return false;
    n.task = { kind: "go", path, i: 0, then };
    return true;
  }

  /** Choose the next thing to do. */
  private plan(n: NPC): void {
    const w = this.g.world;
    const h = clock.hour();
    const b = this.house(n);
    if (!b) return;
    if (!this.awake(n, h) || (this.g.weather.kind === "storm" && Math.random() < 0.7)) {
      if (!this.goTo(n, b.door, { kind: "home" })) n.task = { kind: "home" };
      return;
    }
    const r = Math.random();
    const P = this.g.player;
    const office = w.plot("office");
    const hobby = n.v.hobby;
    // Come over to say hello now and then.
    if (r < 0.06 && this.g.where === "out" && P.pos.distanceTo(n.p.pos) < 18) {
      const t: [number, number] = [Math.floor(P.pos.x) + (Math.random() < 0.5 ? 1 : -1), Math.floor(P.pos.z) + 1];
      if (this.goTo(n, t, { kind: "visit", t: 6 })) return;
    }
    // Hobby time.
    if (r < 0.32) {
      if (hobby === "fishing") {
        const spot = this.nearWater(n);
        if (spot && this.goTo(n, spot, { kind: "hold", hold: "fish", t: 12 + Math.random() * 10 })) return;
      }
      const holds: Record<string, Hold> = { music: "sing", fitness: "exercise", reading: "read", bugs: "net", nature: "none", fashion: "none", play: "none", fishing: "none" };
      const hold = holds[hobby];
      const spot = office && Math.random() < 0.5 ? this.randomSpot(office.x + 3, office.z + 5, 4) : this.randomSpot(Math.floor(n.p.pos.x), Math.floor(n.p.pos.z), 8);
      if (spot && hold !== "none" && this.goTo(n, spot, { kind: "hold", hold, t: 8 + Math.random() * 8 })) return;
    }
    // Chat with someone.
    if (r < 0.42) {
      const other = this.list.find((o) => o !== n && !o.inside && o.task.kind !== "chat" && !o.talking && o.p.pos.distanceTo(n.p.pos) < 14);
      if (other) {
        const t: [number, number] = [Math.floor(other.p.pos.x) + 1, Math.floor(other.p.pos.z)];
        if (this.goTo(n, t, { kind: "chat", with: other, t: 8 })) {
          other.task = { kind: "chat", with: n, t: 12 };
          return;
        }
      }
    }
    // Stroll: the plaza, the beach, near home.
    const choices: [number, number][] = [];
    if (office) choices.push([office.x + 3, office.z + 5]);
    choices.push(b.door);
    const beach = this.randomBeach();
    if (beach) choices.push(beach);
    const c = pick(choices);
    const spot = this.randomSpot(c[0], c[1], 6);
    if (spot && this.goTo(n, spot, { kind: "idle", t: 2 + Math.random() * 5 })) return;
    n.task = { kind: "idle", t: 3 };
  }

  private nearWater(n: NPC): [number, number] | null {
    const w = this.g.world;
    const x0 = Math.floor(n.p.pos.x);
    const z0 = Math.floor(n.p.pos.z);
    for (let k = 0; k < 80; k++) {
      const x = x0 + Math.floor((Math.random() - 0.5) * 30);
      const z = z0 + Math.floor((Math.random() - 0.5) * 30);
      if (!w.passable(x, z)) continue;
      for (let d = 0; d < 4; d++) if (w.waterAt(x + DX[d], z + DZ[d])) return [x, z];
    }
    return null;
  }

  private randomBeach(): [number, number] | null {
    const I = this.g.world.I;
    for (let k = 0; k < 60; k++) {
      const x = Math.floor(Math.random() * W);
      const z = Math.floor(Math.random() * H);
      if (I.kind[idx(x, z)] === 1 && I.seaDist[idx(x, z)] > 1.5 && this.g.world.passable(x, z)) return [x, z];
    }
    return null;
  }

  puppet(list: { id: string; x: number; y: number; z: number; yaw: number; s: number; h: boolean; hold: string }[]): void {
    this.puppetMode = true;
    for (const t of list) this.targets.set(t.id, t);
  }

  private updatePuppets(dt: number): void {
    for (const n of this.list) {
      const t = this.targets.get(n.v.id);
      if (!t || n.talking) {
        n.p.speed = 0;
        n.p.update(dt);
        continue;
      }
      const to = new THREE.Vector3(t.x, t.y, t.z);
      if (to.distanceTo(n.p.pos) > 5) n.p.pos.copy(to);
      else n.p.pos.lerp(to, 1 - Math.exp(-dt * 8));
      n.p.yaw += Math.atan2(Math.sin(t.yaw - n.p.yaw), Math.cos(t.yaw - n.p.yaw)) * Math.min(1, dt * 8);
      n.p.speed = t.s;
      n.inside = t.h;
      n.p.hidden = t.h;
      n.p.setHold(t.hold as Hold);
      n.p.update(dt);
    }
  }

  update(dt: number): void {
    const g = this.g;
    const h = clock.hour();
    if (this.puppetMode) return this.updatePuppets(dt);
    for (const n of this.list) {
      const P = n.p;
      if (n.talking) {
        P.speed = 0;
        const dx = g.player.pos.x - P.pos.x;
        const dz = g.player.pos.z - P.pos.z;
        P.yaw += Math.atan2(Math.sin(Math.atan2(dx, dz) - P.yaw), Math.cos(Math.atan2(dx, dz) - P.yaw)) * Math.min(1, dt * 8);
        P.update(dt);
        continue;
      }
      if (n.inside) {
        // Come out in the morning.
        if (this.awake(n, h) && Math.random() < dt * 0.05) {
          const b = this.house(n);
          if (b) {
            n.inside = false;
            P.hidden = false;
            P.pos.set(b.door[0] + 0.5, g.world.groundY(b.door[0] + 0.5, b.door[1] + 0.5), b.door[1] + 0.6);
            P.yaw = 0;
            n.task = { kind: "idle", t: 1 };
          }
        }
        P.hidden = !(g.where === "house" && g.interiors.hostOf === n.v.id);
        if (P.hidden) continue;
      }
      const t = n.task;
      switch (t.kind) {
        case "go": {
          const [tx, tz] = t.path[t.i];
          const gx = tx + 0.5;
          const gz = tz + 0.5;
          const dx = gx - P.pos.x;
          const dz = gz - P.pos.z;
          const d = Math.hypot(dx, dz);
          const sp = 2.1 * TEMPERS[n.v.temper].speed;
          if (d < 0.15) {
            t.i++;
            if (t.i >= t.path.length) n.task = t.then ?? { kind: "idle", t: 2 };
          } else {
            const step = Math.min(d, sp * dt);
            P.pos.x += (dx / d) * step;
            P.pos.z += (dz / d) * step;
            const ty = Math.atan2(dx, dz);
            P.yaw += Math.atan2(Math.sin(ty - P.yaw), Math.cos(ty - P.yaw)) * Math.min(1, dt * 10);
          }
          P.speed = sp;
          P.pos.y += (g.world.groundY(P.pos.x, P.pos.z) - P.pos.y) * Math.min(1, dt * 12);
          // Something new sits on the path? Re-plan.
          if (!g.world.passable(tx, tz)) n.task = { kind: "idle", t: 0.5 };
          break;
        }
        case "hold":
          P.speed = 0;
          P.setHold(t.hold);
          if (t.hold === "fish") P.hold("rod");
          if (t.hold === "net") P.hold("net");
          if (t.hold === "sing" && Math.random() < dt * 1.5) g.fx.emit("note", P.pos.clone().add(new THREE.Vector3(0, 1.3, 0)), 1, { up: 0.8, grav: -0.2, speed: 0.3, life: 1.4, size: 0.22 });
          t.t -= dt;
          if (t.t <= 0) {
            P.setHold("none");
            P.hold(null);
            n.task = { kind: "idle", t: 1 };
          }
          break;
        case "chat": {
          P.speed = 0;
          const o = t.with.p.pos;
          P.yaw = Math.atan2(o.x - P.pos.x, o.z - P.pos.z);
          t.t -= dt;
          if (Math.random() < dt * 0.6) this.bubbleFor(n, pick(["…", "하하!", "그렇구나~", "정말?", "♪", "음음", "헤헤"]));
          if (t.t <= 0) n.task = { kind: "idle", t: 1 };
          break;
        }
        case "visit": {
          P.speed = 0;
          const pp = g.player.pos;
          P.yaw = Math.atan2(pp.x - P.pos.x, pp.z - P.pos.z);
          if (t.t === 6) {
            this.bubbleFor(n, "!");
            g.fx.emit("bang", P.pos.clone().add(new THREE.Vector3(0, 1.5, 0)), 1, { up: 0.3, grav: 0, speed: 0, life: 0.9, size: 0.4 });
          }
          t.t -= dt;
          if (t.t <= 0) n.task = { kind: "idle", t: 1 };
          break;
        }
        case "idle":
          P.speed = 0;
          t.t -= dt;
          if (t.t <= 0) this.plan(n);
          break;
        case "home": {
          const b = this.house(n);
          n.inside = true;
          P.hidden = true;
          if (b) P.pos.set(b.door[0] + 0.5, g.world.groundY(b.door[0] + 0.5, b.door[1] + 0.5), b.door[1] + 0.5);
          break;
        }
      }
      // Keep off the player.
      if (!n.inside && g.where === "out") {
        const dx = P.pos.x - g.player.pos.x;
        const dz = P.pos.z - g.player.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.55 && d > 1e-3) {
          g.player.pos.x -= (dx / d) * (0.55 - d) * 0.5;
          g.player.pos.z -= (dz / d) * (0.55 - d) * 0.5;
        }
      }
      P.update(dt);
      this.drawBubble(n, dt);
    }
    if (this.camperNpc) {
      this.camperNpc.p.speed = 0;
      this.camperNpc.p.update(dt);
    }
  }

  private bubbleFor(n: NPC, text: string): void {
    n.bubble.textContent = text;
    n.bubble.hidden = false;
    n.bubbleT = 2.2;
  }

  private drawBubble(n: NPC, dt: number): void {
    if (n.bubbleT <= 0 || n.p.hidden || this.g.where !== "out") {
      n.bubble.hidden = true;
      return;
    }
    n.bubbleT -= dt;
    const v = n.p.pos.clone().add(new THREE.Vector3(0, 1.55, 0)).project(this.g.stage.camera);
    n.bubble.style.transform = `translate(${((v.x + 1) / 2) * innerWidth}px, ${((1 - v.y) / 2) * innerHeight}px) translate(-50%, -100%)`;
    n.bubble.hidden = v.z > 1;
  }

  /** The neighbour the player is facing, close enough to talk to. */
  facing(P: Person): NPC | null {
    let best: NPC | null = null;
    let bd = 1.35;
    const f = new THREE.Vector3(Math.sin(P.yaw), 0, Math.cos(P.yaw));
    const all = this.camperNpc ? [...this.list, this.camperNpc] : this.list;
    for (const n of all) {
      if (n.p.hidden) continue;
      if (this.g.where === "out" && n.inside) continue;
      const d = n.p.pos.clone().sub(P.pos);
      d.y = 0;
      const l = d.length();
      if (l < bd && d.normalize().dot(f) > 0.4) {
        bd = l;
        best = n;
      }
    }
    return best;
  }

  // ---------------------------------------------------------------- talking

  private line(n: NPC, s: string, extra: Record<string, string> = {}): string {
    return fill(s, n.vars(this.g, extra));
  }

  private topic(n: NPC): string {
    const g = this.g;
    const others = this.list.filter((o) => o !== n);
    const r = Math.random();
    if (this.lastCatch && r < 0.2) return this.line(n, pick(CATCH_TALK), { x: this.lastCatch });
    if (r < 0.35) {
      const k = g.weather.kind;
      return this.line(n, pick(WEATHER[k]));
    }
    if (r < 0.5) return this.line(n, pick(SEASON[clock.season()]));
    if (r < 0.7) return this.line(n, pick(HOBBY[n.v.hobby]));
    if (r < 0.82 && others.length) {
      const o = pick(others);
      const last = o.v.name.charCodeAt(o.v.name.length - 1);
      const fin = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0;
      return this.line(n, pick(GOSSIP), { v: o.v.name, vRang: o.v.name + (fin ? "이랑" : "랑"), x: pick(CRAZES) });
    }
    return this.line(n, pick(ISLAND));
  }

  private greeting(n: NPC): string {
    const h = clock.hour();
    const part = h < 11 && h >= 5 ? "morning" : h < 17 && h >= 5 ? "noon" : h < 20 && h >= 5 ? "evening" : "night";
    return this.line(n, `${pick(OPEN[n.v.temper])} ${pick(GREET[part][n.v.temper])}`, { x: pick(CLOUD_SHAPES) });
  }

  async talk(n: NPC): Promise<void> {
    const g = this.g;
    const r = n.r;
    const day = clock.day();
    n.talking = true;
    n.p.anim.talking = true;
    n.p.setHold("none");
    g.talkFocus = n.p.pos;
    g.player.yaw = Math.atan2(n.p.pos.x - g.player.pos.x, n.p.pos.z - g.player.pos.z);
    sfx("open");
    const pitch = { easy: 0.8, sporty: 0.95, grumpy: 0.7, kind: 1.15, peppy: 1.35, prim: 1.1, dreamy: 1.05, sis: 1.0 }[n.v.temper];
    const color = "#" + new THREE.Color(n.v.look.shirt).getHexString();
    const say = (lines: string[], choices?: string[]) => g.ui.say(n.v.name, lines, { choices, color, pitch });
    if (n === this.camperNpc) {
      await this.talkCamper(n, say);
      g.talkFocus = null;
      n.talking = false;
      n.p.anim.talking = false;
      return;
    }
    const first = r.talkedDay < 0;
    const lines: string[] = [];
    if (first) lines.push(this.line(n, FIRST[n.v.temper]));
    else lines.push(this.greeting(n));
    if (r.talkedDay !== day) {
      r.talkedDay = day;
      r.friend += 1;
      g.tasks.did("talk");
      // A birthday!
      if (clock.month() === n.v.birthday[0] && clock.now().getDate() === n.v.birthday[1]) lines.push(this.line(n, "사실 오늘 내 생일이야! 기억해 줄 거지 {c}?"));
    }
    let done = false;
    let spoke = false;
    while (!done) {
      const ask = r.ask && r.askDay === day ? r.ask : null;
      const choices = ["이야기하자", "선물 주기", ask ? `부탁: ${item(ask[0]).name}` : "부탁 있어?", "잘 가"];
      const k = await say(spoke ? [this.line(n, pick(["또 할 얘기 있어 {c}?", "음, 또 뭐 {c}?", "{p}, 또 뭐가 궁금해 {c}?"]))] : lines, choices);
      spoke = true;
      if (k === 0) {
        await say([this.topic(n), Math.random() < 0.4 ? this.line(n, `{p}, 요즘 뭐가 재밌어? 난 ${HOBBIES[n.v.hobby]}이 최고야 {c}.`) : this.line(n, `난 ${STYLES[n.v.style]} 옷이랑 ${n.v.favColor}을 좋아해 {c}.`)]);
      } else if (k === 1) {
        await this.gift(n, say);
      } else if (k === 2) {
        if (ask) {
          if (g.pockets.count(ask[0]) > 0) {
            g.pockets.take(ask[0], 1);
            r.ask = null;
            r.friend += 3;
            n.p.play("joy");
            sfx("joy");
            await say([this.line(n, THANKS.love[n.v.temper]), this.line(n, "이건 답례야. 받아 줘 {c}!")]);
            g.give(ask[1], 1);
          } else await say([this.line(n, `${josa(item(ask[0]).name, "이가")} 있으면 꼭 가져다줘 {c}!`)]);
        } else if (r.askDay === day) {
          await say([this.line(n, "오늘은 괜찮아. 고마워 {c}.")]);
        } else {
          r.askDay = day;
          const want = this.wantItem(n);
          const reward = this.rewardItem();
          r.ask = [want, reward];
          await say([this.line(n, ASK[n.v.temper], { x: item(want).name })]);
        }
      } else {
        await say([this.line(n, BYE[n.v.temper])]);
        done = true;
      }
    }
    n.talking = false;
    n.p.anim.talking = false;
    g.talkFocus = null;
  }

  private wantItem(n: NPC): string {
    const month = clock.month();
    const h = clock.hour();
    const pool: string[] = [];
    if (n.v.hobby === "fishing" || Math.random() < 0.4) for (const f of FISH) if (f.rarity <= 2 && f.months.includes(month)) pool.push(`fish:${f.id}`);
    if (n.v.hobby === "bugs" || Math.random() < 0.4) for (const b of BUGS) if (b.rarity <= 2 && inSeason(b, month, h, false)) pool.push(`bug:${b.id}`);
    pool.push(this.g.world.I.fruit, "wood", "stone", "shell0", "branch", "weed");
    return pick(pool);
  }

  private rewardItem(): string {
    const r = Math.random();
    if (r < 0.5) {
      const f = pick(FURNITURE);
      return `furn:${f.id}:${Math.floor(Math.random() * f.colors.length)}`;
    }
    if (r < 0.8) {
      const clothes = [...ITEMS.values()].filter((d) => d.kind === "top" || d.kind === "hat");
      return pick(clothes).id;
    }
    return "acorns";
  }

  private async gift(n: NPC, say: (l: string[], c?: string[]) => Promise<number>): Promise<void> {
    const g = this.g;
    const day = clock.day();
    if (n.r.giftDay === day) {
      await say([this.line(n, "오늘은 벌써 받았는걸. 마음만 받을게 {c}.")]);
      return;
    }
    const choices = g.pockets.slots.map((s, i) => [s, i] as const).filter(([s]) => s && item(s.id).kind !== "tool");
    if (!choices.length) {
      await say([this.line(n, "선물? 주머니가 텅 비었는걸 {c}!")]);
      return;
    }
    const k = await g.ui.menu(
      `${n.v.name}에게 줄 선물`,
      choices.map(([s]) => ({ label: item(s!.id).name, icon: s!.id, right: s!.n > 1 ? `×${s!.n}` : "" })),
    );
    if (k < 0) return;
    const [slot, i] = choices[k];
    const d = item(slot!.id);
    g.pockets.takeAt(i);
    n.r.giftDay = day;
    let mood: "love" | "like" | "meh" = d.sell >= 1500 ? "love" : d.sell >= 250 ? "like" : "meh";
    if ((d.kind === "fish" && n.v.hobby === "fishing") || (d.kind === "bug" && n.v.hobby === "bugs") || (d.kind === "flower" && n.v.hobby === "nature")) mood = mood === "meh" ? "like" : "love";
    if ((d.kind === "top" || d.kind === "hat") && d.name.includes(n.v.favColor)) mood = "love";
    if (d.id === "weed" || d.id === "rotten-radish") mood = "meh";
    n.r.friend += mood === "love" ? 4 : mood === "like" ? 2 : 0;
    if (mood === "love") {
      n.p.play("joy");
      sfx("joy");
      g.fx.emit("heart", n.p.pos.clone().add(new THREE.Vector3(0, 1.4, 0)), 3, { up: 1, grav: -0.3, speed: 0.4, life: 1.2, size: 0.25 });
    } else if (mood === "meh") n.p.play("sad");
    await say([this.line(n, THANKS[mood][n.v.temper])]);
    // Good friends give something back now and then.
    if (mood !== "meh" && n.r.friend > 8 && Math.random() < 0.35) {
      await say([this.line(n, "아, 그렇지! 이것도 가져가 {c}.")]);
      g.give(this.rewardItem(), 1);
    }
  }

  // ---------------------------------------------------------------- the campsite

  private rollCamper(): void {
    const g = this.g;
    const isl = g.island;
    const plots = g.world.I.plots.filter((p) => p.kind === "house").length;
    if (this.list.length >= plots || !g.world.plot("camp")) {
      isl.camper = null;
      return;
    }
    const day = clock.day();
    if (!isl.camper || isl.camper.day !== day) isl.camper = (day + isl.seed) % 3 === 0 ? { seed: Math.floor(rng(day * 31 + isl.seed)() * 1e9), day } : null;
    this.spawnCamper();
  }

  private spawnCamper(): void {
    const g = this.g;
    if (this.camperNpc) {
      this.camperNpc.p.dispose();
      this.camperNpc.bubble.remove();
      this.camperNpc = null;
    }
    const c = g.island.camper;
    const camp = g.world.plot("camp");
    if (!c || !camp) return;
    const taken = new Set(this.list.map((n) => n.v.species));
    const v = makeVillager(c.seed, taken);
    const n = new NPC(v, { seed: c.seed, friend: 0, talkedDay: -1, giftDay: -1, plot: -1, movedIn: -1 }, g.stage.scene);
    const x = camp.x + 1.5;
    const z = camp.z + 3.3;
    n.p.pos.set(x, g.world.groundY(x, z), z);
    n.p.yaw = 0;
    this.camperNpc = n;
  }

  async camper(): Promise<void> {
    if (!this.camperNpc) {
      await this.g.ui.say("", ["텐트가 비어 있다. 누군가 캠핑하러 올지도 몰라."]);
      return;
    }
    await this.talk(this.camperNpc);
  }

  private async talkCamper(n: NPC, say: (l: string[], c?: string[]) => Promise<number>): Promise<void> {
    const sp = SPECIES.find((s) => s.id === n.v.species)!;
    const k = await say([this.line(n, FIRST[n.v.temper]), this.line(n, `여행 중인 ${sp.name}야. 이 섬, 공기가 참 좋네 {c}.`)], ["우리 섬에 살래?", "여행 즐겁게 해"]);
    if (k !== 0) {
      await say([this.line(n, BYE[n.v.temper])]);
      return;
    }
    const g = this.g;
    const plots = g.world.I.plots.filter((p) => p.kind === "house").length;
    const used = new Set(this.list.map((x) => x.r.plot));
    let plot = -1;
    for (let p = 0; p < plots; p++)
      if (!used.has(p)) {
        plot = p;
        break;
      }
    if (plot < 0) {
      await say([this.line(n, "섬에 빈 집터가 없는 것 같아 {c}. 아쉽다!")]);
      return;
    }
    n.p.play("joy");
    sfx("fanfare");
    await say([this.line(n, "정말? 좋아! 그럼 오늘부터 이웃이야 {c}!")]);
    const r: Resident = { seed: n.v.seed, friend: 3, talkedDay: clock.day(), giftDay: -1, plot, movedIn: clock.day() };
    g.island.residents.push(r);
    g.island.camper = null;
    const nn = new NPC(n.v, r, g.stage.scene);
    nn.p.pos.copy(n.p.pos);
    this.list.push(nn);
    n.p.dispose();
    n.bubble.remove();
    this.camperNpc = null;
    g.world.build(this.houseOrder());
    g.persist();
    g.ui.toast(`${n.v.name}이(가) 이사 왔다!`.replace(/이\(가\)/, /[가-힣]$/.test(n.v.name) && (n.v.name.charCodeAt(n.v.name.length - 1) - 0xac00) % 28 ? "이" : "가"));
  }
}
