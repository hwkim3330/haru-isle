/**
 * Neighbours: sixteen animal kinds, eight temperaments, and a generator that rolls a whole
 * character from a seed — name, catchphrase, colours, face, clothes, hobby, favourite colour,
 * birthday, house colours. Every villager is new; none is a copy of anybody's.
 */
import { rng } from "../core/noise";
import type { Ears, Look, Pattern, Snout, Tail } from "../char/body";
import type { EyeStyle, Mouth } from "../char/face";

export interface Species {
  id: string;
  name: string;
  ears: Ears;
  snout: Snout;
  tail: Tail;
  head: [number, number, number];
  /** [fur, fur2 (muzzle, belly, inner ear), nose]. */
  furs: [number, number, number][];
  mouth: Mouth;
  eyes: EyeStyle[];
  mark?: "whisker" | "mask" | "freckle";
  syll: string[];
}

export const SPECIES: Species[] = [
  { id: "cat", name: "고양이", ears: "cat", snout: "flat", tail: "cat", head: [1.05, 0.95, 1], furs: [[0xf0c890, 0xfff4e0, 0xe89090], [0x8a8a92, 0xe8e8ec, 0xe08a9a], [0x3a3a40, 0x8a8a90, 0xe07a8a], [0xf8f4f0, 0xffe8e0, 0xf0a0b0], [0xe89a50, 0xfff0d8, 0xd87a70]], mouth: "cat", eyes: ["round", "narrow", "sparkle", "dot"], mark: "whisker", syll: ["냥", "야옹", "미유", "냐"] },
  { id: "dog", name: "강아지", ears: "dog", snout: "small", tail: "curl", head: [1.05, 0.95, 1], furs: [[0xe8c890, 0xa87a4a, 0x3a2a2a], [0xf8f4ec, 0xc8a878, 0x3a2a2a], [0x9a6a3a, 0xf0dcc0, 0x2a1a1a], [0x4a3a30, 0xd8b890, 0x1a1a1a]], mouth: "smile", eyes: ["button", "round", "dot"], syll: ["멍", "왈", "뭉", "킁"] },
  { id: "rabbit", name: "토끼", ears: "rabbit", snout: "flat", tail: "bunny", head: [1, 1, 0.98], furs: [[0xf8f4f0, 0xf8c8d0, 0xf090a0], [0xd8c0a8, 0xfff0e0, 0xe890a0], [0xa8a8b8, 0xf0f0f8, 0xe890a0], [0xf8d8e8, 0xffffff, 0xf07a9a]], mouth: "tiny", eyes: ["sparkle", "lash", "round"], syll: ["깡총", "토", "뿅", "퐁"] },
  { id: "bear", name: "곰", ears: "bear", snout: "wide", tail: "stub", head: [1.08, 0.95, 1], furs: [[0x9a6a42, 0xe8c8a0, 0x3a2a22], [0x5a4034, 0xc8a07a, 0x2a1a18], [0xe8dcc8, 0xfff8ec, 0x4a3a30], [0x3a3a3a, 0xe8e8e8, 0x1a1a1a]], mouth: "smile", eyes: ["dot", "button", "narrow"], syll: ["곰", "우웅", "쿵", "뭉실"] },
  { id: "frog", name: "개구리", ears: "frog", snout: "none", tail: "none", head: [1.15, 0.85, 1], furs: [[0x7ac84a, 0xe8f4b0, 0x4a8a3a], [0x4ab0a0, 0xd8f4e8, 0x2a7a6a], [0xe8c040, 0xfff4c0, 0xa08020]], mouth: "grin", eyes: ["dot", "wide"], syll: ["개굴", "폴짝", "꾸르", "첨벙"] },
  { id: "duck", name: "오리", ears: "duck", snout: "bill", tail: "duck", head: [1, 1, 1], furs: [[0xf8f4e8, 0xffffff, 0xf8a030], [0xf8d850, 0xfff4c0, 0xf88a30], [0x8a9aa8, 0xe8ecf0, 0xe8a040]], mouth: "none", eyes: ["dot", "button", "sparkle"], syll: ["꽥", "뒤뚱", "꽉", "퐁당"] },
  { id: "deer", name: "사슴", ears: "deer", snout: "small", tail: "stub", head: [0.98, 1.02, 1], furs: [[0xc8905a, 0xf8e8d0, 0x3a2a2a], [0xa87a50, 0xf0dcc0, 0x2a2020], [0xe8c8a0, 0xfff8ec, 0x5a4a40]], mouth: "tiny", eyes: ["lash", "round", "sparkle"], syll: ["사뿐", "살랑", "록", "뿔"] },
  { id: "squirrel", name: "다람쥐", ears: "squirrel", snout: "flat", tail: "squirrel", head: [1.02, 0.98, 1], furs: [[0xd8904a, 0xfff0d8, 0x5a3a2a], [0xa89080, 0xf8f0e8, 0x4a3a3a], [0xe8b870, 0xfff8e8, 0x6a4a3a]], mouth: "tiny", eyes: ["sparkle", "round", "button"], syll: ["도토", "쪼르", "다람", "톡"] },
  { id: "mouse", name: "생쥐", ears: "mouse", snout: "small", tail: "long", head: [1, 0.95, 1], furs: [[0xb8b8c0, 0xf8e0e8, 0xf090a0], [0xe8dcc8, 0xfff0f0, 0xf08a9a], [0x8a7a70, 0xe8d8d0, 0xe07a8a]], mouth: "tiny", eyes: ["button", "round", "dot"], syll: ["찍", "쪼", "치즈", "쪽"] },
  { id: "pig", name: "돼지", ears: "pig", snout: "pig", tail: "curl", head: [1.08, 0.95, 1], furs: [[0xf8b8c0, 0xffd8e0, 0xf090a0], [0xe8c8a8, 0xfff0e0, 0xd8a090], [0x6a5a5a, 0xa89090, 0xc88a8a]], mouth: "smile", eyes: ["dot", "button", "narrow"], syll: ["꿀", "꿀꿀", "뽀", "통통"] },
  { id: "sheep", name: "양", ears: "sheep", snout: "flat", tail: "stub", head: [1, 1, 1], furs: [[0xf0e8e0, 0xfffcf8, 0x6a5a5a], [0x4a4448, 0xf0ece8, 0x2a2a2a], [0xe8d8e8, 0xfff8ff, 0x8a6a7a]], mouth: "tiny", eyes: ["sleepy", "dot", "lash"], syll: ["메에", "뭉게", "보송", "몽"] },
  { id: "penguin", name: "펭귄", ears: "penguin", snout: "beak", tail: "flat", head: [1.02, 1, 1], furs: [[0x2a3a58, 0xf8f8f8, 0xf8a030], [0x4a5a7a, 0xf8f8f8, 0xf8c040], [0x6a7a8a, 0xf0f4f8, 0xe89030]], mouth: "none", eyes: ["dot", "sparkle"], syll: ["뒤뚱", "펭", "퐁", "끼룩"] },
  { id: "koala", name: "코알라", ears: "koala", snout: "flat", tail: "none", head: [1.08, 0.95, 1], furs: [[0x9a9aa0, 0xe8e8ec, 0x2a2a30], [0xb8a898, 0xf0e8e0, 0x3a3030]], mouth: "flat", eyes: ["sleepy", "dot", "narrow"], syll: ["느릿", "코", "쿨", "음냐"] },
  { id: "hamster", name: "햄스터", ears: "hamster", snout: "flat", tail: "stub", head: [1.12, 0.9, 1], furs: [[0xf0c890, 0xfff8ec, 0xf090a0], [0xe8e0d8, 0xffffff, 0xf08a9a], [0xc8a080, 0xf8ece0, 0xe08a8a]], mouth: "cat", eyes: ["button", "sparkle"], syll: ["쪼물", "뽀짝", "해씨", "볼볼"] },
  { id: "fox", name: "여우", ears: "fox", snout: "long", tail: "fluffy", head: [1, 1, 1], furs: [[0xe8803a, 0xfff4e8, 0x2a1a1a], [0xf0e8e0, 0xffffff, 0x3a2a2a], [0xa8a0a8, 0xf0f0f4, 0x2a2a2a]], mouth: "cat", eyes: ["narrow", "lash", "round"], syll: ["콩콩", "여", "살금", "캥"] },
  { id: "otter", name: "수달", ears: "otter", snout: "small", tail: "long", head: [1.05, 0.95, 1], furs: [[0x8a6a4a, 0xe8d8c0, 0x2a1a1a], [0xa8906a, 0xf8ecd8, 0x3a2a20]], mouth: "smile", eyes: ["button", "dot"], syll: ["첨벙", "달달", "뽀글", "수"] },
];

