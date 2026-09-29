/**
 * The people who run things. The shop: the day's stock (tools, seeds, saplings, furniture,
 * clothes, wallpaper, a recipe), buying back anything, bigger pockets, and radishes — bought on
 * Sunday morning, sold in the week at a price that swings twice a day. The museum: appraising
 * fossils and taking donations. The office: the workbench, savings, the island noticeboard.
 * The ferry to friends' islands, and presents.
 */
import { sfx } from "../audio/sound";
import { clock } from "../core/clock";
import { rng } from "../core/noise";
import { FOSSILS, item, ITEMS, josa, pp, TOOL_NAMES, type ItemDef } from "../data/items";
import { BUGS, FISH } from "../data/critters";
import { FURNITURE } from "../render/furniture";
import type { Game } from "./game";
import { appraise } from "./ops";

export interface Stock {
  basics: string[];
  furniture: string[];
  clothes: string[];
  deco: string[];
  recipe: string | null;
}

const BASIC_RECIPES = ["shovel", "axe", "net", "rod", "can", "slingshot", "ladder", "pole", "chair", "stool", "fence", "campfire", "potted", "crate", "sign", "woodpile", "stone-tower"];

export class Services {
  constructor(readonly g: Game) {}

  stock(): Stock {
    const day = clock.day();
    const R = rng(this.g.island.seed * 71 + day * 17);
    const pick = <T>(a: T[], n: number): T[] => {
      const c = [...a];
      const out: T[] = [];
      while (out.length < n && c.length) out.push(c.splice(Math.floor(R() * c.length), 1)[0]);
      return out;
    };
    const furn = pick(FURNITURE, 6).map((f) => `furn:${f.id}:${Math.floor(R() * f.colors.length)}`);
    const clothes = pick([...ITEMS.values()].filter((d) => d.kind === "top" || d.kind === "bottom" || d.kind === "hat"), 5).map((d) => d.id);
    const deco = [`wall:${Math.floor(R() * 10)}`, `floor:${Math.floor(R() * 10)}`];
    const recipes = [...ITEMS.values()].filter((d) => d.kind === "recipe");
    const seeds = pick([...ITEMS.values()].filter((d) => d.kind === "seed"), 3).map((d) => d.id);
    return {
      basics: ["shovel", "axe", "net", "rod", "can", "slingshot", "ladder", "pole", "sapling", "cedar-sapling", ...seeds],
      furniture: furn,
      clothes,
      deco,
      recipe: recipes.length ? recipes[Math.floor(R() * recipes.length)].id : null,
    };
  }

  /** This week's radish prices: [Mon am, Mon pm, …, Sat pm] and the Sunday buy price. */
  radish(): { buy: number; sell: number[] } {
    const d = clock.now();
    const week = Math.floor((clock.day() + 3) / 7);
    const R = rng(this.g.island.seed * 131 + week * 29);
    const buy = 90 + Math.floor(R() * 20);
    const pattern = Math.floor(R() * 4);
    const sell: number[] = [];
    const peak = 2 + Math.floor(R() * 7);
    for (let k = 0; k < 12; k++) {
      let f: number;
      if (pattern === 0) f = 0.9 - k * 0.04 + R() * 0.05; // falling
      else if (pattern === 1) f = k === peak ? 3 + R() * 3 : k === peak - 1 || k === peak + 1 ? 1.5 + R() : 0.7 + R() * 0.3; // spike
      else if (pattern === 2) f = k === peak ? 1.6 + R() * 0.4 : 0.8 + R() * 0.3; // small bump
      else f = 0.6 + R() * 0.8; // random
      sell.push(Math.round(buy * f));
    }
    void d;
    return { buy, sell };
  }

