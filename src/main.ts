/**
 * Boot: the title, making a character, choosing an island from four generated ones (shown as
 * little maps), or carrying on; `?join=CODE` flies straight to a friend's island.
 */
import { unlock } from "./audio/sound";
import { clock } from "./core/clock";
import { makeVillager, playerLook, SPECIES } from "./data/species";
import { Person } from "./game/player";
import { Game } from "./game/game";
import { save, type IslandSave, type Profile } from "./game/save";
import { Net } from "./net/net";
import { Stage } from "./render/stage";
import { World } from "./game/world";
import { setNight } from "./render/buildings";
import { generate, H, idx, K, W } from "./world/island";
import { freshState } from "./world/state";
import "./style.css";

const q = new URLSearchParams(location.search);
const stage = new Stage(document.getElementById("c") as HTMLCanvasElement);
const ui = document.getElementById("ui")!;

declare global {
  interface Window {
    __g: Record<string, unknown>;
  }
}
window.__g = { ready: false, stage };

function newProfile(name: string, o: Partial<Profile>): Profile {
  return {
    v: 1,
    name,
    skin: o.skin ?? 0xf8d8c0,
    hair: o.hair ?? "short",
    hairColor: o.hairColor ?? 0x4a3020,
    eyes: o.eyes ?? "round",
    outfit: { top: "top:tee:4", bottom: "bottom:shorts:5", hat: null },
    pockets: {
      slots: [{ id: "shovel", n: 1, wear: 60 }, { id: "axe", n: 1, wear: 60 }, { id: "net", n: 1, wear: 60 }, { id: "rod", n: 1, wear: 60 }, { id: "can", n: 1, wear: 60 }, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      money: 1000,
      storage: [],
    },
    recipes: [],
    caught: [],
    power: 0,
    home: { items: [{ id: "furn:bed:0", x: 0, z: 0, rot: 0 }, { id: "furn:table-lamp:0", x: 2, z: 0, rot: 0 }, { id: "furn:radio:1", x: 5, z: 0, rot: 0 }], wall: 0, floor: 0, size: 6 },
    held: -1,
    bank: 0,
    created: Date.now(),
    days: 0,
    lastDay: clock.day(),
  };
}

function newIsland(seed: number): IslandSave {
  const I = generate(seed);
  return { v: 1, seed, name: I.name, state: freshState(I), residents: [], museum: [], camper: null, created: Date.now() };
}

function mapImage(seed: number, S = 3): string {
  const I = generate(seed);
  const cv = document.createElement("canvas");
  cv.width = W * S;
  cv.height = H * S;
  const c = cv.getContext("2d")!;
  for (let z = 0; z < H; z++)
    for (let x = 0; x < W; x++) {
      const i = idx(x, z);
      const k = I.kind[i];
      c.fillStyle = k === K.Sea ? "#6ac0e8" : k === K.Sand ? "#f4e4b8" : k === K.River || k === K.Pond ? "#8ad8f4" : k === K.Rock ? "#a8a8a8" : k === K.Pier ? "#b08a60" : ["#a4dc7a", "#84c860", "#66b04c"][I.tier[i]];
      c.fillRect(x * S, z * S, S, S);
    }
  for (const p of I.plots) {
    c.fillStyle = { house: "#e8806a", home: "#4a8ad8", shop: "#6ab070", museum: "#9a8ab8", office: "#f8c84a", camp: "#f8a040", dock: "#8a5a3a" }[p.kind];
    c.fillRect(p.x * S, p.z * S, p.w * S, p.d * S);
  }
  return cv.toDataURL();
}

/** A drifting fly-over of a sample island behind the title and creation screens. */
let demo: { world: World; raf: number } | null = null;
function demoIsland(): void {
  if (demo) return;
  const world = new World(stage, 3 + Math.floor(Math.random() * 50));
  world.build([]);
  world.tickDay();
  const o = world.plot("office")!;
  let t = 0;
  let last = performance.now();
  const loop = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    const h = clock.hour();
    stage.setHour(h);
    setNight(stage.night.value);
    stage.zoom = 1.5;
    stage.focus.set(o.x + 3 + Math.sin(t * 0.05) * 18, 0.5, o.z + 2 + Math.cos(t * 0.04) * 10);
    stage.updateCamera(dt);
    world.view.update();
    world.terrain.update(stage.time.value);
    stage.render(dt);
    if (demo) demo.raf = requestAnimationFrame(loop);
  };
  demo = { world, raf: requestAnimationFrame(loop) };
}

