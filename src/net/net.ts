/**
 * Visiting friends, peer to peer. The island's owner hosts: their browser keeps the one true
 * island, runs the neighbours and the clock, applies every visitor's op (dig, shake, pick…)
 * and sends the tile changes to everyone. Visitors send where they are ten times a second
 * and see everyone else, the neighbours, and the island as the host has it. Up to eight
 * on an island. No server of ours: PeerJS for introductions, WebRTC for the rest.
 */
import * as THREE from "three";
import { sfx } from "../audio/sound";
import type { Look } from "../char/body";
import { clock } from "../core/clock";
import { applyOp, type Op, type OpResult } from "../game/ops";
import { Person } from "../game/player";
import type { Game } from "../game/game";
import type { IslandSave, Profile } from "../game/save";
import type { Obj } from "../world/state";
import { ClientSession, HostSession, randomCode, type Msg } from "./session";

export interface Remote {
  id: string;
  name: string;
  p: Person;
  target: THREE.Vector3;
  tyaw: number;
  where: string;
  tag: HTMLDivElement;
  last: number;
}

export interface Welcome {
  island: IslandSave;
  offset: number;
  hostName: string;
}

export class Net {
  readonly remotes = new Map<string, Remote>();
  private sendT = 0;
  private npcT = 0;
  private pending = new Map<number, (r: OpResult) => void>();
  private rid = 1;
  onStatus: ((s: string) => void) | null = null;

  constructor(
    readonly g: Game,
    readonly isHost: boolean,
    readonly host: HostSession | null,
    readonly client: ClientSession | null,
    readonly code: string,
  ) {
    if (host) {
      host.onMsg = (id, m) => this.hostMsg(id, m);
      host.onLeave = (id) => this.drop(id);
      host.onJoin = () => this.onStatus?.(`친구가 섬에 도착하고 있어요… (${host.conns.size}명)`);
    }
    if (client) {
      client.onMsg = (m) => this.guestMsg(m);
      client.onClose = (why) => {
        g.ui.toast(`연결이 끊겼다: ${why}`);
        setTimeout(() => this.leave(), 1500);
      };
    }
  }

  // ---------------------------------------------------------------- setting up

  /** Open this island to visitors under a new code. */
  static host(g: Game, onReady: (code: string) => void, onFail: (why: string) => void): Net {
    const code = randomCode();
    const s = new HostSession(code, false);
    const net = new Net(g, true, s, null, code);
    s.onReady = () => onReady(code);
    s.onError = onFail;
    s.start(() => onFail("코드가 겹쳤어요. 다시 시도해 주세요."));
    return net;
  }

  /** Before the game exists: connect and wait for the island. */
  static join(code: string, profile: Profile, look: Look): Promise<{ welcome: Welcome; session: ClientSession }> {
    return new Promise((resolve, reject) => {
      const s = new ClientSession(code.toUpperCase());
      s.onOpen = () => s.send({ t: "hello", name: profile.name, look });
      s.onMsg = (m) => {
        if (m.t === "welcome") resolve({ welcome: m.w as Welcome, session: s });
        if (m.t === "busy") reject(new Error("섬이 가득 찼어요 (최대 8명)."));
      };
      s.onClose = (why) => reject(new Error(why));
      s.start(() => reject(new Error("그 코드의 섬을 찾을 수 없어요.")));
    });
  }

  // ---------------------------------------------------------------- host side

  private hostMsg(id: string, m: Msg): void {
    const g = this.g;
    const h = this.host!;
    switch (m.t) {
      case "ping":
        h.send(id, { t: "pong", at: m.at });
        break;
      case "hello": {
        const w: Welcome = { island: { ...g.island, state: g.world.S, residents: g.villagers.save() }, offset: clock.offset, hostName: g.profile.name };
        h.send(id, { t: "welcome", w });
        this.addRemote(id, m.name as string, m.look as Look);
        h.broadcast({ t: "join", id, name: m.name, look: m.look });
        // Tell the newcomer who's already here.
        h.send(id, { t: "join", id: "host", name: g.profile.name, look: g.player.look });
        for (const r of this.remotes.values()) if (r.id !== id) h.send(id, { t: "join", id: r.id, name: r.name, look: r.p.look });
        g.ui.toast(`${m.name}이(가) 섬에 놀러 왔다!`.replace("이(가)", ""));
        sfx("fanfare");
        break;
      }
      case "pos": {
        const r = this.remotes.get(id);
        if (r) this.moveRemote(r, m);
        break;
      }
      case "op": {
        const res = applyOp(g.world, m.op as Op);
        h.send(id, { t: "opres", rid: m.rid, res });
        this.broadcastSet(res.set);
        if (res.event) g.onEvent(res.event);
        break;
      }
      case "emote":
      case "look":
      case "chat": {
        this.remoteEvent(id, m);
        h.broadcast({ ...m, id });
        break;
      }
    }
  }