  private buyMenu(title: string, ids: string[], mult = 1): Promise<number> {
    const g = this.g;
    return g.ui.menu(
      title,
      ids.map((id) => {
        const d = item(id);
        const price = Math.round((d.buy ?? d.sell * 4) * mult);
        return { label: d.name, icon: id, right: `${price.toLocaleString()}`, sub: d.desc };
      }),
      {
        foot: `가진 도토리 ${g.pockets.money.toLocaleString()}`,
        onPick: (i) => {
          const id = ids[i];
          const d = item(id);
          const price = Math.round((d.buy ?? d.sell * 4) * mult);
          if (g.pockets.money < price) {
            g.ui.toast("도토리가 모자라!");
            sfx("fail");
            return false;
          }
          if (!g.pockets.fits(id)) {
            g.ui.toast("주머니가 가득 찼어!");
            sfx("fail");
            return false;
          }
          g.pockets.money -= price;
          g.pockets.add(id);
          sfx("coin");
          g.ui.toast(`${josa(d.name, "을를")} 샀다!`, id);
          return false;
        },
      },
    );
  }

  async shop(): Promise<void> {
    const g = this.g;
    const say = (l: string[], c?: string[]) => g.ui.say("보리", l, { choices: c, color: "#6ab070", pitch: 0.9 });
    const d = clock.now();
    const sunday = d.getDay() === 0 && clock.hour() < 12;
    let k = await say(["어서 와요! 도토리 잡화점이에요. 오늘은 뭘 도와드릴까요?"], ["사고 싶어", "팔고 싶어", sunday ? "무 사기 (일요일)" : "무 시세", "주머니 늘리기", "그만"]);
    while (k >= 0 && k < 4) {
      const st = this.stock();
      if (k === 0) {
        const cat = await g.ui.menu("무엇을 볼까요?", [{ label: "도구와 씨앗" }, { label: "오늘의 가구" }, { label: "오늘의 옷" }, { label: "벽지와 바닥" }, { label: "오늘의 레시피" }]);
        if (cat === 0) await this.buyMenu("도구와 씨앗", st.basics);
        if (cat === 1) await this.buyMenu("오늘의 가구", st.furniture);
        if (cat === 2) await this.buyMenu("오늘의 옷", st.clothes);
        if (cat === 3) await this.buyMenu("벽지와 바닥", st.deco);
        if (cat === 4 && st.recipe) await this.buyMenu("오늘의 레시피", [st.recipe]);
      } else if (k === 1) await this.sell();
      else if (k === 2) await this.radishTalk(sunday, say);
      else if (k === 3) {
        const size = g.pockets.size;
        const next = size < 30 ? 30 : size < 40 ? 40 : 0;
        if (!next) await say(["주머니가 이미 제일 커요!"]);
        else {
          const price = next === 30 ? 5000 : 25000;
          const c = await say([`주머니를 ${next}칸으로 늘려 드릴까요? ${price.toLocaleString()} 도토리예요.`], ["늘릴래", "다음에"]);
          if (c === 0 && g.pockets.money >= price) {
            g.pockets.money -= price;
            g.pockets.grow(next);
            sfx("fanfare");
            await say([`짠! 이제 ${next}칸이에요!`]);
          } else if (c === 0) await say(["도토리가 조금 모자라요!"]);
        }
      }
      k = await say(["또 필요한 게 있나요?"], ["사고 싶어", "팔고 싶어", sunday ? "무 사기 (일요일)" : "무 시세", "주머니 늘리기", "그만"]);
    }
    await say(["또 오세요!"]);
  }

  private radishPrice(): number | null {
    const d = clock.now();
    if (d.getDay() === 0) return null;
    const { sell } = this.radish();
    return sell[(d.getDay() - 1) * 2 + (clock.hour() >= 12 ? 1 : 0)];
  }

  private async radishTalk(sunday: boolean, say: (l: string[], c?: string[]) => Promise<number>): Promise<void> {
    const g = this.g;
    const r = this.radish();
    if (sunday) {
      const c = await say([`일요일 아침엔 무를 팔아요! 한 개에 ${r.buy} 도토리. 일주일 안에 비싸게 팔면 이득이죠.`], ["10개 살래", "50개 살래", "안 살래"]);
      const n = c === 0 ? 10 : c === 1 ? 50 : 0;
      if (!n) return;
      const cost = n * r.buy;
      if (g.pockets.money < cost) return void (await say(["도토리가 모자라요!"]));
      if (!g.pockets.fits("radish", n)) return void (await say(["주머니에 자리가 없어요!"]));
      g.pockets.money -= cost;
      g.pockets.add("radish", n);
      g.profile.radish = [r.buy, Math.floor((clock.day() + 3) / 7)];
      sfx("coin");
      await say([`무 ${n}개, 여기 있어요! 다음 일요일 전에 파세요. 안 그러면 상해요!`]);
      return;
    }
    const p = this.radishPrice();
    await say([`오늘 무 시세는 한 개에 ${p} 도토리예요. 오전과 오후에 값이 바뀌어요.`]);
  }