function start(profile: Profile, island: IslandSave, guest = false): Game {
  if (demo) {
    cancelAnimationFrame(demo.raf);
    stage.scene.remove(demo.world.group);
    demo = null;
  }
  stage.zoom = 1;
  ui.innerHTML = "";
  const g = new Game(stage, profile, island, { guest });
  window.__g = { ready: true, game: g, stage, lib: { Person, makeVillager, playerLook, SPECIES } };
  let last = performance.now();
  const frame = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    g.update(dt);
    stage.render(dt);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  window.addEventListener("beforeunload", () => g.persist());
  return g;
}

/** The title screen behind a slowly drifting view of a sample island. */
function title(): void {
  demoIsland();
  const prof = save.profile();
  const isl = save.island();
  ui.innerHTML = `<div class="title">
      <div class="logo"><b>하루섬</b><span>나만의 섬에서 보내는 하루</span></div>
      <div class="menu-col">
        ${prof && isl ? `<button class="big" id="bCont">이어서 하기 <small>${isl.name} · ${prof.name}</small></button>` : ""}
        <button class="big" id="bNew">${prof ? "새로 시작하기" : "시작하기"}</button>
        <button class="big" id="bJoin">친구 섬에 놀러 가기</button>
      </div>
      <p class="credit">모든 그림·음악·캐릭터는 코드로 만들었어요 · WASD/방향키 이동 · Space 행동 · E 줍기 · Q 도구 · Tab 가방 · P 섬폰</p>
    </div>`;
  document.getElementById("bCont")?.addEventListener("click", () => {
    unlock();
    start(prof!, isl!);
  });
  document.getElementById("bNew")!.addEventListener("click", () => {
    unlock();
    makeCharacter();
  });
  document.getElementById("bJoin")!.addEventListener("click", () => {
    unlock();
    const box = document.createElement("div");
    box.className = "panel menu ask";
    box.innerHTML = `<h2>친구 섬 코드 (5글자)</h2><input maxlength="5" placeholder="예: AB3CD"><div class="foot"><button class="pill ok">날아가기</button></div>`;
    ui.appendChild(box);
    const inp = box.querySelector("input") as HTMLInputElement;
    inp.focus();
    const go = () => inp.value.trim() && void join(inp.value.trim().toUpperCase());
    inp.addEventListener("keydown", (e) => e.code === "Enter" && go());
    (box.querySelector(".ok") as HTMLElement).onclick = go;
  });
  window.__g = { ready: true, stage, title: true, go: () => makeCharacter() };
}

const SKINS = [0xf8d8c0, 0xf0c8a0, 0xd8a078, 0xa87050, 0x7a4a30];
const HAIRS: [string, string][] = [
  ["short", "짧은 머리"],
  ["bob", "단발"],
  ["pony", "포니테일"],
  ["bun", "올림머리"],
  ["long", "긴 머리"],
  ["spiky", "삐죽 머리"],
  ["curly", "곱슬머리"],
];
const HAIR_COLORS = [0x4a3020, 0x2a2020, 0xc89050, 0xe8c070, 0xc84a3a, 0x6a8ae8, 0xf0a0c0, 0xe8e8e8];