  broadcastSet(set: [number, Obj | null][]): void {
    if (!set.length) return;
    if (this.isHost) this.host!.broadcast({ t: "set", set });
  }

  // ---------------------------------------------------------------- guest side

  private guestMsg(m: Msg): void {
    const g = this.g;
    switch (m.t) {
      case "set":
        for (const [i, o] of m.set as [number, Obj | null][]) {
          if (o) g.world.S.objs[i] = o;
          else delete g.world.S.objs[i];
        }
        g.world.view.dirty = true;
        break;
      case "opres": {
        const cb = this.pending.get(m.rid as number);
        this.pending.delete(m.rid as number);
        cb?.(m.res as OpResult);
        break;
      }
      case "players":
        for (const p of m.list as Msg[]) {
          if (p.id === this.myId()) continue;
          const r = this.remotes.get(p.id as string);
          if (r) this.moveRemote(r, p);
        }
        break;
      case "npcs":
        g.villagers.puppet(m.list as { id: string; x: number; y: number; z: number; yaw: number; s: number; h: boolean; hold: string }[]);
        break;
      case "join":
        if (m.id !== this.myId()) this.addRemote(m.id as string, m.name as string, m.look as Look);
        break;
      case "leave":
        this.drop(m.id as string);
        break;
      case "emote":
      case "look":
      case "chat":
        if (m.id !== this.myId()) this.remoteEvent(m.id as string, m);
        break;
      case "time":
        clock.offset = m.offset as number;
        break;
    }
  }

  private myId(): string {
    return (this.client as unknown as { peer?: { id?: string } } | null)?.peer?.id ?? "me";
  }

  request(op: Op): Promise<OpResult> {
    return new Promise((resolve) => {
      const rid = this.rid++;
      this.pending.set(rid, resolve);
      this.client!.send({ t: "op", rid, op });
      setTimeout(() => {
        if (this.pending.has(rid)) {
          this.pending.delete(rid);
          resolve({ ok: false, set: [], give: [] });
        }
      }, 5000);
    });
  }

  // ---------------------------------------------------------------- everyone

  private addRemote(id: string, name: string, look: Look): void {
    if (this.remotes.has(id)) return;
    const g = this.g;
    const p = new Person(g.stage.scene, look, name);
    const [x, z] = g.world.spawn();
    p.pos.set(x + 0.5, g.world.groundY(x + 0.5, z), z);
    const tag = document.createElement("div");
    tag.className = "nametag";
    tag.textContent = name;
    document.getElementById("ui")!.appendChild(tag);
    this.remotes.set(id, { id, name, p, target: p.pos.clone(), tyaw: 0, where: "out", tag, last: performance.now() });
  }

  private drop(id: string): void {
    const r = this.remotes.get(id);
    if (!r) return;
    r.p.dispose();
    r.tag.remove();
    this.remotes.delete(id);
    this.g.ui.toast(`${r.name}이(가) 돌아갔다.`.replace("이(가)", ""));
    if (this.isHost) this.host!.broadcast({ t: "leave", id });
  }

  private moveRemote(r: Remote, m: Msg): void {
    r.target.set(m.x as number, m.y as number, m.z as number);
    r.tyaw = m.yaw as number;
    r.where = (m.w as string) ?? "out";
    r.p.running = !!m.run;
    r.p.hold((m.tool as string) || null);
    r.p.setHold(((m.hold as string) || "none") as never);
    r.last = performance.now();
  }

