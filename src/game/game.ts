/**
 * The game: one island, the local player, their pockets, the neighbours, the critters, the
 * buildings you can walk into, and friends visiting. Each frame it reads input, moves the
 * player, works out what the main button would do right now (shake, dig, talk, go in…),
 * does it when pressed, and keeps the clock, weather and island mornings running.
 */
import * as THREE from "three";
import { music, sfx, unlock, voice } from "../audio/sound";
import { playerLook } from "../data/species";
import type { Look } from "../char/body";
import { clock } from "../core/clock";
import { item, josa } from "../data/items";
import { setNight } from "../render/buildings";
import { PLAYER_U, type Stage } from "../render/stage";
import { DX, DZ, H, idx, K, TIER_H, W } from "../world/island";
import { UI } from "../ui/ui";
import { Critters } from "./critters";
import { Fx } from "./fx";
import { Input, type Pad } from "./input";
import { applyOp, type Op, type OpResult } from "./ops";
import { Person } from "./player";
import { Pockets, type Slot } from "./pockets";
import { save, type IslandSave, type Profile } from "./save";
import { Villagers } from "./villagers";
import { Weather } from "./weather";
import { World } from "./world";
import { Interiors } from "./interiors";
import { Services } from "./services";
import { Phone } from "./phone";
import type { Net } from "../net/net";
import { Meteors } from "./sky";
import { Tasks } from "./tasks";


export interface Action {
  label: string;
  run: () => void | Promise<void>;
}

export class Game {
  readonly world: World;
  readonly player: Person;
  readonly pockets: Pockets;
  readonly input = new Input();
  readonly ui: UI;
  readonly fx = new Fx();
  readonly villagers: Villagers;
  readonly critters: Critters;
  readonly weather: Weather;
  readonly interiors: Interiors;
  readonly services: Services;
  readonly phone: Phone;
  readonly meteors: Meteors;
  readonly tasks: Tasks;
  net: Net | null = null;
  /** Pocket slot of the item in hand (tool), or -1. */
  held = -1;
  busy = 0;
  private stepT = 0;
  private saveT = 0;
  /** Where the player is: "out", or an interior id. */
  where = "out";
  /** Visiting someone else's island (don't save it). */
  guest = false;

  constructor(
    readonly stage: Stage,
    public profile: Profile,
    public island: IslandSave,
    opts: { guest?: boolean } = {},
  ) {
    this.guest = !!opts.guest;
    this.ui = new UI();
    this.ui.onVoice = (c, p) => voice(c, p);
    this.ui.onClick = (w) => {
      if (w === "bag") this.openBag();
      if (w === "phone") void this.phone.open();
    };
    this.world = new World(stage, island.seed, island.state);
    this.pockets = Pockets.from(profile.pockets);
    this.pockets.onChange = () => this.syncHeld();
    this.held = profile.held ?? -1;
    stage.scene.add(this.fx.group);
    this.weather = new Weather(stage, this.world);
    this.villagers = new Villagers(this);
    this.world.build(this.villagers.houseOrder());
    this.critters = new Critters(this);
    this.interiors = new Interiors(this);
    this.services = new Services(this);
    this.phone = new Phone(this);
    this.meteors = new Meteors(this);
    this.tasks = new Tasks(this);
    this.player = new Person(stage.scene, this.lookFor(profile), profile.name);
    const [sx, sz] = this.homeSpawn();
    this.player.pos.set(sx, this.world.groundY(sx, sz), sz);
    this.player.yaw = 0;
    this.syncHeld();
    const st = document.getElementById("stick");
    const kn = document.getElementById("knob");
    if (st && kn) this.input.bindTouch(st, kn);
    window.addEventListener("pointerdown", () => unlock(), { once: true });
    window.addEventListener("keydown", () => unlock(), { once: true });
    this.world.tickDay();
    this.villagers.morning();
  }