  private async sell(): Promise<void> {
    const g = this.g;
    const radish = this.radishPrice();
    const week = Math.floor((clock.day() + 3) / 7);
    const stale = g.profile.radish && g.profile.radish[1] !== week;
    const price = (id: string) => {
      if (id === "radish") return stale ? 0 : (radish ?? 0);
      return item(id).sell;
    };
    for (;;) {
      const slots = g.pockets.slots.map((s, i) => [s, i] as const).filter(([s]) => s && price(s.id) > 0);
      if (!slots.length) {
        g.ui.toast("팔 수 있는 물건이 없어요.");
        return;
      }
      const k = await g.ui.menu(
        "무엇을 팔까요?",
        [{ label: "전부 팔기 (도구·가구·옷 빼고)", right: "" }, ...slots.map(([s]) => ({ label: item(s!.id).name, icon: s!.id, right: `${(price(s!.id) * s!.n).toLocaleString()}${s!.n > 1 ? ` (×${s!.n})` : ""}` }))],
        { foot: `가진 도토리 ${g.pockets.money.toLocaleString()}` },
      );
      if (k < 0) return;
      const sellOne = (i: number) => {
        const s = g.pockets.slots[i]!;
        const earn = price(s.id) * s.n;
        g.pockets.slots[i] = null;
        g.pockets.money += earn;
        return earn;
      };
      let total = 0;
      if (k === 0) {
        for (const [s, i] of slots) {
          const d = item(s!.id);
          if (d.kind === "tool" || d.kind === "furniture" || d.kind === "top" || d.kind === "bottom" || d.kind === "hat") continue;
          total += sellOne(i);
        }
      } else total = sellOne(slots[k - 1][1]);
      g.pockets.onChange?.();
      sfx("coin");
      g.ui.toast(`도토리 ${total.toLocaleString()}개를 받았다!`);
    }
  }

  // ---------------------------------------------------------------- museum

  async museum(): Promise<void> {
    const g = this.g;
    const say = (l: string[], c?: string[]) => g.ui.say("솔방울 박사", l, { choices: c, color: "#5a6a9a", pitch: 0.75 });
    let k = await say(["호오, 어서 오게. 섬의 자연을 모으는 박물관일세. 무엇을 도와줄까?"], ["기증하고 싶어요", "화석 감정", "전시 현황", "그만"]);
    while (k >= 0 && k < 3) {
      const m = g.island.museum;
      if (k === 0) {
        const can = g.pockets.slots.map((s, i) => [s, i] as const).filter(([s]) => s && (s.id.startsWith("fish:") || s.id.startsWith("bug:") || s.id.startsWith("fossil:")) && !m.includes(s.id));
        if (!can.length) await say(["흠, 박물관에 아직 없는 건 가지고 있지 않군. 새로운 물고기나 곤충, 감정한 화석을 가져오게."]);
        else {
          const pick = await g.ui.menu(
            "무엇을 기증할까?",
            can.map(([s]) => ({ label: item(s!.id).name, icon: s!.id })),
          );
          if (pick >= 0) {
            const [s, i] = can[pick];
            g.pockets.takeAt(i);
            m.push(s!.id);
            sfx("fanfare");
            const d = item(s!.id);
            await say([`오오! ${pp(d.name, "이라니", "라니")}…`, this.fact(d), "박물관에 소중히 전시하겠네. 고맙네!"]);
            g.interiors.rebuild();
          }
        }
      } else if (k === 1) {
        const n = g.pockets.count("fossil");
        if (!n) await say(["감정할 화석이 없군. 땅에 금 간 자리를 삽으로 파 보게."]);
        else {
          const have = new Set([...m, ...g.pockets.slots.filter(Boolean).map((s) => s!.id)]);
          const got: string[] = [];
          for (let j = 0; j < n; j++) {
            const id = appraise(have);
            have.add(id);
            got.push(id);
          }
          g.pockets.take("fossil", n);
          for (const id of got) g.pockets.add(id);
          await say([`감정이 끝났네! ${got.map((id) => item(id).name).join(", ")}${n > 1 ? "이었어" : "였어"}.`]);
        }
      } else {
        const f = m.filter((x) => x.startsWith("fish:")).length;
        const b = m.filter((x) => x.startsWith("bug:")).length;
        const s = m.filter((x) => x.startsWith("fossil:")).length;
        await say([`지금까지 물고기 ${f}/${FISH.length}, 곤충 ${b}/${BUGS.length}, 화석 ${s}/${FOSSILS.length}점이 모였네.`, f + b + s === FISH.length + BUGS.length + FOSSILS.length ? "완벽하군! 자네 덕분일세!" : "아직 갈 길이 멀군. 계속 부탁하네!"]);
      }
      k = await say(["또 무엇을 도와줄까?"], ["기증하고 싶어요", "화석 감정", "전시 현황", "그만"]);
    }
    await say(["자연을 아끼는 마음, 잊지 말게."]);
  }