export type Temper = "easy" | "sporty" | "grumpy" | "kind" | "peppy" | "prim" | "dreamy" | "sis";

export const TEMPERS: Record<Temper, { name: string; polite: boolean; wake: number; sleep: number; speed: number }> = {
  easy: { name: "느긋", polite: false, wake: 8, sleep: 23, speed: 0.85 },
  sporty: { name: "씩씩", polite: false, wake: 6.5, sleep: 22.5, speed: 1.25 },
  grumpy: { name: "무뚝뚝", polite: false, wake: 9, sleep: 1.5, speed: 0.8 },
  kind: { name: "상냥", polite: true, wake: 6, sleep: 22, speed: 1 },
  peppy: { name: "발랄", polite: false, wake: 7, sleep: 24, speed: 1.2 },
  prim: { name: "새침", polite: true, wake: 9, sleep: 2, speed: 0.9 },
  dreamy: { name: "몽상", polite: true, wake: 10, sleep: 3, speed: 0.8 },
  sis: { name: "털털", polite: false, wake: 7, sleep: 23.5, speed: 1.1 },
};

export type Hobby = "fishing" | "bugs" | "music" | "fitness" | "nature" | "fashion" | "reading" | "play";
export const HOBBIES: Record<Hobby, string> = { fishing: "낚시", bugs: "곤충", music: "음악", fitness: "운동", nature: "자연", fashion: "패션", reading: "독서", play: "놀이" };

