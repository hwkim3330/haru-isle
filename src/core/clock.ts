/**
 * Island time runs on the player's real clock, like a diary: morning here is morning there.
 * `?t=2026-04-05T14:30` pins it (tests, screenshots); `?speed=60` makes a minute pass in a
 * second. Seasons follow the northern hemisphere.
 */
const q = typeof location === "undefined" ? new URLSearchParams() : new URLSearchParams(location.search);
const pinned = q.get("t");
const speed = +(q.get("speed") ?? 1) || 1;
const t0 = Date.now();
const base = pinned ? new Date(pinned).getTime() : t0;

export type Season = "spring" | "summer" | "autumn" | "winter";

export const clock = {
  /** Extra offset the host sends so visitors share its hour. */
  offset: 0,
  now(): Date {
    return new Date(base + (Date.now() - t0) * speed + this.offset);
  },
  /** Hours as a float, 0..24. */
  hour(): number {
    const d = this.now();
    return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  },
  /** Month 1..12. */
  month(): number {
    return this.now().getMonth() + 1;
  },
  /** Days since 2020-01-01 in local time: the key for everything that resets daily (5 am). */
  day(): number {
    const d = new Date(this.now().getTime() - 5 * 3600e3);
    return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(2020, 0, 1)) / 86400e3);
  },
  season(): Season {
    const m = this.month();
    return m >= 3 && m <= 5 ? "spring" : m >= 6 && m <= 8 ? "summer" : m >= 9 && m <= 11 ? "autumn" : "winter";
  },
  /** 0..1 progress of the year (for grass colour and blossoms), Jan 1 = 0. */
  yearT(): number {
    const d = this.now();
    const s = new Date(d.getFullYear(), 0, 1).getTime();
    return (d.getTime() - s) / (365.25 * 86400e3);
  },
};

export function inHours(h: number, from: number, to: number): boolean {
  return from <= to ? h >= from && h < to : h >= from || h < to;
}