  private fact(d: ItemDef): string {
    if (d.critter) {
      const c = d.critter;
      const where = { river: "강", pond: "연못", sea: "바다", pier: "부두 끝", mouth: "강어귀", clifftop: "절벽 위 강", fly: "하늘", flower: "꽃", tree: "나무", ground: "땅", water: "물 위", rock: "바위 밑", shake: "나무 위", light: "불빛", beach: "해변", palm: "야자나무", stump: "그루터기", rain: "비 오는 날", "night-fly": "밤하늘" }[c.place] ?? "섬";
      return `${josa(d.name, "은는")} ${where}에서 볼 수 있지. ${c.rarity >= 4 ? "아주 귀한 녀석이야!" : c.rarity >= 3 ? "제법 보기 드문 편일세." : "흔하지만 소중한 친구지."}`;
    }
    return "오래전 이 땅을 걸었던 생명의 흔적이지. 가슴이 뛰는군!";
  }

  // ---------------------------------------------------------------- office

  async office(): Promise<void> {
    const g = this.g;
    const say = (l: string[], c?: string[]) => g.ui.say("카피", l, { choices: c, color: "#5ab8e8", pitch: 0.7 });
    let k = await say([`${g.island.name} 섬 사무소예요~ 느긋하게 도와드릴게요…`], ["공작대 쓰기", "도토리 맡기기", "섬 소식", "그만"]);
    while (k >= 0 && k < 3) {
      if (k === 0) await this.craft();
      else if (k === 1) await this.bank(say);
      else if (k === 2) {
        const g2 = this.g;
        const lines = [`우리 섬에는 이웃이 ${g2.villagers.list.length}명 살고 있어요.`];
        const camper = g2.island.camper;
        if (camper) lines.push("오늘은 캠핑장에 손님이 왔대요. 한번 가 보세요~");
        const bday = g2.villagers.list.find((n) => n.v.birthday[0] === clock.month());
        if (bday) lines.push(`이번 달엔 ${bday.v.name}의 생일(${bday.v.birthday[0]}월 ${bday.v.birthday[1]}일)이 있어요.`);
        lines.push(`섬 과일은 ${item(g2.world.I.fruit).name}, 섬 꽃은 ${item(`flower:${g2.world.I.flower}:0`).name.split(" ")[1]}예요.`);
        await say(lines);
      }
      k = await say(["또 필요한 게 있으세요~?"], ["공작대 쓰기", "도토리 맡기기", "섬 소식", "그만"]);
    }
    await say(["그럼 느긋하게~"]);
  }

