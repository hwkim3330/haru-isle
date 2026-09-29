/**
 * The catalogue: every item in the game in one table built at load — tools, materials, fruit,
 * fish, bugs, fossils, shells, flowers and seeds, saplings, furniture in every colourway,
 * clothes, wallpaper and floors, recipes, and a few odds and ends. Money is 도토리.
 */
import { BUGS, FISH, type Critter } from "./critters";
import { FURNITURE } from "../render/furniture";
import { COLOR_NAMES } from "../render/nature";
import { FLOWERS, FLOWER_NAMES } from "../world/state";
import type { Flower } from "../world/island";

export type Kind = "tool" | "material" | "fruit" | "fish" | "bug" | "fossil" | "shell" | "flower" | "seed" | "sapling" | "furniture" | "top" | "bottom" | "hat" | "wall" | "floor" | "recipe" | "misc";
export type ToolKind = "shovel" | "axe" | "net" | "rod" | "can" | "slingshot" | "ladder" | "pole";

export interface ItemDef {
  id: string;
  name: string;
  kind: Kind;
  sell: number;
  buy?: number;
  stack: number;
  desc?: string;
  tool?: ToolKind;
  tier?: number;
  uses?: number;
  furn?: { id: string; v: number };
  critter?: Critter;
  flower?: { sp: Flower; col: number };
  cloth?: { style: string; color: number; color2: number };
  color?: number;
  recipe?: [string, number][];
}

export const ITEMS = new Map<string, ItemDef>();
const add = (d: ItemDef) => ITEMS.set(d.id, d);

// ---------------------------------------------------------------- tools
export const TOOL_NAMES: Record<ToolKind, string> = { shovel: "삽", axe: "도끼", net: "잠자리채", rod: "낚싯대", can: "물뿌리개", slingshot: "새총", ladder: "사다리", pole: "장대" };
const TOOL_RECIPES: Record<ToolKind, [string, number][]> = {
  shovel: [["branch", 5]],
  axe: [["branch", 5], ["stone", 1]],
  net: [["branch", 5]],
  rod: [["branch", 5]],
  can: [["softwood", 5]],
  slingshot: [["wood", 5]],
  ladder: [["wood", 4], ["hardwood", 4], ["softwood", 4]],
  pole: [["wood", 5]],
};
for (const [k, n] of Object.entries(TOOL_NAMES) as [ToolKind, string][]) {
  const endless = k === "ladder" || k === "pole";
  add({ id: k, name: n, kind: "tool", tool: k, tier: 1, uses: endless ? 0 : 60, sell: 200, buy: endless ? 1500 : 800, stack: 1, recipe: TOOL_RECIPES[k] });
  if (!endless) add({ id: `gold-${k}`, name: `황금 ${n}`, kind: "tool", tool: k, tier: 2, uses: 240, sell: 1500, stack: 1, recipe: [[k, 1], ["gold", 1]] });
}

// ---------------------------------------------------------------- materials & fruit
const MATS: [string, string, number, string][] = [
  ["wood", "나무", 60, "나무를 도끼로 쳐서 얻은 목재."],
  ["softwood", "부드러운 나무", 60, "가볍고 다루기 쉬운 목재."],
  ["hardwood", "단단한 나무", 60, "튼튼한 가구에 쓰는 목재."],
  ["branch", "나뭇가지", 5, "나무를 흔들면 떨어진다."],
  ["stone", "돌", 75, "바위를 삽으로 치면 나온다."],
  ["clay", "점토", 100, "화분이나 장독을 만들 때."],
  ["iron", "철광석", 375, "단단한 것을 만드는 데 필요."],
  ["gold", "금광석", 10000, "아주 드물게 바위에서 나온다."],
  ["weed", "잡초", 10, "뽑으면 섬이 깔끔해진다."],
  ["shellbit", "조개 조각", 20, "반짝이는 조개 부스러기."],
  ["star", "별 조각", 1000, "유성이 떨어진 다음 날 해변에서."],
];
for (const [id, name, sell, desc] of MATS) add({ id, name, kind: "material", sell, stack: 30, desc });
const FRUIT: [string, string][] = [
  ["apple", "사과"],
  ["orange", "귤"],
  ["pear", "배"],
  ["peach", "복숭아"],
  ["persimmon", "감"],
  ["coconut", "코코넛"],
];
for (const [id, name] of FRUIT) add({ id, name, kind: "fruit", sell: id === "coconut" ? 250 : 100, stack: 10, desc: "먹으면 힘이 솟는다. 심으면 나무가 자란다." });

// ---------------------------------------------------------------- critters
for (const c of FISH) add({ id: `fish:${c.id}`, name: c.name, kind: "fish", sell: c.price, stack: 1, critter: c });
for (const c of BUGS) add({ id: `bug:${c.id}`, name: c.name, kind: "bug", sell: c.price, stack: 1, critter: c });

