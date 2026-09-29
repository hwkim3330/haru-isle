/**
 * The island as the game sees it: generated terrain + the changing state + what's drawn, and
 * the rules of the ground — which tiles you can stand on, how high, what blocks you, where
 * the doors are. Both the host and visitors hold one; only the host mutates it on its own.
 */
import * as THREE from "three";
import { clock } from "../core/clock";
import { bridgeModel, plotModel } from "../render/buildings";
import type { Stage } from "../render/stage";
import { bridgeAt, generate, H, idx, inside, K, rampAt, TIER_H, W, type Island, type Plot } from "../world/island";
import { freshState, morning, type IslandState, type Obj } from "../world/state";
import { Terrain } from "../world/terrain";
import { ObjectView } from "../world/view";
import type { Villager } from "../data/species";

export interface Building {
  plot: Plot;
  /** Solid footprint. */
  rect: [number, number, number, number];
  /** The tile just outside the door, and which way is "in" (always -z). */
  door: [number, number];
  group: THREE.Group;
  owner?: string;
}

export class World {
  readonly I: Island;
  S: IslandState;
  readonly terrain: Terrain;
  readonly view: ObjectView;
  readonly buildings: Building[] = [];
  readonly group = new THREE.Group();
  private readonly solid = new Uint8Array(W * H);

  constructor(
    readonly stage: Stage,
    seed: number,
    state?: IslandState,
  ) {
    this.I = generate(seed);
    this.S = state ?? freshState(this.I);
    this.terrain = new Terrain(this.I, stage);
    this.view = new ObjectView(this.I, this.S, this.terrain, stage);
    this.group.add(this.terrain.group, this.view.group);
    for (const b of this.I.bridges) this.group.add(bridgeModel(b));
    for (const [k, v] of Object.entries(this.S.paths)) this.terrain.setPath(+k % W, Math.floor(+k / W), v);
    stage.scene.add(this.group);
  }

  /** Put up the buildings; houses take their residents' colours. */
  build(residents: (Villager | null)[]): void {
    for (const b of this.buildings) this.group.remove(b.group);
    this.buildings.length = 0;
    this.solid.fill(0);
    let h = 0;
    for (const p of this.I.plots) {
      let owner: Villager | null = null;
      if (p.kind === "house") owner = residents[h++] ?? null;
      if (p.kind === "house" && !owner) {
        // An empty plot: a sign, no house.
        continue;
      }
      const g = plotModel(p, owner ? { wall: owner.house.wall, roof: owner.house.roof, door: owner.house.door } : undefined, owner?.house.style ?? 0);
      const y = p.tier * TIER_H;
      if (p.kind === "dock") g.position.set(p.x, 0.02, p.z);
      else g.position.set(p.x + p.w / 2, y, p.z + p.d / 2);
      this.group.add(g);
      let rect: [number, number, number, number] = [p.x, p.z, p.w, p.d];
      let door: [number, number] = [p.x + Math.floor(p.w / 2), p.z + p.d];
      if (p.kind === "office") {
        rect = [p.x, p.z, p.w, 3];
        door = [p.x + 3, p.z + 3];
      } else if (p.kind === "camp") rect = [p.x + 1, p.z, 2, 2];
      else if (p.kind === "dock") {
        rect = [p.x + 2, p.z + p.d, 2, 2];
        door = [p.x, p.z + p.d - 1];
      }
      for (let z = rect[1]; z < rect[1] + rect[3]; z++) for (let x = rect[0]; x < rect[0] + rect[2]; x++) if (inside(x, z)) this.solid[idx(x, z)] = 1;
      this.buildings.push({ plot: p, rect, door, group: g, owner: owner?.id });
    }
  }

  plot(kind: Plot["kind"]): Plot | undefined {
    return this.I.plots.find((p) => p.kind === kind);
  }

  building(kind: Plot["kind"], owner?: string): Building | undefined {
    return this.buildings.find((b) => b.plot.kind === kind && (owner === undefined || b.owner === owner));
  }