  private async bank(say: (l: string[], c?: string[]) => Promise<number>): Promise<void> {
    const g = this.g;
    const p = g.profile;
    const c = await say([`맡긴 도토리는 ${p.bank.toLocaleString()}개예요. 매달 조금씩 이자가 붙어요.`], ["1000 맡기기", "전부 맡기기", "1000 찾기", "전부 찾기", "그만"]);
    if (c === 0 && g.pockets.money >= 1000) {
      g.pockets.money -= 1000;
      p.bank += 1000;
    } else if (c === 1) {
      p.bank += g.pockets.money;
      g.pockets.money = 0;
    } else if (c === 2 && p.bank >= 1000) {
      p.bank -= 1000;
      g.pockets.money += 1000;
    } else if (c === 3) {
      g.pockets.money += p.bank;
      p.bank = 0;
    }
    if (c >= 0 && c < 4) sfx("coin");
  }

  /** The workbench: known recipes, what they need, make one. */
  async craft(): Promise<void> {
    const g = this.g;
    const known = [...new Set([...BASIC_RECIPES, ...g.profile.recipes.filter((r) => !r.startsWith("_"))])];
    const recipes: [string, [string, number][]][] = [];
    for (const r of known) {
      if (TOOL_NAMES[r as keyof typeof TOOL_NAMES]) recipes.push([r, item(r).recipe!]);
      else {
        const d = ITEMS.get(`furn:${r}:0`);
        if (d?.recipe) recipes.push([`furn:${r}:0`, d.recipe]);
      }
    }
    for (const t of Object.keys(TOOL_NAMES)) {
      const gold = ITEMS.get(`gold-${t}`);
      if (gold && g.pockets.count("gold") > 0) recipes.push([gold.id, gold.recipe!]);
    }
    const can = (req: [string, number][]) => req.every(([id, n]) => g.pockets.count(id) >= n);
    await g.ui.menu(
      "공작대",
      recipes.map(([id, req]) => ({ label: item(id).name, icon: id, sub: req.map(([m, n]) => `${item(m).name} ${g.pockets.count(m)}/${n}`).join(" · "), disabled: !can(req) })),
      {
        foot: "재료가 모자라면 흐리게 보여요",
        onPick: (i) => {
          const [id, req] = recipes[i];
          if (!can(req)) return false;
          for (const [m, n] of req) g.pockets.take(m, n);
          g.pockets.add(id);
          sfx("fanfare");
          g.ui.toast(`${josa(item(id).name, "을를")} 만들었다!`, id);
          return false;
        },
      },
    );
  }

  // ---------------------------------------------------------------- ferry and presents

  async ferry(): Promise<void> {
    const g = this.g;
    const say = (l: string[], c?: string[]) => g.ui.say("물범 선장", l, { choices: c, color: "#3a4a8a", pitch: 0.65 });
    if (g.net && !g.net.isHost) {
      const c = await say(["집으로 돌아갈 텐가?"], ["돌아갈래", "조금 더 있을래"]);
      if (c === 0) g.net.leave();
      return;
    }
    const c = await say(["어기영차~ 친구 섬으로 가 볼 텐가? 아니면 친구를 부를 텐가?"], ["친구를 초대할래", "친구 섬에 갈래", "그만"]);
    if (c === 0) await g.phone.hostIsland();
    if (c === 1) await g.phone.visitIsland();
  }

  openPresent(i: number): void {
    const g = this.g;
    g.pockets.takeAt(i);
    const r = Math.random();
    let id: string;
    if (r < 0.6) {
      const f = FURNITURE[Math.floor(Math.random() * FURNITURE.length)];
      id = `furn:${f.id}:${Math.floor(Math.random() * f.colors.length)}`;
    } else if (r < 0.85) {
      const c = [...ITEMS.values()].filter((d) => d.kind === "top" || d.kind === "hat");
      id = c[Math.floor(Math.random() * c.length)].id;
    } else {
      const rec = [...ITEMS.values()].filter((d) => d.kind === "recipe");
      id = rec[Math.floor(Math.random() * rec.length)].id;
    }
    sfx("open");
    g.give(id);
  }
}