function makeCharacter(): void {
  let skin = 0;
  let hair = 0;
  let hc = 0;
  const draw = () => {
    ui.innerHTML = `<div class="title create">
      <div class="panel form">
        <h2>나는 누구일까?</h2>
        <label>이름<input id="nm" maxlength="8" placeholder="이름을 지어 주세요" value="${(document.getElementById("nm") as HTMLInputElement | null)?.value ?? ""}"></label>
        <label>피부<div class="row">${SKINS.map((c, k) => `<button class="sw ${k === skin ? "on" : ""}" data-skin="${k}" style="background:#${c.toString(16)}"></button>`).join("")}</div></label>
        <label>머리 모양<div class="row">${HAIRS.map(([, n], k) => `<button class="chip ${k === hair ? "on" : ""}" data-hair="${k}">${n}</button>`).join("")}</div></label>
        <label>머리 색<div class="row">${HAIR_COLORS.map((c, k) => `<button class="sw ${k === hc ? "on" : ""}" data-hc="${k}" style="background:#${c.toString(16).padStart(6, "0")}"></button>`).join("")}</div></label>
        <button class="big" id="bNext">이대로 좋아요!</button>
      </div></div>`;
    for (const b of ui.querySelectorAll<HTMLElement>("[data-skin]")) b.onclick = () => ((skin = +b.dataset.skin!), draw());
    for (const b of ui.querySelectorAll<HTMLElement>("[data-hair]")) b.onclick = () => ((hair = +b.dataset.hair!), draw());
    for (const b of ui.querySelectorAll<HTMLElement>("[data-hc]")) b.onclick = () => ((hc = +b.dataset.hc!), draw());
    document.getElementById("bNext")!.onclick = () => {
      const name = ((document.getElementById("nm") as HTMLInputElement).value.trim() || "하루").slice(0, 8);
      pickIsland(newProfile(name, { skin: SKINS[skin], hair: HAIRS[hair][0], hairColor: HAIR_COLORS[hc] }));
    };
  };
  draw();
  window.__g = { ready: true, stage, create: true, next: (name = "하루") => pickIsland(newProfile(name, {})) };
}

function pickIsland(profile: Profile): void {
  const base = Math.floor(Math.random() * 1e6);
  const seeds = q.get("seed") ? [+q.get("seed")!] : [base, base + 1, base + 2, base + 3];
  ui.innerHTML = `<div class="title create"><div class="panel pick"><h2>어느 섬에서 살까?</h2><div class="maps">${seeds
    .map((s, k) => `<button class="map" data-k="${k}"><img src="${mapImage(s)}"><b>${generate(s).name}</b></button>`)
    .join("")}</div><p>파란 점선은 부두, 노란 곳은 섬 사무소예요. 하나를 골라 주세요.</p></div></div>`;
  for (const b of ui.querySelectorAll<HTMLElement>("[data-k]"))
    b.onclick = () => {
      const isl = newIsland(seeds[+b.dataset.k!]);
      save.putProfile(profile);
      save.putIsland(isl);
      const g = start(profile, isl);
      void g.ui.say("카피", [`${profile.name} 님, ${isl.name}에 오신 걸 환영해요~`, "여기 섬에서는 시간도 계절도 진짜 시계를 따라 흘러요.", "삽, 도끼, 잠자리채, 낚싯대, 물뿌리개를 챙겨 드렸어요. Q로 바꿔 들고 Space로 써 보세요.", "이웃들한테 인사도 하고, 박물관이랑 잡화점에도 들러 보세요~ 느긋하게요."], { color: "#5ab8e8", pitch: 0.7 });
    };
  window.__g = { ready: true, stage, pick: (k = 0) => (ui.querySelectorAll<HTMLElement>("[data-k]")[k] as HTMLElement).click() };
}

async function join(code: string): Promise<void> {
  const prof = save.profile() ?? newProfile("손님", {});
  ui.innerHTML = `<div class="title"><div class="logo"><b>✈️</b><span>${code} 섬으로 날아가는 중…</span></div></div>`;
  try {
    const g0 = { profile: prof };
    const look = playerLook({ skin: g0.profile.skin, hair: g0.profile.hair as never, hairColor: g0.profile.hairColor });
    const { welcome, session } = await Net.join(code, prof, look);
    clock.offset = welcome.offset;
    const g = start(prof, welcome.island, true);
    g.net = new Net(g, false, null, session, code);
    g.villagers.puppetMode = true;
    g.ui.toast(`${welcome.hostName}의 섬 ${welcome.island.name}에 도착했다!`);
  } catch (e) {
    ui.innerHTML = `<div class="title"><div class="logo"><b>😢</b><span>${(e as Error).message}</span></div><div class="menu-col"><button class="big" onclick="location.href=location.pathname">돌아가기</button></div></div>`;
  }
}

if (q.get("join")) void join(q.get("join")!);
else if (q.has("quick")) {
  // Tests and demos: skip the title with a fresh or saved game.
  const prof = save.profile() ?? newProfile(q.get("name") ?? "하루", {});
  let isl = save.island();
  if (!isl || q.has("fresh") || (q.get("seed") && isl.seed !== +q.get("seed")!)) isl = newIsland(+(q.get("seed") ?? 7));
  start(prof, isl);
} else title();