  /** The player's look from their profile and what they're wearing. */
  lookFor(p: Profile): Look {
    const L = playerLook({ skin: p.skin, hair: p.hair as Look["hair"], hairColor: p.hairColor, eyes: p.eyes as never });
    const o = p.outfit;
    if (o.top) {
      const c = item(o.top).cloth!;
      L.shirt = c.color;
      L.shirt2 = c.color2;
      L.pattern = c.style === "stripe" ? "stripe" : c.style === "dot" ? "dot" : c.style === "two" ? "two" : "plain";
    }
    if (o.bottom) L.pants = item(o.bottom).cloth!.color;
    if (o.hat) {
      const c = item(o.hat).cloth!;
      L.hat = c.style as Look["hat"];
      L.hatColor = c.color;
    }
    return L;
  }

  private homeSpawn(): [number, number] {
    const home = this.world.building("home");
    if (home && !this.guest) return [home.door[0] + 0.5, home.door[1] + 0.8];
    const [x, z] = this.world.spawn();
    return [x + 0.5, z];
  }

  get heldSlot(): Slot | null {
    return this.held >= 0 ? this.pockets.slots[this.held] : null;
  }

  syncHeld(): void {
    const s = this.heldSlot;
    if (s && !item(s.id).tool) this.held = -1;
    const h = this.heldSlot;
    this.player?.hold(h ? h.id : null);
    this.ui.setHeld(h);
  }

  /** Cycle the tool in hand through the tools in the pockets (and bare hands). */
  cycleTool(d: number): void {
    const tools = this.pockets.slots.map((s, i) => (s && item(s.id).tool ? i : -1)).filter((i) => i >= 0);
    const all = [-1, ...tools];
    const k = all.indexOf(this.held);
    this.held = all[(k + d + all.length) % all.length];
    this.syncHeld();
    sfx("menu");
  }

  equip(i: number): void {
    this.held = i;
    this.syncHeld();
  }

  // ---------------------------------------------------------------- giving and taking

  give(id: string, n = 1, quiet = false): boolean {
    const left = this.pockets.add(id, n);
    if (left > 0) {
      // No room: drop it at the feet.
      const [x, z] = this.nearestFree();
      if (x >= 0) this.doOp({ op: "drop", x, z, id, n: left, rot: 0 }, true);
      this.ui.toast("주머니가 가득 찼다! 발밑에 내려놓았다.");
      return false;
    }
    if (!quiet) this.ui.toast(`${josa(item(id).name, "을를")} 얻었다!`, id);
    return true;
  }

