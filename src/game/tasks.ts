/**
 * 하루 도장: five small things to do each day (shake trees, catch fish, pull weeds, talk to
 * neighbours…), picked from the day and the island. Finishing one pays 도토리; finishing all
 * five gives a present.
 */
import { sfx } from "../audio/sound";
import { clock } from "../core/clock";
import { rng } from "../core/noise";
import type { Game } from "./game";

export type Deed = "shake" | "fish" | "bug" | "weed" | "talk" | "eat" | "water" | "rock" | "dig" | "sell" | "plant" | "craft" | "shell";

const DEEDS: [Deed, string, number, number][] = [
  ["shake", "나무 흔들기", 3, 300],
  ["fish", "물고기 낚기", 2, 500],
  ["bug", "곤충 잡기", 2, 500],
  ["weed", "잡초 뽑기", 5, 300],
  ["talk", "이웃과 이야기하기", 3, 400],
  ["eat", "과일 먹기", 1, 200],
  ["water", "꽃에 물 주기", 3, 300],
  ["rock", "바위 치기", 3, 400],
  ["dig", "땅 파기", 4, 300],
  ["sell", "물건 팔기", 1, 300],
  ["plant", "무언가 심기", 1, 300],
  ["craft", "공작대로 만들기", 1, 600],
  ["shell", "조개 줍기", 3, 300],
];

export interface DayTasks {
  day: number;
  list: { k: Deed; n: number; done: number; paid: boolean }[];
  bonus: boolean;
}

export class Tasks {
  constructor(readonly g: Game) {}

  get today(): DayTasks {
    const p = this.g.profile;
    const d = clock.day();
    if (!p.tasks || p.tasks.day !== d) {
      const R = rng(d * 97 + (this.g.island.seed % 1000));
      const pool = [...DEEDS];
      const list: DayTasks["list"] = [];
      while (list.length < 5) {
        const [k, , n] = pool.splice(Math.floor(R() * pool.length), 1)[0];
        list.push({ k, n, done: 0, paid: false });
      }
      p.tasks = { day: d, list, bonus: false };
    }
    return p.tasks;
  }

  did(k: Deed, n = 1): void {
    const T = this.today;
    const t = T.list.find((x) => x.k === k);
    if (!t || t.paid) return;
    t.done = Math.min(t.n, t.done + n);
    if (t.done >= t.n) {
      t.paid = true;
      const def = DEEDS.find((d) => d[0] === k)!;
      this.g.pockets.money += def[3];
      sfx("coin");
      this.g.ui.toast(`하루 도장! "${def[1]}" 완료 · 도토리 ${def[3]}`);
      if (!T.bonus && T.list.every((x) => x.paid)) {
        T.bonus = true;
        sfx("fanfare");
        this.g.ui.toast("오늘의 도장을 모두 모았다! 선물을 받았다.");
        this.g.give("present", 1, true);
      }
    }
  }

  rows(): { label: string; sub: string; done: boolean }[] {
    return this.today.list.map((t) => {
      const def = DEEDS.find((d) => d[0] === t.k)!;
      return { label: `${t.paid ? "✅" : "⬜"} ${def[1]}`, sub: `${t.done}/${t.n} · 보상 도토리 ${def[3]}`, done: t.paid };
    });
  }
}
