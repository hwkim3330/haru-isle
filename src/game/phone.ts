/**
 * The island phone: the critter guide (what you've caught, where and when things appear),
 * recipes, the island map, the island designer (lay paths), your neighbours and how close
 * you are, visiting friends, and settings.
 */
import { setVolumes, audio, sfx } from "../audio/sound";
import { clock } from "../core/clock";
import { BUGS, FISH, hoursText, inSeason, monthsText } from "../data/critters";
import { item, ITEMS, TOOL_NAMES } from "../data/items";
import { SPECIES, TEMPERS } from "../data/species";
import { PATHS } from "../world/terrain";
import { H, idx, K, W } from "../world/island";
import { Net } from "../net/net";
import type { Game } from "./game";
import { save } from "./save";

const APPS: [string, string, string][] = [
  ["tasks", "오늘의 할 일", "📮"],
  ["guide", "도감", "🐟"],
  ["recipes", "레시피", "📜"],
  ["map", "지도", "🗺️"],
  ["design", "섬 디자인", "🛠️"],
  ["friends", "이웃", "💌"],
  ["online", "친구 초대", "✈️"],
  ["settings", "설정", "⚙️"],
  ["emote", "몸짓", "🙌"],
];

export class Phone {
  /** Island designer: the path being laid (0 = off). */
  designing = 0;

  constructor(readonly g: Game) {}

  async open(): Promise<void> {
    const g = this.g;
    if (g.ui.modal) return;
    sfx("open");
    const k = await g.ui.menu(
      "섬폰",
      APPS.map(([, n, e]) => ({ label: `${e}  ${n}` })),
      { foot: this.designing ? `섬 디자인 중: ${["", "흙길", "돌길", "벽돌길", "나무길"][this.designing]}` : "" },
    );
    const app = APPS[k]?.[0];
    if (app === "tasks") await g.ui.menu("오늘의 할 일 (하루 도장)", g.tasks.rows(), { foot: "다섯 개를 모두 하면 선물!" });
    if (app === "guide") await this.guide();
    if (app === "recipes") await this.recipes();
    if (app === "map") await this.map();
    if (app === "design") await this.design();
    if (app === "friends") await this.friends();
    if (app === "online") await this.online();
    if (app === "settings") await this.settings();
    if (app === "emote") await this.emote();
  }

  private async guide(): Promise<void> {
    const g = this.g;
    const m = clock.month();
    const h = clock.hour();
    const tab = await g.ui.menu("도감", [{ label: `물고기 (${g.profile.caught.filter((c) => c.startsWith("fish:")).length}/${FISH.length})` }, { label: `곤충 (${g.profile.caught.filter((c) => c.startsWith("bug:")).length}/${BUGS.length})` }]);
    if (tab < 0) return;
    const list = tab === 0 ? FISH : BUGS;
    const pre = tab === 0 ? "fish:" : "bug:";
    const now = list.filter((c) => inSeason(c, m, h, true));
    await g.ui.menu(
      tab === 0 ? "물고기 도감" : "곤충 도감",
      list.map((c) => {
        const got = g.profile.caught.includes(pre + c.id);
        const donated = g.island.museum.includes(pre + c.id);
        return {
          label: got ? `${c.name}${donated ? " 🏛️" : ""}` : "???",
          icon: got ? pre + c.id : undefined,
          sub: got ? `${monthsText(c)} · ${hoursText(c)} · ${placeName(c.place)}${c.rain ? " · 비 올 때" : ""}` : now.includes(c) ? "지금 섬 어딘가에…" : "",
          right: got ? `${c.price.toLocaleString()}` : "",
          disabled: !got,
        };
      }),
      { foot: "🏛️ 박물관에 기증함" },
    );
  }

  private async recipes(): Promise<void> {
    const g = this.g;
    const tools = Object.keys(TOOL_NAMES);
    const basic = ["chair", "stool", "fence", "campfire", "potted", "crate", "sign", "woodpile", "stone-tower"];
    const known = [...new Set([...tools, ...basic, ...g.profile.recipes.filter((r) => !r.startsWith("_"))])];
    const all = [...ITEMS.values()].filter((d) => d.kind === "recipe").length + tools.length + basic.length;
    await g.ui.menu(
      `레시피 (${known.length}/${all})`,
      known.map((r) => {
        const id = tools.includes(r) ? r : `furn:${r}:0`;
        const d = item(id);
        return { label: d.name, icon: id, sub: (d.recipe ?? []).map(([m, n]) => `${item(m).name} ${n}`).join(" · ") };
      }),
      { foot: "섬 사무소의 공작대에서 만들 수 있어요" },
    );
  }