export type Style = "cute" | "cool" | "elegant" | "natural" | "sporty" | "simple";
export const STYLES: Record<Style, string> = { cute: "귀여운", cool: "멋진", elegant: "우아한", natural: "자연스러운", sporty: "활동적인", simple: "심플한" };
export const COLOR_PREFS = ["빨강", "주황", "노랑", "초록", "파랑", "보라", "분홍", "하양", "검정", "갈색", "알록달록"];

export interface Villager {
  id: string;
  seed: number;
  name: string;
  species: string;
  temper: Temper;
  catch: string;
  hobby: Hobby;
  style: Style;
  favColor: string;
  birthday: [number, number];
  look: Look;
  house: { wall: number; roof: number; door: number; style: number };
}

const S1 = ["모", "보", "도", "초", "솔", "누", "라", "미", "하", "코", "피", "루", "나", "유", "토", "키", "마", "쿠", "소", "채", "봄", "달", "콩", "밤", "떡", "몽", "뽀", "호", "치", "두", "리", "시", "포", "구", "제", "로", "비", "아", "다", "새"];
const S2 = ["리", "치", "코", "미", "롱", "이", "냥", "보", "키", "루", "나", "니", "쿠", "둥", "방", "실", "울", "랑", "링", "찌", "몽", "비", "단", "솜", "알", "쁘", "토", "순", "율", "별"];
const TAIL3 = ["이", "냥", "뭉", "콩", "링", "둥"];

function hsl(h: number, s: number, l: number): number {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return (Math.round(f(0) * 255) << 16) | (Math.round(f(8) * 255) << 8) | Math.round(f(4) * 255);
}