  private remoteEvent(id: string, m: Msg): void {
    const r = id === "host" ? this.remotes.get("host") : this.remotes.get(id);
    if (!r) return;
    if (m.t === "emote") r.p.play(m.act as never);
    if (m.t === "look") r.p.setLook(m.look as Look);
    if (m.t === "chat") this.g.ui.toast(`${r.name}: ${m.text}`);
  }

  facing(P: Person): Remote | null {
    const f = new THREE.Vector3(Math.sin(P.yaw), 0, Math.cos(P.yaw));
    for (const r of this.remotes.values()) {
      if (r.where !== this.g.where) continue;
      const d = r.p.pos.clone().sub(P.pos).setY(0);
      if (d.length() < 1.3 && d.normalize().dot(f) > 0.4) return r;
    }
    return null;
  }

  wave(r: Remote): void {
    this.g.player.yaw = Math.atan2(r.p.pos.x - this.g.player.pos.x, r.p.pos.z - this.g.player.pos.z);
    this.g.player.play("wave");
    this.emote("wave");
  }

  emote(act?: string): void {
    const a = act ?? (this.g.player.anim.act as string) ?? "wave";
    this.send({ t: "emote", act: a });
  }

  chat(text: string): void {
    this.send({ t: "chat", text });
    this.g.ui.toast(`나: ${text}`);
  }

  sendLook(): void {
    this.send({ t: "look", look: this.g.player.look });
  }

  private send(m: Msg): void {
    if (this.isHost) this.host!.broadcast({ ...m, id: "host" });
    else this.client!.send(m);
  }

  update(dt: number): void {
    const g = this.g;
    const P = g.player;
    // Remotes glide to where they said they are.
    for (const r of this.remotes.values()) {
      const d = r.target.distanceTo(r.p.pos);
      if (d > 6) r.p.pos.copy(r.target);
      else r.p.pos.lerp(r.target, 1 - Math.exp(-dt * 10));
      r.p.speed = d / Math.max(dt, 1e-3) > 0.3 ? Math.min(6, d * 10) : 0;
      r.p.yaw += Math.atan2(Math.sin(r.tyaw - r.p.yaw), Math.cos(r.tyaw - r.p.yaw)) * Math.min(1, dt * 10);
      r.p.hidden = r.where !== g.where;
      r.p.update(dt);
      const v = r.p.pos.clone().add(new THREE.Vector3(0, 1.45, 0)).project(g.stage.camera);
      r.tag.hidden = r.p.hidden || v.z > 1;
      r.tag.style.transform = `translate(${((v.x + 1) / 2) * innerWidth}px, ${((1 - v.y) / 2) * innerHeight}px) translate(-50%, -100%)`;
    }
    this.sendT -= dt;
    if (this.sendT <= 0) {
      this.sendT = 0.1;
      const me = { x: +P.pos.x.toFixed(2), y: +P.pos.y.toFixed(2), z: +P.pos.z.toFixed(2), yaw: +P.yaw.toFixed(2), run: P.running, tool: P.toolId, hold: P.anim.hold, w: g.where };
      if (this.isHost) {
        const list = [{ id: "host", ...me }, ...[...this.remotes.values()].map((r) => ({ id: r.id, x: r.target.x, y: r.target.y, z: r.target.z, yaw: r.tyaw, run: r.p.running, tool: r.p.toolId, hold: r.p.anim.hold, w: r.where }))];
        this.host!.broadcast({ t: "players", list });
      } else this.client!.send({ t: "pos", ...me });
    }
    if (this.isHost && this.host!.conns.size) {
      this.npcT -= dt;
      if (this.npcT <= 0) {
        this.npcT = 0.2;
        this.host!.broadcast({ t: "npcs", list: g.villagers.list.map((n) => ({ id: n.v.id, x: +n.p.pos.x.toFixed(2), y: +n.p.pos.y.toFixed(2), z: +n.p.pos.z.toFixed(2), yaw: +n.p.yaw.toFixed(2), s: +n.p.speed.toFixed(1), h: n.inside, hold: n.p.anim.hold })) });
      }
    }
  }

  leave(): void {
    this.g.persist();
    this.client?.close();
    this.host?.close();
    const u = new URL(location.href);
    u.searchParams.delete("join");
    location.href = u.toString();
  }

  get count(): number {
    return this.remotes.size + 1;
  }
}

export { randomCode };