  nearestFree(): [number, number] {
    const px = Math.floor(this.player.pos.x);
    const pz = Math.floor(this.player.pos.z);
    for (let r = 0; r < 4; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (this.world.freeTile(px + dx, pz + dz)) return [px + dx, pz + dz];
    return [-1, -1];
  }

  addMoney(n: number): void {
    this.pockets.money += n;
    this.ui.toast(`도토리 ${n.toLocaleString()}개!`);
    sfx("coin");
  }

  // ---------------------------------------------------------------- ops

  /** Run an op on the island: locally if we own it, through the host if visiting. */
  doOp(op: Op, quiet = false): Promise<OpResult> {
    if (this.net && !this.net.isHost) return this.net.request(op).then((r) => (this.applyResult(r, quiet), this.deeds(op, r), r));
    const r = applyOp(this.world, op);
    this.net?.broadcastSet(r.set);
    this.applyResult(r, quiet);
    this.deeds(op, r);
    return Promise.resolve(r);
  }

  /** Count what an op did toward today's stamps. */
  deeds(op: Op, r: OpResult): void {
    if (!r.ok) return;
    if (op.op === "shake") this.tasks.did("shake");
    if (op.op === "rock") this.tasks.did("rock");
    if (op.op === "water" && r.fx === "water") this.tasks.did("water");
    if (op.op === "plant") this.tasks.did("plant");
    if (op.op === "dig" && r.fx === "dig") this.tasks.did("dig");
    for (const [id] of r.give) {
      if (id === "weed") this.tasks.did("weed");
      if (id.startsWith("shell")) this.tasks.did("shell");
    }
  }

  applyResult(r: OpResult, quiet = false): void {
    for (const [id, n] of r.spend ?? []) this.pockets.take(id, n);
    for (const [id, n] of r.give) this.give(id, n, quiet);
    if (r.money) this.addMoney(r.money);
    if (r.fx && !quiet) sfx(r.fx);
    if (r.msg && !quiet) this.ui.toast(r.msg);
    if (r.event) this.onEvent(r.event);
  }

  onEvent(e: NonNullable<OpResult["event"]>): void {
    const at = new THREE.Vector3(e.x + 0.5, this.world.groundY(e.x + 0.5, e.z + 0.5), e.z + 0.5);
    if (e.kind === "shake") this.fx.emit("leaf", at.clone().add(new THREE.Vector3(0, 2, 0)), 8, { spread: 1.6, up: 0.5, grav: 1.5, life: 1.3, size: 0.2 });
    if (e.kind === "fell") this.fx.emit("puff", at.clone().add(new THREE.Vector3(0, 0.5, 0)), 10, { spread: 1, up: 1, grav: -0.5, life: 0.8, size: 0.5 });
    if (e.kind === "rockhit") {
      this.fx.emit("spark", at.clone().add(new THREE.Vector3(0, 0.5, 0)), 4, { spread: 0.4, up: 2, life: 0.4, size: 0.15 });
      if (Math.random() < 0.15) this.critters.spawnAt("rock", at.clone().add(new THREE.Vector3(0.4, 0, 0.4)));
    }
    if (e.kind === "shake" && this.player.anim.act === "shake" && Math.random() < 0.18) this.critters.spawnAt("shake", at);
    if (e.kind === "rockbreak") this.fx.emit("puff", at.clone().add(new THREE.Vector3(0, 0.3, 0)), 14, { spread: 1, up: 1.5, grav: 1, life: 0.9, size: 0.5, color: 0xaaaaaa });
    if (e.kind === "wasps") this.critters.wasps(at);
  }

  // ---------------------------------------------------------------- what's in front

  /** Work out what the main button does right now. */
  private actionFor(): Action | null {
    const P = this.player;
    const w = this.world;
    const [fx, fz] = P.front();
    const o = w.obj(fx, fz);
    const tool = P.tool;
    // Island designer: lay or lift paths.
    if (this.phone.designing) {
      const t = this.phone.designing;
      return { label: t < 0 ? "길 지우기" : "길 깔기", run: () => void this.doOp({ op: "path", x: fx, z: fz, type: Math.max(0, t) }) };
    }
    // Someone to talk to.
    const npc = this.villagers.facing(P);
    if (npc) return { label: `${npc.v.name}에게 말 걸기`, run: () => this.villagers.talk(npc) };
    const other = this.net?.facing(P);
    if (other) return { label: `${other.name}에게 인사`, run: () => this.net!.wave(other) };
    // A door.
    const door = this.doorAhead();
    if (door) return door;
    // Tools.
    if (tool === "shovel") {
      if (o?.t === "rock") return { label: "바위 치기", run: () => this.swing("swing", { op: "rock", x: fx, z: fz, power: this.profile.power > 0 }, true) };
      if (o?.t === "hole") return { label: "구멍 메우기", run: () => this.swing("dig", { op: "dig", x: fx, z: fz, power: false }) };
      if (o?.t === "tree" && o.stage >= 3 && this.profile.power <= 0) return { label: "(너무 커서 못 뽑아)", run: () => this.swing("swing", { op: "dig", x: fx, z: fz, power: false }) };
      return { label: o?.t === "buried" ? "파내기" : o ? "파서 뽑기" : "땅 파기", run: () => this.swing("dig", { op: "dig", x: fx, z: fz, power: this.profile.power > 0 }) };
    }
    if (tool === "axe") {
      if (o?.t === "tree") return { label: "나무 베기", run: () => this.swing("chop", { op: "chop", x: fx, z: fz, tier: item(this.heldSlot!.id).tier ?? 1 }) };
      if (o?.t === "rock") return { label: "바위 치기", run: () => this.swing("chop", { op: "rock", x: fx, z: fz, power: false }, true) };
      return { label: "휘두르기", run: () => this.swing("chop", null) };
    }
    if (tool === "net") return { label: "잠자리채 휘두르기", run: () => this.critters.swingNet() };
    if (tool === "rod") {
      const water = this.critters.castSpot();
      if (water) return { label: "낚싯대 던지기", run: () => this.critters.cast(water) };
    }
    if (tool === "can") return { label: "물 주기", run: () => this.swing("water", { op: "water", x: fx, z: fz, dir: P.dir4(), tier: item(this.heldSlot!.id).tier ?? 1 }) };
    if (tool === "slingshot") return { label: "새총 쏘기", run: () => this.critters.shoot() };
    if (tool === "ladder") {
      const c = this.cliffAhead();
      if (c) return c;
    }
    if (tool === "pole") {
      const v = this.vaultAhead();
      if (v) return v;
    }
    // Bare hands.
    if (o?.t === "tree" && o.stage >= 3) return { label: "나무 흔들기", run: () => this.shakeTree(fx, fz) };
    if (o?.t === "furn") {
      const f = item(o.id);
      return { label: `${f.name} 보기`, run: () => this.useFurniture(fx, fz) };
    }
    const pick = this.pickAhead();
    if (pick) return pick;
    if (tool) return { label: "휘두르기", run: () => this.swing("swing", null) };
    return null;
  }

  private pickAhead(): Action | null {
    const P = this.player;
    for (const [x, z] of [P.front(), P.front(0.2), P.front(1.3)]) {
      const o = this.world.obj(x, z);
      if (!o) continue;
      const name = o.t === "item" ? item(o.id).name : o.t === "weed" ? "잡초" : o.t === "shell" ? item(`shell${o.v}`).name : o.t === "flower" && o.stage === 2 ? "꽃" : o.t === "furn" ? item(o.id).name : null;
      if (!name) continue;
      const verb = o.t === "weed" ? "뽑기" : o.t === "flower" ? "꺾기" : "줍기";
      return {
        label: `${name} ${verb}`,
        run: async () => {
          this.player.play("pick");
          await wait(180);
          await this.doOp({ op: "pick", x, z });
        },
      };
    }
    return null;
  }

  private async shakeTree(x: number, z: number): Promise<void> {
    this.busy++;
    this.player.play("shake");
    this.world.view.shake.set(idx(x, z), 0.9);
    await wait(300);
    await this.doOp({ op: "shake", x, z });
    await wait(400);
    this.busy--;
  }

  /** Swing a tool (animation first, the op at the moment of impact). */
  private async swing(act: "swing" | "chop" | "dig" | "water", op: Op | null, recoil = false): Promise<void> {
    this.busy++;
    this.player.play(act);
    sfx("swing");
    await wait(act === "dig" ? 330 : 240);
    if (op) {
      const r = await this.doOp(op);
      if (r.ok) this.wearTool();
      if (act === "water") this.fx.emit("drop", this.player.pos.clone().add(new THREE.Vector3(Math.sin(this.player.yaw) * 0.9, 0.5, Math.cos(this.player.yaw) * 0.9)), 10, { spread: 0.8, up: 1, life: 0.5, size: 0.1 });
      if (act === "dig" && r.ok) this.fx.emit("dirt", this.player.pos.clone().add(new THREE.Vector3(Math.sin(this.player.yaw) * 0.8, 0.2, Math.cos(this.player.yaw) * 0.8)), 6, { spread: 0.3, up: 2, life: 0.5, size: 0.1 });
      if (recoil || r.recoil) {
        const back = new THREE.Vector3(-Math.sin(this.player.yaw), 0, -Math.cos(this.player.yaw)).multiplyScalar(0.25);
        const to = this.player.pos.clone().add(back);
        if (this.world.canStand(to.x, to.z, this.player.pos.y)) this.player.moveTo(to, 0.12);
      }
    }
    await wait(act === "dig" ? 300 : 160);
    this.busy--;
  }

  wearTool(): void {
    const s = this.heldSlot;
    if (!s || s.wear === undefined) return;
    s.wear--;
    if (s.wear <= 0) {
      const name = item(s.id).name;
      this.pockets.slots[this.held] = null;
      this.held = -1;
      this.syncHeld();
      this.ui.toast(`${josa(name, "이가")} 부서졌다!`);
      sfx("fail");
    } else this.ui.setHeld(s);
  }

  private doorAhead(): Action | null {
    const P = this.player;
    const px = Math.floor(P.pos.x);
    const pz = Math.floor(P.pos.z);
    for (const b of this.world.buildings) {
      if (b.door[0] !== px || b.door[1] !== pz) continue;
      // Facing the door (north).
      if (Math.cos(P.yaw) > -0.6) continue;
      const k = b.plot.kind;
      if (k === "dock") return { label: "배에 타기", run: () => this.services.ferry() };
      if (k === "camp") return { label: "텐트 들여다보기", run: () => this.villagers.camper() };
      if (k === "house" && b.owner) {
        const v = this.villagers.byId(b.owner);
        return { label: `${v?.v.name ?? "이웃"}의 집`, run: () => this.interiors.enter("house", b) };
      }
      const names: Record<string, string> = { home: "우리 집", shop: "잡화점", museum: "박물관", office: "섬 사무소" };
      if (names[k]) return { label: `${names[k]} 들어가기`, run: () => this.interiors.enter(k, b) };
    }
    return null;
  }

  /** A cliff face right ahead (up or down one tier): the ladder. */
  private cliffAhead(): Action | null {
    const P = this.player;
    const d = P.dir4();
    const px = Math.floor(P.pos.x);
    const pz = Math.floor(P.pos.z);
    const nx = px + DX[d];
    const nz = pz + DZ[d];
    if (!this.world.passable(nx, nz)) return null;
    const y0 = this.world.groundY(P.pos.x, P.pos.z);
    const y1 = this.world.groundY(nx + 0.5, nz + 0.5);
    if (Math.abs(y1 - y0 - TIER_H) < 0.2 || Math.abs(y0 - y1 - TIER_H) < 0.2) {
      const up = y1 > y0;
      return {
        label: up ? "사다리로 오르기" : "사다리로 내려가기",
        run: () => {
          this.busy++;
          this.player.yaw = Math.atan2(DX[d], DZ[d]);
          const to = new THREE.Vector3(nx + 0.5, y1, nz + 0.5);
          sfx("step");
          this.player.moveTo(to, 0.9, up ? 0.4 : 0.2, () => this.busy--);
        },
      };
    }
    return null;
  }

  /** Water ahead with land on the far side (up to three tiles): the pole. */
  private vaultAhead(): Action | null {
    const P = this.player;
    const d = P.dir4();
    const px = Math.floor(P.pos.x);
    const pz = Math.floor(P.pos.z);
    const y0 = this.world.groundY(P.pos.x, P.pos.z);
    let k = 1;
    while (k <= 3 && this.world.waterAt(px + DX[d] * k, pz + DZ[d] * k)) k++;
    if (k === 1 || k > 3 + 1) return null;
    const lx = px + DX[d] * k;
    const lz = pz + DZ[d] * k;
    if (!this.world.passable(lx, lz) || Math.abs(this.world.groundY(lx + 0.5, lz + 0.5) - y0) > 0.3) return null;
    return {
      label: "장대로 건너뛰기",
      run: () => {
        this.busy++;
        this.player.yaw = Math.atan2(DX[d], DZ[d]);
        sfx("swing");
        this.player.moveTo(new THREE.Vector3(lx + 0.5, y0, lz + 0.5), 0.8, 1.2, () => {
          this.busy--;
          sfx("step");
        }, "joy");
      },
    };
  }

  private async useFurniture(x: number, z: number): Promise<void> {
    const o = this.world.obj(x, z);
    if (o?.t !== "furn") return;
    const choice = await this.ui.say("", [`${item(o.id).name}.`], { choices: ["돌리기", "집어 들기", "그만두기"] });
    if (choice === 0) await this.doOp({ op: "turn", x, z });
    if (choice === 1) await this.doOp({ op: "pick", x, z });
  }

  // ---------------------------------------------------------------- pockets

  openBag(): void {
    if (this.ui.modal) return;
    void this.ui.bag(this.pockets, (s, i) => this.bagActions(s, i));
  }

  bagActions(s: Slot, i: number): Action[] {
    const d = item(s.id);
    const out: Action[] = [];
    const [fx, fz] = this.player.front();
    const front = this.world.obj(fx, fz);
    if (d.tool) out.push({ label: this.held === i ? "집어넣기" : "손에 들기", run: () => this.equip(this.held === i ? -1 : i) });
    if (d.kind === "fruit")
      out.push({
        label: "먹기",
        run: () => {
          this.pockets.takeAt(i);
          this.profile.power = Math.min(10, this.profile.power + 1);
          this.tasks.did("eat");
          this.player.play("eat");
          sfx("joy");
          this.ui.toast(`힘이 솟는다! (힘 ${this.profile.power})`);
        },
      });
    if (d.kind === "fruit" || d.kind === "sapling" || d.kind === "seed" || d.kind === "flower") out.push({ label: "심기", run: () => void this.doOp({ op: "plant", x: fx, z: fz, id: s.id }) });
    if (d.kind === "furniture") out.push({ label: this.where === "home" ? "방에 두기" : "밖에 두기", run: () => (this.where === "home" ? this.interiors.placeHome(s.id) : void this.doOp({ op: "drop", x: fx, z: fz, id: s.id, n: 1, rot: (this.player.dir4() + 2) % 4 })) });
    if (d.kind === "top" || d.kind === "bottom" || d.kind === "hat") out.push({ label: "입기", run: () => this.wear(i) });
    if ((d.kind === "wall" || d.kind === "floor") && this.where === "home") out.push({ label: "방 꾸미기", run: () => this.interiors.decorate(i) });
    if (d.kind === "recipe") out.push({ label: "레시피 배우기", run: () => this.learn(i) });
    if (s.id === "acorns")
      out.push({
        label: "열기",
        run: () => {
          this.pockets.takeAt(i);
          this.addMoney(100 * (1 + Math.floor(Math.random() * 10)));
        },
      });
    if (s.id === "present" || s.id === "balloon") out.push({ label: "열어 보기", run: () => this.services.openPresent(i) });
    if (front?.t === "hole" && d.kind !== "tool") out.push({ label: "구멍에 묻기", run: () => void this.doOp({ op: "bury", x: fx, z: fz, id: s.id }) });
    if (d.kind !== "furniture" && this.where === "out") out.push({ label: "내려놓기", run: () => void this.doOp({ op: "drop", x: fx, z: fz, id: s.id, n: s.n, rot: 0 }) });
    if (this.where === "home") out.push({ label: "보관함에 넣기", run: () => this.interiors.store(i) });
    return out;
  }

  private wear(i: number): void {
    const s = this.pockets.slots[i]!;
    const d = item(s.id);
    const key = d.kind === "top" ? "top" : d.kind === "bottom" ? "bottom" : "hat";
    const old = this.profile.outfit[key];
    this.pockets.takeAt(i);
    if (old) this.pockets.add(old);
    this.profile.outfit[key] = s.id;
    this.player.setLook(this.lookFor(this.profile));
    this.syncHeld();
    this.net?.sendLook();
    this.ui.toast(`${josa(d.name, "을를")} 입었다!`, s.id);
  }

  private learn(i: number): void {
    const s = this.pockets.slots[i]!;
    const fid = s.id.slice(7);
    if (this.profile.recipes.includes(fid)) {
      this.ui.toast("이미 아는 레시피야.");
      return;
    }
    this.pockets.takeAt(i);
    this.profile.recipes.push(fid);
    sfx("joy");
    this.ui.toast(`레시피를 배웠다: ${item(`furn:${fid}:0`).name}`);
  }

  // ---------------------------------------------------------------- the frame

  update(dt: number): void {
    const pad = this.input.read();
    const modal = this.ui.modal > 0;
    const P = this.player;
    // Clock, weather, the island's day.
    const hour = clock.hour();
    const wx = this.weather.update(dt, hour);
    this.stage.setHour(hour, wx.overcast);
    if (this.weather.lightning) this.stage.hemi.intensity += 2.5;
    setNight(this.stage.night.value);
    if (!this.guest && this.world.tickDay().length) {
      this.villagers.morning();
      this.starShards();
      this.persist();
    }
    this.meteors.update(dt);
    this.ui.setClock(clock.now(), wx.kind, this.guest ? `${this.island.name} (방문 중)` : this.island.name);
    this.ui.setMoney(this.pockets.money);
    if (!modal && !this.busy) this.control(dt, pad);
    else if (!P.motion) P.walk(dt, 0, 0, false, this.world);
    P.stepMotion(dt);
    P.update(dt);
    if (this.where === "out") PLAYER_U.value.copy(P.pos);
    else PLAYER_U.value.set(0, -99, 0);
    this.villagers.update(dt);
    this.critters.update(dt, pad, modal);
    this.interiors.update(dt);
    this.net?.update(dt);
    this.fx.update(dt);
    this.world.view.update();
    this.world.terrain.update(this.stage.time.value);
    // Camera on the player (or the room).
    if (this.where === "out") {
      this.stage.focus.lerp(new THREE.Vector3(P.pos.x, P.pos.y, P.pos.z), 1 - Math.exp(-dt * 8));
      this.stage.updateCamera(dt);
    } else this.interiors.camera(dt);
    music(hour, this.island.seed, wx.kind === "rain" || wx.kind === "storm", this.where !== "out");
    this.saveT += dt;
    if (this.saveT > 20) {
      this.saveT = 0;
      this.persist();
    }
  }

  private control(dt: number, pad: Pad): void {
    const P = this.player;
    if (this.critters.fishing) return;
    if (pad.bag) return this.openBag();
    if (pad.phone) return void this.phone.open();
    if (pad.map) return void this.phone.map();
    if (pad.tool) this.cycleTool(pad.tool);
    if (pad.num >= 0) {
      const tools = this.pockets.slots.map((s, i) => (s && item(s.id).tool ? i : -1)).filter((i) => i >= 0);
      if (tools[pad.num] !== undefined) this.equip(tools[pad.num]);
    }
    if (pad.emote && (this.meteors.tonight() || this.meteors.lookUp > 0.5)) {
      this.meteors.toggleLook();
      return;
    }
    if (this.meteors.lookUp > 0.5) {
      this.ui.prompt(this.meteors.tonight() ? "Space: 소원 빌기 · R: 고개 내리기" : "R: 고개 내리기");
      if (pad.act) this.meteors.wish();
      return;
    }
    if (pad.emote) {
      P.play(["wave", "joy", "dance", "bow", "surprise"][Math.floor(Math.random() * 5)] as never);
      this.net?.emote();
    }
    if (!P.motion) {
      if (this.where === "out") P.walk(dt, pad.x, pad.z, pad.run, this.world);
      else this.interiors.walk(dt, pad);
    }
    // Footsteps and dust.
    if (P.speed > 0.5) {
      this.stepT -= dt * P.speed;
      if (this.stepT <= 0) {
        this.stepT = 1.1;
        sfx("step");
        if (P.running) this.fx.emit("puff", P.pos.clone().add(new THREE.Vector3(0, 0.08, 0)), 1, { spread: 0.1, up: 0.3, grav: -0.3, life: 0.5, size: 0.28, grow: 1.2 });
      }
    }
    const act = this.where === "out" ? this.actionFor() : this.interiors.actionFor();
    const pick = this.where === "out" ? this.pickAhead() : null;
    this.ui.prompt(act ? `Space: ${act.label}` : pick ? `E: ${pick.label}` : null);
    if (pad.act && act) void act.run();
    else if (pad.pick && pick) void pick.run();
    else if (pad.act && P.tool) void this.swing("swing", null);
  }

  /** Wishes on last night's shooting stars wash up as star shards on the beach. */
  private starShards(): void {
    const n = Math.min(8, this.island.wishes ?? 0);
    this.island.wishes = 0;
    const I = this.world.I;
    for (let k = 0, put = 0; k < 400 && put < n; k++) {
      const x = Math.floor(Math.random() * W);
      const z = Math.floor(Math.random() * H);
      if (I.kind[z * W + x] !== K.Sand || I.seaDist[z * W + x] > 3 || !this.world.freeTile(x, z)) continue;
      this.world.setObj(x, z, { t: "item", id: "star", n: 1 });
      put++;
    }
    if (n) this.ui.toast("해변에 무언가 반짝이고 있다…");
  }

  /** Save profile and (if it's ours) the island. */
  persist(): void {
    this.profile.pockets = this.pockets.toJSON() as Profile["pockets"];
    this.profile.held = this.held;
    save.putProfile(this.profile);
    if (!this.guest) {
      this.island.state = this.world.S;
      this.island.residents = this.villagers.save();
      save.putIsland(this.island);
    }
  }
}

export function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