// ---------------------------------------------------------------- fossils & shells
export const FOSSILS: [string, string, number][] = [
  ["trex-skull", "티라노 머리", 6000],
  ["trex-torso", "티라노 몸통", 5500],
  ["trex-tail", "티라노 꼬리", 5000],
  ["tri-skull", "트리케라톱스 머리", 5500],
  ["tri-torso", "트리케라톱스 몸통", 5000],
  ["stego-skull", "스테고사우루스 머리", 5000],
  ["stego-tail", "스테고사우루스 꼬리", 4500],
  ["ptera-wing", "프테라노돈 날개", 4500],
  ["bronto-skull", "브라키오 머리", 5500],
  ["bronto-neck", "브라키오 목", 5000],
  ["mammoth-skull", "매머드 머리", 3000],
  ["mammoth-torso", "매머드 몸통", 3000],
  ["sabertooth", "검치호 머리", 2500],
  ["ammonite", "암모나이트", 1100],
  ["trilobite", "삼엽충", 1300],
  ["amber", "호박", 1200],
  ["shark-tooth", "상어 이빨", 1000],
  ["dino-egg", "공룡 알", 1500],
  ["dino-track", "공룡 발자국", 1000],
  ["coprolite", "분석", 1100],
  ["archaeo", "시조새", 4000],
  ["plesio-skull", "플레시오사우루스 머리", 4500],
  ["dimetrodon", "디메트로돈 등뼈", 5500],
  ["ankylo-skull", "안킬로사우루스 머리", 5000],
];
for (const [id, name, sell] of FOSSILS) add({ id: `fossil:${id}`, name, kind: "fossil", sell, stack: 1, desc: "박물관에 맡기면 감정해 준다." });
add({ id: "fossil", name: "감정 전 화석", kind: "fossil", sell: 100, stack: 1, desc: "무슨 화석일까? 박물관에 가져가 보자." });
const SHELLS = ["가리비", "소라", "개오지", "모래달러", "산호", "대왕조개"];
SHELLS.forEach((n, k) => add({ id: `shell${k}`, name: n, kind: "shell", sell: [200, 80, 60, 120, 500, 1200][k], stack: 10 }));

// ---------------------------------------------------------------- flowers, seeds, saplings
for (const sp of FLOWERS)
  for (let col = 0; col < 8; col++) {
    const rare = col >= 3;
    add({ id: `flower:${sp}:${col}`, name: `${COLOR_NAMES[col]} ${FLOWER_NAMES[sp]}`, kind: "flower", sell: rare ? 80 : 20, stack: 10, flower: { sp, col } });
  }
for (const sp of FLOWERS) for (const col of [0, 1, 2]) add({ id: `seed:${sp}:${col}`, name: `${COLOR_NAMES[col]} ${FLOWER_NAMES[sp]} 씨앗`, kind: "seed", sell: 60, buy: 240, stack: 10, flower: { sp, col } });
add({ id: "sapling", name: "묘목", kind: "sapling", sell: 160, buy: 640, stack: 10, desc: "빈 땅에 심으면 나무가 자란다." });
add({ id: "cedar-sapling", name: "삼나무 묘목", kind: "sapling", sell: 160, buy: 640, stack: 10 });

// ---------------------------------------------------------------- furniture
for (const f of FURNITURE)
  f.colors.forEach(([cn, main], v) => {
    add({ id: `furn:${f.id}:${v}`, name: f.colors.length > 1 ? `${f.name} (${cn})` : f.name, kind: "furniture", sell: Math.round(f.price / 4), buy: f.price, stack: 1, furn: { id: f.id, v }, color: main, recipe: v === 0 ? f.recipe : undefined });
    if (v === 0 && f.recipe) add({ id: `recipe:${f.id}`, name: `레시피: ${f.name}`, kind: "recipe", sell: 200, buy: 1000, stack: 1, desc: "읽으면 만들 수 있게 된다." });
  });

// ---------------------------------------------------------------- clothes
const PALETTE: [string, number][] = [
  ["빨강", 0xe8504a],
  ["주황", 0xf8903a],
  ["노랑", 0xf8d050],
  ["초록", 0x6ac070],
  ["하늘", 0x7ac8f0],
  ["남색", 0x3a4a8a],
  ["보라", 0x9a6ad0],
  ["분홍", 0xf8a0c0],
  ["하양", 0xf4f4f0],
  ["검정", 0x3a3a40],
];
const TOPS: [string, string, number][] = [
  ["tee", "티셔츠", 580],
  ["stripe", "줄무늬 티", 720],
  ["dot", "물방울 티", 720],
  ["two", "투톤 셔츠", 900],
  ["hood", "후드티", 1400],
];
for (const [st, n, price] of TOPS) PALETTE.forEach(([cn, c], k) => add({ id: `top:${st}:${k}`, name: `${cn} ${n}`, kind: "top", sell: Math.round(price / 4), buy: price, stack: 1, cloth: { style: st, color: c, color2: st === "stripe" || st === "dot" ? 0xffffff : PALETTE[(k + 5) % PALETTE.length][1] } }));
const BOTTOMS: [string, string, number][] = [
  ["shorts", "반바지", 500],
  ["pants", "긴바지", 800],
  ["skirt", "치마", 900],
];
for (const [st, n, price] of BOTTOMS) PALETTE.forEach(([cn, c], k) => add({ id: `bottom:${st}:${k}`, name: `${cn} ${n}`, kind: "bottom", sell: Math.round(price / 4), buy: price, stack: 1, cloth: { style: st, color: c, color2: c } }));
const HATS: [string, string, number][] = [
  ["cap", "야구 모자", 700],
  ["straw", "밀짚모자", 900],
  ["beanie", "털모자", 800],
  ["bow", "리본", 500],
];
for (const [st, n, price] of HATS) PALETTE.forEach(([cn, c], k) => add({ id: `hat:${st}:${k}`, name: `${cn} ${n}`, kind: "hat", sell: Math.round(price / 4), buy: price, stack: 1, cloth: { style: st, color: c, color2: c } }));