export function makeVillager(seed: number, taken: Set<string> = new Set(), speciesPick?: string): Villager {
  const R = rng(seed * 2654435761 + 97);
  const pick = <T>(a: T[]): T => a[Math.floor(R() * a.length)];
  let sp = speciesPick ? SPECIES.find((s) => s.id === speciesPick)! : pick(SPECIES);
  for (let k = 0; k < 8 && !speciesPick && taken.has(sp.id); k++) sp = pick(SPECIES);
  const [fur, fur2, nose] = pick(sp.furs);
  const temper = pick(Object.keys(TEMPERS) as Temper[]);
  let name = pick(S1) + pick(S2);
  if (R() < 0.25) name += pick(TAIL3);
  const catchphrase = R() < 0.6 ? pick(sp.syll) + (R() < 0.5 ? "" : pick(sp.syll).slice(0, 1)) : pick(["뿌잉", "퐁퐁", "샤랄라", "우후", "히힛", "야호", "흠냐", "빠밤", "쿨쿨", "와우", "룰루", "헤헷", "짜잔", "음음", "오홍"]);
  const h = R();
  const pastel = temper === "kind" || temper === "peppy" || temper === "dreamy";
  const shirt = hsl(h, pastel ? 0.55 : 0.5, pastel ? 0.72 : 0.55);
  const shirt2 = hsl((h + 0.08 + R() * 0.4) % 1, 0.5, R() < 0.5 ? 0.9 : 0.4);
  const patterns: Pattern[] = ["plain", "plain", "stripe", "two", "dot"];
  const eyes = pick(sp.eyes);
  const polite = TEMPERS[temper].polite;
  const face = {
    eyes,
    eyeColor: pick([0x3a2a1a, 0x2a4a8a, 0x3a7a4a, 0x7a3a2a, 0x5a3a7a, 0x2a2a2a]),
    mouth: sp.mouth,
    blush: temper === "grumpy" || R() < 0.3 ? null : pick([0xff8aa0, 0xff9a8a, 0xf8a0c0]),
    brows: temper === "grumpy" || temper === "sporty" ? 0x3a2a2a : null,
    mark: sp.mark ?? (R() < 0.15 ? "freckle" : null),
    markColor: sp.id === "cat" ? 0x6a5a5a : undefined,
    spread: 0.36 + R() * 0.14,
    eyeY: 0.46 + R() * 0.06,
    mouthY: sp.snout === "flat" || sp.snout === "none" ? 0.74 : 0.8,
  } as Look["face"];
  const look: Look = {
    kind: "animal",
    fur,
    fur2,
    ears: sp.ears,
    snout: sp.snout,
    nose,
    tail: sp.tail,
    headScale: sp.head,
    shirt,
    shirt2,
    pattern: pick(patterns),
    pants: fur,
    shoes: fur2 === 0xffffff ? fur : fur2,
    hat: R() < 0.12 ? pick(["cap", "beanie", "bow", "straw"] as const) : null,
    hatColor: hsl(R(), 0.6, 0.55),
    face,
    size: sp.id === "bear" ? 1.1 : sp.id === "hamster" || sp.id === "mouse" ? 0.92 : 1,
  };
  void polite;
  return {
    id: `v${seed}`,
    seed,
    name,
    species: sp.id,
    temper,
    catch: catchphrase,
    hobby: pick(Object.keys(HOBBIES) as Hobby[]),
    style: pick(Object.keys(STYLES) as Style[]),
    favColor: pick(COLOR_PREFS),
    birthday: [1 + Math.floor(R() * 12), 1 + Math.floor(R() * 28)],
    look,
    house: { wall: hsl(R(), 0.35, 0.82), roof: hsl(R(), 0.55, 0.5), door: hsl(R(), 0.4, 0.4), style: Math.floor(R() * 3) },
  };
}

/** The player: a person with hair and clothes. */
export function playerLook(o: { skin?: number; hair?: Look["hair"]; hairColor?: number; shirt?: number; pants?: number; eyes?: EyeStyle } = {}): Look {
  const skin = o.skin ?? 0xf8d8c0;
  return {
    kind: "human",
    fur: skin,
    fur2: skin,
    ears: "human",
    snout: "none",
    nose: skin,
    tail: "none",
    headScale: [1, 1, 1],
    shirt: o.shirt ?? 0x5ab0e8,
    shirt2: 0xffffff,
    pattern: "plain",
    pants: o.pants ?? 0x3a5a8a,
    shoes: 0xf8f4f0,
    hair: o.hair ?? "short",
    hairColor: o.hairColor ?? 0x4a3020,
    face: { eyes: o.eyes ?? "round", eyeColor: 0x3a2a1a, mouth: "smile", blush: 0xff9aa0, brows: null, spread: 0.4, eyeY: 0.5, mouthY: 0.74 },
  };
}
