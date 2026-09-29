/**
 * Saving: the player's profile (look, pockets, recipes, the guide of what they've caught,
 * home) and their island (seed, tile state, neighbours, museum, shop) in localStorage.
 */
import type { IslandState } from "../world/state";
import type { Slot } from "./pockets";

export interface Outfit {
  top: string | null;
  bottom: string | null;
  hat: string | null;
}

export interface Placed {
  id: string;
  x: number;
  z: number;
  rot: number;
}

export interface Profile {
  v: 1;
  name: string;
  skin: number;
  hair: string;
  hairColor: number;
  eyes: string;
  outfit: Outfit;
  pockets: { slots: (Slot | null)[]; money: number; storage: Slot[] };
  recipes: string[];
  caught: string[];
  power: number;
  home: { items: Placed[]; wall: number; floor: number; size: number };
  held: number;
  bank: number;
  created: number;
  days: number;
  lastDay: number;
  /** Radishes bought this week: [price paid, week key]. */
  radish?: [number, number];
}

export interface Resident {
  seed: number;
  friend: number;
  talkedDay: number;
  giftDay: number;
  /** A favour asked today: [item wanted, reward] */
  ask?: [string, string] | null;
  askDay?: number;
  plot: number;
  movedIn: number;
}

export interface IslandSave {
  v: 1;
  seed: number;
  name: string;
  state: IslandState;
  residents: Resident[];
  museum: string[];
  /** A camper at the campsite today (seed), or none. */
  camper: { seed: number; day: number } | null;
  created: number;
}

const PK = "haru.profile";
const IK = "haru.island";

function get<T>(k: string): T | null {
  try {
    const s = localStorage.getItem(k);
    return s ? (JSON.parse(s) as T) : null;
  } catch {
    return null;
  }
}

function put(k: string, v: unknown): void {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage full or blocked: play on without saving */
  }
}

export const save = {
  profile: () => get<Profile>(PK),
  island: () => get<IslandSave>(IK),
  putProfile: (p: Profile) => put(PK, p),
  putIsland: (i: IslandSave) => put(IK, i),
  wipe(): void {
    try {
      localStorage.removeItem(PK);
      localStorage.removeItem(IK);
    } catch {
      /* ignore */
    }
  },
};