  /** The island map: terrain, buildings, you, the neighbours. */
  async map(): Promise<void> {
    const g = this.g;
    if (g.ui.modal) return;
    const I = g.world.I;
    const S = 5;
    const cv = document.createElement("canvas");
    cv.width = W * S;
    cv.height = H * S;
    const c = cv.getContext("2d")!;
    for (let z = 0; z < H; z++)
      for (let x = 0; x < W; x++) {
        const i = idx(x, z);
        const k = I.kind[i];
        const t = I.tier[i];
        c.fillStyle = k === K.Sea ? "#5ab8e0" : k === K.Sand ? "#f4e4b8" : k === K.River || k === K.Pond ? "#7ad0f0" : k === K.Rock ? "#a8a8a8" : k === K.Pier ? "#b08a60" : ["#9ad870", "#7ec45c", "#62ae4a"][t];
        c.fillRect(x * S, z * S, S, S);
        if (g.world.S.paths[i]) {
          c.fillStyle = ["", "#c8a070", "#b8b8b8", "#c8704a", "#a87a50"][g.world.S.paths[i]];
          c.fillRect(x * S, z * S, S, S);
        }
      }
    for (const b of g.world.buildings) {
      c.fillStyle = { house: "#e8806a", home: "#4a8ad8", shop: "#6ab070", museum: "#9a8ab8", office: "#f8c84a", camp: "#f8a040", dock: "#8a5a3a" }[b.plot.kind] ?? "#888";
      const [x, z, w, d] = b.rect;
      c.fillRect(x * S, z * S, w * S, d * S);
    }
    for (const n of g.villagers.list) {
      if (n.inside) continue;
      c.fillStyle = "#" + n.v.look.shirt.toString(16).padStart(6, "0");
      c.beginPath();
      c.arc(n.p.pos.x * S, n.p.pos.z * S, 4, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#fff";
      c.stroke();
    }
    const P = g.where === "out" ? g.player.pos : null;
    if (P) {
      c.fillStyle = "#e84a4a";
      c.beginPath();
      c.arc(P.x * S, P.z * S, 6, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#fff";
      c.lineWidth = 2;
      c.stroke();
    }
    const card = g.ui.card(`<h2>${g.island.name}</h2><img src="${cv.toDataURL()}" style="width:min(80vw,700px);border-radius:18px;image-rendering:pixelated"><p style="margin:8px 0 0;font-size:14px">● 나 · 색 점은 이웃 · <kbd>Esc</kbd> 닫기</p>`);
    g.ui.modal++;
    await new Promise<void>((resolve) => {
      const close = (e?: Event) => {
        if (e instanceof KeyboardEvent && !["Escape", "KeyM", "Space", "Enter"].includes(e.code)) return;
        window.removeEventListener("keydown", close, true);
        card.remove();
        g.ui.modal--;
        resolve();
      };
      setTimeout(() => window.addEventListener("keydown", close, true), 80);
      card.addEventListener("click", () => close());
    });
  }

  private async design(): Promise<void> {
    const g = this.g;
    const k = await g.ui.menu("섬 디자인", [
      { label: "흙길 깔기", sub: "Space로 발 앞에 깔아요" },
      { label: "돌길 깔기" },
      { label: "벽돌길 깔기" },
      { label: "나무길 깔기" },
      { label: "길 지우기" },
      { label: "디자인 끝내기" },
    ]);
    if (k < 0) return;
    if (k === 5) {
      this.designing = 0;
      g.ui.toast("섬 디자인을 끝냈다.");
      return;
    }
    this.designing = k === 4 ? -1 : k + 1;
    g.ui.toast(k === 4 ? "길 지우기: Space로 발 앞의 길을 지워요." : `${["흙길", "돌길", "벽돌길", "나무길"][k]}: Space로 발 앞에 깔아요.`);
  }

  private async friends(): Promise<void> {
    const g = this.g;
    await g.ui.menu(
      "이웃",
      g.villagers.list.map((n) => {
        const sp = SPECIES.find((s) => s.id === n.v.species)!;
        const hearts = Math.min(5, Math.floor(n.r.friend / 8));
        return { label: `${n.v.name} (${sp.name} · ${TEMPERS[n.v.temper].name})`, sub: `생일 ${n.v.birthday[0]}월 ${n.v.birthday[1]}일 · 말버릇 "${n.v.catch}" · ${"♥".repeat(hearts)}${"♡".repeat(5 - hearts)}` };
      }),
    );
  }

  async online(): Promise<void> {
    const g = this.g;
    if (g.net) {
      const k = await g.ui.menu(g.net.isHost ? `섬 문 열림 · 코드 ${g.net.code}` : "친구 섬 방문 중", [{ label: g.net.isHost ? "문 닫기 (친구들 돌려보내기)" : "집으로 돌아가기" }, { label: "인사 보내기" }]);
      if (k === 0) g.net.leave();
      if (k === 1) {
        const t = await g.ui.ask("친구들에게 보낼 말", "안녕!", 40);
        if (t) g.net.chat(t);
      }
      return;
    }
    const k = await g.ui.menu("친구와 놀기", [{ label: "우리 섬에 초대하기", sub: "코드를 친구에게 알려 주세요" }, { label: "친구 섬에 놀러 가기", sub: "친구가 알려 준 코드를 입력" }]);
    if (k === 0) await this.hostIsland();
    if (k === 1) await this.visitIsland();
  }

  async hostIsland(): Promise<void> {
    const g = this.g;
    if (g.net) return;
    g.ui.toast("비행 준비 중… 섬 코드를 만드는 중이에요.");
    g.net = Net.host(
      g,
      (code) => {
        g.persist();
        void g.ui.say("물범 선장", [`섬 문을 열었어! 코드는 [ ${code} ] 일세.`, "친구에게 이 코드를 알려 주면 이 섬으로 데려오겠네."], { color: "#3a4a8a" });
      },
      (why) => {
        g.ui.toast(`문을 열지 못했다: ${why}`);
        g.net = null;
      },
    );
    g.net.onStatus = (s) => g.ui.toast(s);
  }

  async visitIsland(): Promise<void> {
    const code = ((await this.g.ui.ask("친구 섬 코드 (5글자)", "예: AB3CD", 5)) ?? "").toUpperCase();
    if (code.length < 4) return;
    this.g.persist();
    const u = new URL(location.href);
    u.searchParams.set("join", code);
    location.href = u.toString();
  }

  private async settings(): Promise<void> {
    const g = this.g;
    const k = await g.ui.menu("설정", [
      { label: `음악 ${Math.round(audio.music * 100)}%`, sub: "누를 때마다 바뀌어요" },
      { label: `효과음 ${Math.round(audio.sfx * 100)}%` },
      { label: "지금 저장하기" },
      { label: "처음부터 다시 하기", sub: "섬과 캐릭터를 모두 지워요" },
    ]);
    if (k === 0) setVolumes(audio.music >= 1 ? 0 : Math.round((audio.music + 0.25) * 100) / 100, audio.sfx);
    if (k === 1) setVolumes(audio.music, audio.sfx >= 1 ? 0 : Math.round((audio.sfx + 0.25) * 100) / 100);
    if (k === 2) {
      g.persist();
      g.ui.toast("저장했다!");
    }
    if (k === 3) {
      const c = await g.ui.say("", ["정말 모든 걸 지우고 새 섬에서 시작할까?"], { choices: ["지우고 새로 시작", "그만두기"] });
      if (c === 0) {
        save.wipe();
        location.reload();
      }
    }
    if (k === 0 || k === 1) await this.settings();
  }

  private async emote(): Promise<void> {
    const g = this.g;
    const list: [string, string][] = [
      ["wave", "손 흔들기"],
      ["joy", "기뻐하기"],
      ["dance", "춤추기"],
      ["bow", "인사하기"],
      ["surprise", "깜짝"],
      ["sad", "시무룩"],
    ];
    const k = await g.ui.menu("몸짓", list.map(([, n]) => ({ label: n })));
    if (k < 0) return;
    g.player.play(list[k][0] as never);
    g.net?.emote(list[k][0]);
  }
}

function placeName(p: string): string {
  return ({ river: "강", pond: "연못", sea: "바다", pier: "부두", mouth: "강어귀", clifftop: "절벽 위 강", fly: "날아다님", flower: "꽃 위", tree: "나무", ground: "땅", water: "물 위", rock: "바위 밑", shake: "나무를 흔들면", light: "불빛 근처", beach: "해변", palm: "야자나무", stump: "그루터기", rain: "비 오는 날 꽃·바위", "night-fly": "밤하늘" } as Record<string, string>)[p] ?? p;
}

export { PATHS };