  /** Tiles taken by buildings (for placing things). */
  isSolid(x: number, z: number): boolean {
    return inside(x, z) && !!this.solid[idx(x, z)];
  }

  /** Can a body stand on this tile at all (ignoring height)? */
  passable(x: number, z: number): boolean {
    if (!inside(x, z)) return false;
    const i = idx(x, z);
    if (this.solid[i]) return false;
    const k = this.I.kind[i];
    const bridged = !!bridgeAt(this.I, x + 0.5, z + 0.5);
    if (!(k === K.Grass || k === K.Sand || k === K.Pier || bridged || rampAt(this.I, x + 0.5, z + 0.5))) return false;
    const o = this.S.objs[i];
    if (o && blocks(o)) return false;
    return true;
  }

  groundY(x: number, z: number): number {
    return this.terrain.groundY(x, z);
  }

  /**
   * Can a round body of radius r stand at (x, z) coming from height y? Tiles must be passable
   * and the ground no more than a small step away (ramps are continuous, cliffs are not).
   */
  canStand(x: number, z: number, y: number, r = 0.28): boolean {
    for (const [dx, dz] of [
      [0, 0],
      [r, 0],
      [-r, 0],
      [0, r],
      [0, -r],
      [r * 0.7, r * 0.7],
      [-r * 0.7, r * 0.7],
      [r * 0.7, -r * 0.7],
      [-r * 0.7, -r * 0.7],
    ]) {
      const px = x + dx;
      const pz = z + dz;
      if (!this.passable(Math.floor(px), Math.floor(pz))) return false;
      if (Math.abs(this.groundY(px, pz) - y) > 0.4) return false;
    }
    return true;
  }

  obj(x: number, z: number): Obj | undefined {
    return inside(x, z) ? this.S.objs[idx(x, z)] : undefined;
  }

  setObj(x: number, z: number, o: Obj | null): void {
    const i = idx(x, z);
    if (o) this.S.objs[i] = o;
    else delete this.S.objs[i];
    this.view.dirty = true;
  }

  setPath(x: number, z: number, type: number): void {
    const i = idx(x, z);
    if (type) this.S.paths[i] = type;
    else delete this.S.paths[i];
    this.terrain.setPath(x, z, type);
  }

  /** Is a tile an empty spot of ground where something can be put down? */
  freeTile(x: number, z: number): boolean {
    if (!inside(x, z) || this.solid[idx(x, z)]) return false;
    const k = this.I.kind[idx(x, z)];
    if (k !== K.Grass && k !== K.Sand) return false;
    if (rampAt(this.I, x + 0.5, z + 0.5) || bridgeAt(this.I, x + 0.5, z + 0.5)) return false;
    return !this.S.objs[idx(x, z)];
  }

  waterAt(x: number, z: number): "river" | "pond" | "sea" | null {
    if (!inside(x, z)) return "sea";
    const k = this.I.kind[idx(x, z)];
    if (bridgeAt(this.I, x + 0.5, z + 0.5)) return null;
    return k === K.River ? "river" : k === K.Pond ? "pond" : k === K.Sea ? "sea" : null;
  }

  /** Run the island's morning if the day turned. */
  tickDay(): number[] {
    const d = clock.day();
    if (this.S.day === d) return [];
    const t = morning(this.I, this.S, d, (x, z) => this.isSolid(x, z));
    this.view.dirty = true;
    return t;
  }

  /** Where visitors and the player arrive: the end of the pier, or the office plaza. */
  spawn(): [number, number] {
    const dock = this.plot("dock");
    if (dock) return [dock.x + 1, dock.z + 0.5];
    const o = this.plot("office")!;
    return [o.x + 3.5, o.z + 4.5];
  }
}

export function blocks(o: Obj): boolean {
  return o.t === "tree" ? o.stage >= 1 : o.t === "rock" || o.t === "stump" || o.t === "furn" || o.t === "hole";
}