// ---------------------------------------------------------------- walls & floors
export const WALLS: [string, number, number, string][] = [
  ["하얀 벽", 0xf4f0e8, 0xe8e0d0, "plain"],
  ["하늘 벽", 0xc8e8f8, 0xb0d8f0, "plain"],
  ["줄무늬 벽", 0xf8e8d0, 0xe8c8a0, "stripe"],
  ["딸기 벽", 0xf8d8e0, 0xf07a90, "dot"],
  ["통나무 벽", 0xc89a6a, 0xa87a4a, "plank"],
  ["벽돌 벽", 0xc8704a, 0xa85a3a, "brick"],
  ["숲 벽", 0xa8d8a0, 0x7ab870, "stripe"],
  ["밤하늘 벽", 0x2a3a6a, 0xf8e8a0, "dot"],
  ["한지 벽", 0xf4ecd8, 0xd8c8a8, "grid"],
  ["민트 벽", 0xb8e8d8, 0x98d8c0, "plain"],
];
export const FLOORS: [string, number, number, string][] = [
  ["나무 바닥", 0xc8a070, 0xb08a5a, "plank"],
  ["하얀 타일", 0xf0f0ec, 0xd8d8d4, "tile"],
  ["체크 바닥", 0xf4f0e8, 0x5a6a8a, "check"],
  ["풀밭 바닥", 0x8ac860, 0x7ab850, "plain"],
  ["장판", 0xe8c880, 0xd8b470, "plain"],
  ["카펫", 0xa04a5a, 0x8a3a4a, "plain"],
  ["대리석", 0xe8e4e0, 0xc8c4c0, "tile"],
  ["모래 바닥", 0xf0e0b8, 0xe0d0a8, "plain"],
  ["다다미", 0xc8c890, 0xa8a870, "grid"],
  ["구름 바닥", 0xd8e8f8, 0xffffff, "dot"],
];
WALLS.forEach(([n, c], k) => add({ id: `wall:${k}`, name: n, kind: "wall", sell: 300, buy: 1200, stack: 1, color: c }));
FLOORS.forEach(([n, c], k) => add({ id: `floor:${k}`, name: n, kind: "floor", sell: 300, buy: 1200, stack: 1, color: c }));

// ---------------------------------------------------------------- odds and ends
add({ id: "acorns", name: "도토리 주머니", kind: "misc", sell: 0, stack: 1, desc: "도토리가 가득. 열면 지갑에 들어간다." });
add({ id: "present", name: "선물 상자", kind: "misc", sell: 0, stack: 1, desc: "무엇이 들었을까?" });
add({ id: "letter", name: "편지", kind: "misc", sell: 0, stack: 1 });
add({ id: "radish", name: "무", kind: "misc", sell: 0, stack: 10, desc: "일요일에 사서 시세가 좋을 때 팔자. 일주일이 지나면 상한다." });
add({ id: "rotten-radish", name: "상한 무", kind: "misc", sell: 0, stack: 10 });
add({ id: "balloon", name: "풍선 선물", kind: "misc", sell: 0, stack: 1 });

export function item(id: string): ItemDef {
  const d = ITEMS.get(id);
  if (!d) throw new Error(`unknown item ${id}`);
  return d;
}

/** Josa helpers: 을/를, 이/가, 은/는, 와/과 by the last syllable. */
export function josa(word: string, pair: "을를" | "이가" | "은는" | "과와" | "으로로"): string {
  const ch = word.charCodeAt(word.length - 1);
  const has = ch >= 0xac00 && ch <= 0xd7a3 ? (ch - 0xac00) % 28 !== 0 : false;
  const rieul = ch >= 0xac00 && ch <= 0xd7a3 && (ch - 0xac00) % 28 === 8;
  if (pair === "으로로") return word + (has && !rieul ? "으로" : "로");
  const [a, b] = [pair[0], pair[1]];
  return word + (has ? a : b);
}

/** Word plus the particle form that fits its last syllable (받침 or not). */
export function pp(word: string, withFinal: string, without: string): string {
  const ch = word.charCodeAt(word.length - 1);
  const has = ch >= 0xac00 && ch <= 0xd7a3 ? (ch - 0xac00) % 28 !== 0 : false;
  return word + (has ? withFinal : without);
}

export const CATALOG_COUNT = () => ITEMS.size;
