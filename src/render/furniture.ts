/**
 * Furniture: sixty-odd pieces, each a little function of two colours, sold and crafted in
 * several colourways. Sizes are in tiles; models face +z (toward whoever placed them).
 */
import * as THREE from "three";
import { at, ball, box, cone, cyl, lathe, merge, petal, rbox, type Part } from "./geo";

export type FurnCat = "seat" | "table" | "bed" | "storage" | "light" | "decor" | "music" | "outdoor" | "kitchen" | "plant" | "toy";
export type Use = "sit" | "lie" | "light" | "music" | "open" | "tv" | null;

export interface FurnDef {
  id: string;
  name: string;
  cat: FurnCat;
  size: [number, number];
  price: number;
  use: Use;
  /** Colourways: [name, main, accent]. */
  colors: [string, number, number][];
  build: (a: number, b: number) => Part[];
  /** Crafting materials, if it can be made at the bench. */
  recipe?: [string, number][];
}

const WOODS: [string, number, number][] = [
  ["원목", 0xc89a6a, 0x8a6a4a],
  ["호두", 0x7a5034, 0x4a3020],
  ["하양", 0xf4f0e8, 0xc8b8a0],
  ["파스텔", 0xa8d8e8, 0xf8f4f0],
];
const BRIGHT: [string, number, number][] = [
  ["빨강", 0xe8504a, 0xf8f0e8],
  ["노랑", 0xf8d050, 0xf8f0e8],
  ["초록", 0x6ac070, 0xf8f0e8],
  ["파랑", 0x5a9ae8, 0xf8f0e8],
  ["분홍", 0xf8a0c0, 0xf8f0e8],
];
const METAL: [string, number, number][] = [
  ["은색", 0xc8ccd4, 0x6a6e78],
  ["검정", 0x3a3a40, 0xa8a8b0],
  ["금색", 0xe8c050, 0x8a6a2a],
];
const FABRIC: [string, number, number][] = [
  ["베이지", 0xe8d8c0, 0xa8886a],
  ["남색", 0x3a4a7a, 0xc8a878],
  ["자주", 0xa04a6a, 0xe8d0a0],
  ["민트", 0x9ad8c0, 0xf8f4ec],
  ["회색", 0x9a9aa0, 0x5a5a60],
];

const leg4 = (w: number, d: number, h: number, c: number, r = 0.03): Part[] =>
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].map(([x, z]) => at(cyl(r, r * 0.8, h, c, 6), [x * (w / 2 - r * 1.5), h / 2, z * (d / 2 - r * 1.5)]));

export const FURNITURE: FurnDef[] = [
  // ---------------------------------------------------------------- seats
  { id: "chair", name: "나무 의자", cat: "seat", size: [1, 1], price: 1200, use: "sit", colors: WOODS, recipe: [["wood", 4]], build: (a, b) => [...leg4(0.5, 0.5, 0.42, b), at(rbox(0.52, 0.06, 0.52, 0.02, a), [0, 0.45, 0]), at(rbox(0.52, 0.5, 0.06, 0.02, a), [0, 0.72, -0.23])] },
  { id: "stool", name: "둥근 스툴", cat: "seat", size: [1, 1], price: 800, use: "sit", colors: WOODS, recipe: [["wood", 3]], build: (a, b) => [at(cyl(0.22, 0.22, 0.07, a, 16), [0, 0.42, 0]), ...[0, 1, 2].map((k) => at(cyl(0.025, 0.03, 0.42, b, 6), [Math.cos(k * 2.1) * 0.15, 0.21, Math.sin(k * 2.1) * 0.15]))] },
  { id: "sofa", name: "푹신 소파", cat: "seat", size: [2, 1], price: 5800, use: "sit", colors: FABRIC, build: (a, b) => [at(rbox(1.8, 0.35, 0.8, 0.1, a), [0, 0.3, 0]), at(rbox(1.8, 0.5, 0.22, 0.1, a), [0, 0.65, -0.3]), at(rbox(0.22, 0.45, 0.8, 0.1, a), [-0.85, 0.5, 0]), at(rbox(0.22, 0.45, 0.8, 0.1, a), [0.85, 0.5, 0]), ...leg4(1.7, 0.7, 0.12, b, 0.04)] },
  { id: "armchair", name: "안락의자", cat: "seat", size: [1, 1], price: 3600, use: "sit", colors: FABRIC, build: (a, b) => [at(rbox(0.85, 0.3, 0.8, 0.1, a), [0, 0.28, 0]), at(rbox(0.85, 0.55, 0.2, 0.1, a), [0, 0.62, -0.3]), at(rbox(0.18, 0.4, 0.8, 0.08, a), [-0.38, 0.45, 0]), at(rbox(0.18, 0.4, 0.8, 0.08, a), [0.38, 0.45, 0]), ...leg4(0.75, 0.7, 0.12, b, 0.03)] },
  { id: "bench", name: "공원 벤치", cat: "outdoor", size: [2, 1], price: 3200, use: "sit", colors: WOODS, recipe: [["wood", 6], ["iron", 2]], build: (a, b) => [...[0, 1, 2].map((k) => at(box(1.8, 0.05, 0.14, a), [0, 0.42, -0.2 + k * 0.17])), ...[0, 1].map((k) => at(box(1.8, 0.12, 0.04, a), [0, 0.65 + k * 0.16, -0.3])), ...[-0.75, 0.75].map((x) => at(box(0.06, 0.42, 0.5, 0x3a3a40), [x, 0.21, -0.05])), ...[-0.75, 0.75].map((x) => at(box(0.05, 0.5, 0.05, 0x3a3a40), [x, 0.6, -0.3])), at(box(0.01, 0.01, 0.01, b), [0, 0, 0])] },
  { id: "rocker", name: "흔들의자", cat: "seat", size: [1, 1], price: 4200, use: "sit", colors: WOODS, recipe: [["wood", 6], ["softwood", 2]], build: (a, b) => [at(rbox(0.55, 0.06, 0.55, 0.02, a), [0, 0.42, 0]), at(rbox(0.55, 0.65, 0.05, 0.02, a), [0, 0.78, -0.25], [-0.15, 0, 0]), ...[-0.25, 0.25].map((x) => at(new THREE.TorusGeometry(0.6, 0.025, 4, 16, 1.2).rotateY(Math.PI / 2).toNonIndexed(), [x, 0.62, 0], [0, 0, 0])).map((g) => colorPart(g, b)), ...leg4(0.5, 0.5, 0.4, b, 0.025)] },
  { id: "cushion", name: "방석", cat: "seat", size: [1, 1], price: 600, use: "sit", colors: BRIGHT, build: (a, b) => [at(rbox(0.6, 0.12, 0.6, 0.05, a), [0, 0.06, 0]), at(ball(0.03, b, 6, 4), [0, 0.12, 0])] },
  { id: "beach-chair", name: "해변 의자", cat: "outdoor", size: [1, 2], price: 2200, use: "lie", colors: BRIGHT, build: (a, b) => [at(box(0.6, 0.04, 1.1, a), [0, 0.3, 0.1], [-0.12, 0, 0]), at(box(0.6, 0.04, 0.7, a), [0, 0.55, -0.55], [0.9, 0, 0]), ...leg4(0.55, 1.2, 0.28, b, 0.02)] },
  // ---------------------------------------------------------------- tables
  { id: "table", name: "나무 테이블", cat: "table", size: [2, 1], price: 3000, use: null, colors: WOODS, recipe: [["wood", 8]], build: (a, b) => [at(rbox(1.8, 0.08, 0.9, 0.03, a), [0, 0.72, 0]), ...leg4(1.6, 0.8, 0.7, b, 0.04)] },
  { id: "round-table", name: "원형 탁자", cat: "table", size: [1, 1], price: 2000, use: null, colors: WOODS, recipe: [["wood", 5]], build: (a, b) => [at(cyl(0.45, 0.45, 0.06, a, 20), [0, 0.7, 0]), at(cyl(0.05, 0.06, 0.68, b, 8), [0, 0.35, 0]), at(cyl(0.25, 0.28, 0.04, b, 16), [0, 0.02, 0])] },
  { id: "low-table", name: "좌식 상", cat: "table", size: [2, 1], price: 2400, use: null, colors: WOODS, recipe: [["hardwood", 5]], build: (a, b) => [at(rbox(1.5, 0.06, 0.8, 0.02, a), [0, 0.33, 0]), ...leg4(1.4, 0.7, 0.3, b, 0.04)] },
  { id: "desk", name: "책상", cat: "table", size: [2, 1], price: 4200, use: null, colors: WOODS, recipe: [["wood", 8], ["iron", 1]], build: (a, b) => [at(box(1.6, 0.06, 0.7, a), [0, 0.74, 0]), at(box(0.5, 0.7, 0.66, a), [0.52, 0.36, 0]), ...[0, 1, 2].map((k) => at(box(0.44, 0.18, 0.02, b), [0.52, 0.15 + k * 0.22, 0.34])), ...[-0.72].map((x) => at(box(0.06, 0.72, 0.66, a), [x, 0.36, 0]))] },
  { id: "counter", name: "카운터", cat: "kitchen", size: [2, 1], price: 5000, use: null, colors: WOODS, build: (a, b) => [at(box(1.9, 0.9, 0.7, a), [0, 0.45, 0]), at(box(2.0, 0.06, 0.8, b), [0, 0.93, 0])] },
  { id: "tea-set", name: "다과상", cat: "table", size: [1, 1], price: 2600, use: null, colors: WOODS, build: (a, b) => [at(rbox(0.8, 0.06, 0.6, 0.02, a), [0, 0.3, 0]), ...leg4(0.7, 0.5, 0.28, b), at(lathe([[0.001, 0], [0.07, 0.01], [0.08, 0.08], [0.04, 0.12], [0.001, 0.12]], 0xf8f4f0, 10), [-0.15, 0.33, 0]), ...[0.1, 0.25].map((x) => at(cyl(0.04, 0.03, 0.05, 0xf8f4f0, 8), [x, 0.35, 0.05]))] },
  // ---------------------------------------------------------------- beds
  { id: "bed", name: "나무 침대", cat: "bed", size: [2, 2], price: 7800, use: "lie", colors: FABRIC, recipe: [["wood", 12], ["softwood", 4]], build: (a, b) => [at(box(1.1, 0.3, 1.9, 0xc89a6a), [0, 0.15, 0]), at(rbox(1.0, 0.18, 1.8, 0.06, 0xf8f4f0), [0, 0.38, 0]), at(rbox(1.02, 0.1, 1.2, 0.05, a), [0, 0.46, 0.3]), at(rbox(0.7, 0.12, 0.35, 0.06, 0xffffff), [0, 0.5, -0.65]), at(box(1.1, 0.7, 0.08, 0xc89a6a), [0, 0.35, -0.95]), at(box(0.02, 0.02, 0.02, b), [0, 0, 0])] },
  { id: "bunk", name: "이층 침대", cat: "bed", size: [2, 2], price: 9800, use: "lie", colors: WOODS, build: (a, b) => [...[0.4, 1.3].flatMap((y) => [at(box(1.0, 0.1, 1.9, a), [0, y, 0]), at(rbox(0.95, 0.12, 1.8, 0.05, b), [0, y + 0.1, 0])]), ...leg4(1.0, 1.9, 1.8, a, 0.05)] },
  { id: "futon", name: "이부자리", cat: "bed", size: [1, 2], price: 3000, use: "lie", colors: BRIGHT, build: (a, b) => [at(rbox(0.9, 0.1, 1.8, 0.04, b), [0, 0.05, 0]), at(rbox(0.92, 0.08, 1.2, 0.04, a), [0, 0.13, 0.25]), at(rbox(0.6, 0.1, 0.3, 0.05, 0xffffff), [0, 0.14, -0.65])] },
  { id: "hammock", name: "해먹", cat: "outdoor", size: [2, 1], price: 4000, use: "lie", colors: BRIGHT, build: (a, b) => [at(ball(0.9, a, 16, 6), [0, 0.7, 0], [0, 0, 0], [1, 0.2, 0.4]), ...[-1, 1].map((s) => at(cyl(0.05, 0.06, 1.4, 0x8a6a4a, 6), [s * 0.95, 0.7, 0])), at(box(0.01, 0.01, 0.01, b), [0, 0, 0])] },
  // ---------------------------------------------------------------- storage
  { id: "dresser", name: "서랍장", cat: "storage", size: [1, 1], price: 3800, use: "open", colors: WOODS, recipe: [["wood", 8]], build: (a, b) => [at(rbox(0.85, 0.9, 0.5, 0.03, a), [0, 0.45, 0]), ...[0, 1, 2].map((k) => at(box(0.75, 0.22, 0.02, b), [0, 0.18 + k * 0.28, 0.25])), ...[0, 1, 2].map((k) => at(ball(0.025, 0xe8c050, 6, 4), [0, 0.18 + k * 0.28, 0.27]))] },
  { id: "wardrobe", name: "옷장", cat: "storage", size: [1, 1], price: 6200, use: "open", colors: WOODS, recipe: [["wood", 10], ["iron", 1]], build: (a, b) => [at(rbox(0.9, 1.7, 0.55, 0.03, a), [0, 0.85, 0]), at(box(0.02, 1.5, 0.02, b), [0, 0.9, 0.28]), ...[-0.08, 0.08].map((x) => at(ball(0.025, 0xe8c050, 6, 4), [x, 0.95, 0.29]))] },
  { id: "bookshelf", name: "책장", cat: "storage", size: [1, 1], price: 4800, use: null, colors: WOODS, recipe: [["wood", 8]], build: (a) => [at(box(0.9, 1.5, 0.35, a), [0, 0.75, -0.02]), ...[0, 1, 2, 3].flatMap((k) => [at(box(0.84, 0.03, 0.34, 0x5a3a2a), [0, 0.1 + k * 0.36, 0.01]), ...[0, 1, 2, 3, 4, 5].map((j) => at(box(0.1, 0.28, 0.24, [0xe84a4a, 0x4a8ae8, 0xf8d050, 0x6ac070, 0x9a5ad0, 0xf8f4f0][(j + k) % 6]), [-0.33 + j * 0.13, 0.26 + k * 0.36, 0.04]))]).slice(0, 26)] },
  { id: "shelf", name: "벽 선반", cat: "storage", size: [1, 1], price: 1800, use: null, colors: WOODS, recipe: [["wood", 4]], build: (a, b) => [at(box(0.9, 0.04, 0.3, a), [0, 1.0, -0.3]), at(box(0.9, 0.04, 0.3, a), [0, 1.4, -0.3]), at(ball(0.07, b, 8, 6), [-0.2, 1.1, -0.3]), at(cyl(0.05, 0.05, 0.15, 0x6ac070, 8), [0.2, 1.1, -0.3])] },
  { id: "chest", name: "보물 상자", cat: "storage", size: [1, 1], price: 3400, use: "open", colors: WOODS, recipe: [["hardwood", 6], ["iron", 2]], build: (a) => [at(rbox(0.8, 0.45, 0.55, 0.03, a), [0, 0.23, 0]), at(cyl(0.28, 0.28, 0.8, a, 12, 0), [0, 0.45, 0], [0, 0, Math.PI / 2], [1, 1, 1]), ...[-0.3, 0.3].map((x) => at(box(0.05, 0.55, 0.57, 0xc8a050), [x, 0.35, 0])), at(box(0.1, 0.12, 0.04, 0xe8c050), [0, 0.42, 0.29])] },
  { id: "crate", name: "나무 궤짝", cat: "storage", size: [1, 1], price: 900, use: null, colors: WOODS, recipe: [["wood", 3]], build: (a, b) => [at(box(0.7, 0.55, 0.7, a), [0, 0.28, 0]), ...[-1, 1].map((s) => at(box(0.72, 0.06, 0.72, b), [0, 0.28 + s * 0.2, 0]))] },
  { id: "barrel", name: "나무통", cat: "storage", size: [1, 1], price: 1500, use: null, colors: WOODS, recipe: [["wood", 4], ["iron", 1]], build: (a) => [at(lathe([[0.001, 0], [0.28, 0], [0.33, 0.35], [0.28, 0.7], [0.001, 0.7]], a, 14), [0, 0, 0]), ...[0.12, 0.58].map((y) => at(cyl(0.31, 0.31, 0.04, 0x5a5a60, 14), [0, y, 0]))] },
  { id: "jar", name: "장독", cat: "outdoor", size: [1, 1], price: 1800, use: null, colors: [["흙빛", 0x7a4a2a, 0x3a2a1a], ["검정", 0x3a2a24, 0x1a1a1a]], recipe: [["clay", 5]], build: (a, b) => [at(lathe([[0.001, 0], [0.2, 0], [0.34, 0.3], [0.26, 0.6], [0.2, 0.62], [0.001, 0.62]], a, 16), [0, 0, 0]), at(cyl(0.23, 0.25, 0.08, b, 16), [0, 0.64, 0]), at(ball(0.04, b, 6, 4), [0, 0.7, 0])] },
  // ---------------------------------------------------------------- lights
  { id: "floor-lamp", name: "스탠드", cat: "light", size: [1, 1], price: 2400, use: "light", colors: FABRIC, recipe: [["iron", 2], ["wood", 2]], build: (a, b) => [at(cyl(0.18, 0.2, 0.04, b, 12), [0, 0.02, 0]), at(cyl(0.02, 0.02, 1.3, b, 6), [0, 0.67, 0]), at(lathe([[0.1, 0], [0.22, 0], [0.12, 0.3], [0.1, 0.3]], a, 14), [0, 1.2, 0])] },
  { id: "table-lamp", name: "탁상 램프", cat: "light", size: [1, 1], price: 1600, use: "light", colors: FABRIC, build: (a, b) => [at(ball(0.13, b, 12, 8), [0, 0.13, 0], [0, 0, 0], [1, 1.1, 1]), at(lathe([[0.08, 0], [0.18, 0], [0.1, 0.22], [0.08, 0.22]], a, 14), [0, 0.28, 0])] },
  { id: "lantern", name: "종이 등", cat: "light", size: [1, 1], price: 1400, use: "light", colors: [["주홍", 0xf87a4a, 0x3a2a1a], ["하양", 0xf8f0e0, 0x3a2a1a], ["노랑", 0xf8d870, 0x3a2a1a]], build: (a, b) => [at(ball(0.25, a, 14, 10), [0, 0.7, 0], [0, 0, 0], [1, 1.25, 1]), ...[-1, 1].map((s) => at(cyl(0.12, 0.12, 0.05, b, 12), [0, 0.7 + s * 0.3, 0])), at(cyl(0.02, 0.02, 0.4, b, 4), [0, 0.2, 0])] },
  { id: "street-lamp", name: "가로등", cat: "outdoor", size: [1, 1], price: 5000, use: "light", colors: METAL, recipe: [["iron", 5]], build: (a, b) => [at(cyl(0.15, 0.2, 0.2, a, 10), [0, 0.1, 0]), at(cyl(0.05, 0.06, 2.2, a, 8), [0, 1.2, 0]), at(lathe([[0.001, 0], [0.18, 0.05], [0.14, 0.4], [0.2, 0.42], [0.001, 0.55]], b, 8), [0, 2.25, 0]), at(ball(0.12, 0xfff4c0, 8, 6), [0, 2.4, 0])] },
  { id: "stone-lantern", name: "석등", cat: "outdoor", size: [1, 1], price: 4400, use: "light", colors: [["화강암", 0xa8a8a8, 0x6a6a6a]], recipe: [["stone", 8]], build: (a, b) => [at(cyl(0.3, 0.35, 0.15, a, 6), [0, 0.08, 0]), at(cyl(0.1, 0.12, 0.6, a, 6), [0, 0.45, 0]), at(box(0.45, 0.35, 0.45, a), [0, 0.92, 0]), at(box(0.3, 0.22, 0.46, 0xfff0b0), [0, 0.92, 0]), at(cone(0.45, 0.3, b, 6), [0, 1.25, 0])] },
  { id: "candles", name: "촛대", cat: "light", size: [1, 1], price: 1200, use: "light", colors: METAL, build: (a) => [at(cyl(0.12, 0.14, 0.03, a, 12), [0, 0.02, 0]), at(cyl(0.02, 0.02, 0.35, a, 6), [0, 0.2, 0]), ...[-0.12, 0, 0.12].map((x) => at(cyl(0.03, 0.03, 0.15, 0xfff8e8, 8), [x, 0.45, 0])), ...[-0.12, 0, 0.12].map((x) => at(cone(0.02, 0.05, 0xffa030, 5), [x, 0.55, 0]))] },
  { id: "campfire", name: "모닥불", cat: "outdoor", size: [1, 1], price: 1200, use: "light", colors: [["장작", 0x8a5a3a, 0x8a8a8a]], recipe: [["branch", 3], ["stone", 3]], build: (a, b) => [...[0, 1, 2, 3, 4, 5, 6].map((k) => at(ball(0.1, b, 6, 4), [Math.cos(k * 0.9) * 0.3, 0.06, Math.sin(k * 0.9) * 0.3])), ...[0, 1, 2].map((k) => at(cyl(0.04, 0.05, 0.5, a, 5), [0, 0.12, 0], [0.6, k * 2.1, 0])), at(cone(0.15, 0.4, 0xffa030, 6), [0, 0.3, 0]), at(cone(0.08, 0.25, 0xfff080, 6), [0, 0.28, 0])] },
  // ---------------------------------------------------------------- decor
  { id: "potted", name: "화분", cat: "plant", size: [1, 1], price: 1000, use: null, colors: [["테라코타", 0xc8704a, 0x5aa040], ["하양", 0xf4f0e8, 0x4a9a3a], ["파랑", 0x5a8ac8, 0x6ab048]], recipe: [["clay", 2], ["weed", 3]], build: (a, b) => [at(lathe([[0.001, 0], [0.14, 0], [0.19, 0.3], [0.2, 0.32], [0.001, 0.32]], a, 12), [0, 0, 0]), ...[0, 1, 2, 3, 4].map((k) => at(petal(0.35, 0.09, b, 0.4), [0, 0.3, 0], [-1.0 + (k % 2) * 0.3, k * 1.25, 0]))] },
  { id: "big-plant", name: "큰 화분", cat: "plant", size: [1, 1], price: 2800, use: null, colors: [["몬스테라", 0xe8e0d0, 0x3a9a4a], ["야자", 0xc8a878, 0x5ab04a]], build: (a, b) => [at(cyl(0.22, 0.17, 0.4, a, 12), [0, 0.2, 0]), at(cyl(0.02, 0.03, 0.7, 0x5a7a3a, 5), [0, 0.7, 0]), ...[0, 1, 2, 3, 4, 5, 6].map((k) => at(petal(0.45, 0.16, b, 0.3), [0, 0.6 + (k % 3) * 0.2, 0], [-0.6 - (k % 2) * 0.4, k * 0.9, 0]))] },
  { id: "bonsai", name: "분재", cat: "plant", size: [1, 1], price: 3600, use: null, colors: [["소나무", 0x3a4a5a, 0x3a8a4a]], recipe: [["clay", 2], ["hardwood", 1]], build: (a, b) => [at(rbox(0.5, 0.12, 0.3, 0.02, a), [0, 0.06, 0]), at(cyl(0.03, 0.05, 0.3, 0x7a5034, 5), [0, 0.25, 0], [0, 0, 0.4]), at(ball(0.14, b, 8, 6), [0.1, 0.4, 0], [0, 0, 0], [1.5, 0.6, 1]), at(ball(0.1, b, 8, 6), [-0.1, 0.32, 0], [0, 0, 0], [1.4, 0.6, 1])] },
  { id: "vase", name: "꽃병", cat: "decor", size: [1, 1], price: 1300, use: null, colors: BRIGHT, build: (a, b) => [at(lathe([[0.001, 0], [0.1, 0], [0.14, 0.15], [0.06, 0.32], [0.08, 0.36], [0.001, 0.36]], a, 14), [0, 0, 0]), ...[0, 1, 2].map((k) => at(ball(0.06, [0xf8a0c0, 0xf8f4f0, 0xf8d050][k], 8, 6), [Math.cos(k * 2.1) * 0.06, 0.48, Math.sin(k * 2.1) * 0.06])), at(box(0.01, 0.01, 0.01, b), [0, 0, 0])] },
  { id: "mirror", name: "전신 거울", cat: "decor", size: [1, 1], price: 3000, use: null, colors: WOODS, build: (a) => [at(rbox(0.6, 1.5, 0.06, 0.03, a), [0, 0.85, 0]), at(box(0.5, 1.35, 0.07, 0xc8e0f0), [0, 0.87, 0.005]), at(box(0.5, 0.05, 0.4, a), [0, 0.03, 0])] },
  { id: "wall-clock", name: "괘종시계", cat: "decor", size: [1, 1], price: 5600, use: null, colors: WOODS, recipe: [["hardwood", 6], ["iron", 2], ["gold", 1]], build: (a, b) => [at(rbox(0.5, 1.8, 0.35, 0.04, a), [0, 0.9, 0]), at(cyl(0.18, 0.18, 0.04, 0xf8f4ec, 16), [0, 1.45, 0.18], [Math.PI / 2, 0, 0]), at(box(0.02, 0.12, 0.02, 0x2a2a2a), [0, 1.5, 0.21]), at(cyl(0.08, 0.08, 0.02, 0xe8c050, 12), [0, 0.7, 0.18], [Math.PI / 2, 0, 0]), at(box(0.01, 0.01, 0.01, b), [0, 0, 0])] },
  { id: "frame", name: "그림 액자", cat: "decor", size: [1, 1], price: 2000, use: null, colors: [["풍경", 0x6ab0e8, 0xc8a050], ["꽃", 0xf8a0c0, 0x8a6a4a], ["바다", 0x3a7ac8, 0xf4f0e8]], build: (a, b) => [at(box(0.7, 0.55, 0.05, b), [0, 1.2, -0.4]), at(box(0.58, 0.43, 0.06, a), [0, 1.2, -0.4]), at(ball(0.08, 0xfff4c0, 8, 6), [0.15, 1.3, -0.36], [0, 0, 0], [1, 1, 0.2]), at(box(0.3, 0.02, 0.4, 0x6a4a2a), [0, 0.01, -0.3])] },
  { id: "teddy", name: "곰 인형", cat: "toy", size: [1, 1], price: 2200, use: null, colors: [["갈색", 0xb07a4a, 0xf0dcc0], ["분홍", 0xf8b0c8, 0xfff0f4], ["하양", 0xf8f4f0, 0xf0c8c0]], build: (a, b) => [at(ball(0.2, a, 12, 8), [0, 0.2, 0]), at(ball(0.16, a, 12, 8), [0, 0.5, 0.02]), ...[-1, 1].map((s) => at(ball(0.06, a, 8, 6), [s * 0.12, 0.64, 0])), at(ball(0.07, b, 8, 6), [0, 0.46, 0.14], [0, 0, 0], [1, 0.8, 0.6]), ...[-1, 1].map((s) => at(ball(0.07, a, 8, 6), [s * 0.18, 0.08, 0.1]))] },
  { id: "globe", name: "지구본", cat: "decor", size: [1, 1], price: 2600, use: null, colors: METAL, build: (a) => [at(cyl(0.12, 0.15, 0.04, a, 12), [0, 0.02, 0]), at(cyl(0.02, 0.02, 0.4, a, 6), [0, 0.22, 0]), at(ball(0.2, 0x4a8ae8, 16, 12), [0, 0.55, 0]), ...[0, 1, 2].map((k) => at(ball(0.08, 0x6ac070, 8, 6), [Math.cos(k * 2) * 0.14, 0.55 + (k - 1) * 0.08, Math.sin(k * 2) * 0.14], [0, 0, 0], [1, 0.7, 0.4]))] },
  { id: "aquarium", name: "어항", cat: "decor", size: [1, 1], price: 4000, use: null, colors: WOODS, build: (a) => [at(box(0.8, 0.5, 0.45, a), [0, 0.25, 0]), at(box(0.78, 0.45, 0.43, 0x7ac8e8), [0, 0.75, 0]), at(ball(0.05, 0xf8903a, 6, 4), [0.1, 0.8, 0.1], [0, 0, 0], [1.4, 0.8, 0.5]), at(ball(0.04, 0x5a9ae8, 6, 4), [-0.15, 0.7, 0], [0, 0, 0], [1.4, 0.8, 0.5])] },
  { id: "rug", name: "둥근 러그", cat: "decor", size: [2, 2], price: 2400, use: null, colors: FABRIC, build: (a, b) => [at(cyl(0.95, 0.95, 0.02, a, 24), [0, 0.01, 0]), at(cyl(0.7, 0.7, 0.022, b, 24), [0, 0.012, 0]), at(cyl(0.45, 0.45, 0.024, a, 24), [0, 0.013, 0])] },
  { id: "screen", name: "병풍", cat: "decor", size: [2, 1], price: 5200, use: null, colors: [["산수", 0xf4ecd8, 0x6a8a6a], ["매화", 0xf8f0e0, 0xd84a6a]], build: (a, b) => [...[0, 1, 2, 3].map((k) => at(box(0.45, 1.3, 0.04, a), [-0.7 + k * 0.46, 0.65, -0.2 + (k % 2) * 0.1], [0, (k % 2 ? 0.3 : -0.3), 0])), ...[0, 1, 2, 3].map((k) => at(ball(0.1, b, 8, 6), [-0.7 + k * 0.46, 0.8, -0.17 + (k % 2) * 0.1], [0, 0, 0], [1, 0.6, 0.2]))] },
  { id: "tv", name: "텔레비전", cat: "decor", size: [1, 1], price: 7000, use: "tv", colors: METAL, build: (a) => [at(rbox(0.9, 0.6, 0.3, 0.04, a), [0, 0.8, 0]), at(box(0.8, 0.48, 0.02, 0x2a3a4a), [0, 0.8, 0.15]), at(box(0.8, 0.5, 0.4, 0x8a6a4a), [0, 0.25, 0])] },
  { id: "radio", name: "라디오", cat: "music", size: [1, 1], price: 1800, use: "music", colors: BRIGHT, build: (a, b) => [at(rbox(0.5, 0.3, 0.2, 0.04, a), [0, 0.15, 0]), at(cyl(0.08, 0.08, 0.02, b, 12), [-0.12, 0.15, 0.1], [Math.PI / 2, 0, 0]), at(box(0.12, 0.08, 0.02, b), [0.12, 0.18, 0.1]), at(cyl(0.008, 0.008, 0.4, 0xc8c8c8, 4), [0.2, 0.45, -0.05], [0, 0, -0.3])] },
  { id: "piano", name: "피아노", cat: "music", size: [2, 1], price: 12000, use: "music", colors: [["검정", 0x2a2a2e, 0xf8f8f8], ["하양", 0xf4f0ec, 0x2a2a2e]], build: (a, b) => [at(box(1.5, 1.1, 0.5, a), [0, 0.6, -0.1]), at(box(1.4, 0.06, 0.25, b), [0, 0.8, 0.25]), ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => at(box(0.05, 0.02, 0.15, a), [-0.6 + k * 0.13, 0.84, 0.22])), ...leg4(1.4, 0.5, 0.3, a, 0.04)] },
  { id: "guitar", name: "통기타", cat: "music", size: [1, 1], price: 3800, use: "music", colors: WOODS, build: (a, b) => [at(ball(0.2, a, 12, 8), [0, 0.3, 0], [0, 0, 0], [1, 1.2, 0.35]), at(ball(0.15, a, 12, 8), [0, 0.6, 0], [0, 0, 0], [1, 1, 0.35]), at(cyl(0.05, 0.05, 0.02, 0x2a2a2a, 10), [0, 0.45, 0.07], [Math.PI / 2, 0, 0]), at(box(0.07, 0.6, 0.04, b), [0, 1.0, 0])] },
  { id: "drum", name: "북", cat: "music", size: [1, 1], price: 3000, use: "music", colors: BRIGHT, build: (a, b) => [at(cyl(0.3, 0.3, 0.45, a, 16), [0, 0.35, 0]), ...[-1, 1].map((s) => at(cyl(0.31, 0.31, 0.03, b, 16), [0, 0.35 + s * 0.23, 0])), ...leg4(0.4, 0.4, 0.15, 0x5a3a2a)] },
  { id: "music-box", name: "오르골", cat: "music", size: [1, 1], price: 2400, use: "music", colors: WOODS, build: (a, b) => [at(rbox(0.35, 0.2, 0.25, 0.03, a), [0, 0.1, 0]), at(box(0.35, 0.02, 0.25, b), [0, 0.3, -0.1], [-0.9, 0, 0]), at(ball(0.04, 0xf8a0c0, 8, 6), [0, 0.25, 0.02])] },
  // ---------------------------------------------------------------- kitchen
  { id: "fridge", name: "냉장고", cat: "kitchen", size: [1, 1], price: 7400, use: "open", colors: [["하양", 0xf4f4f0, 0xa8a8b0], ["민트", 0xa8e0d0, 0xf4f4f0], ["빨강", 0xe85a4a, 0xf4f4f0]], build: (a, b) => [at(rbox(0.75, 1.6, 0.65, 0.08, a), [0, 0.8, 0]), at(box(0.72, 0.02, 0.02, b), [0, 1.1, 0.33]), ...[0.6, 1.35].map((y) => at(box(0.04, 0.25, 0.04, b), [0.28, y, 0.34]))] },
  { id: "stove", name: "가스레인지", cat: "kitchen", size: [1, 1], price: 5400, use: null, colors: METAL, build: (a, b) => [at(box(0.85, 0.85, 0.65, a), [0, 0.43, 0]), ...[-0.2, 0.2].flatMap((x) => [-0.15, 0.15].map((z) => at(cyl(0.1, 0.1, 0.02, b, 12), [x, 0.87, z]))), at(box(0.7, 0.35, 0.02, 0x2a2a30), [0, 0.35, 0.33])] },
  { id: "sink", name: "싱크대", cat: "kitchen", size: [1, 1], price: 4000, use: null, colors: WOODS, build: (a) => [at(box(0.85, 0.85, 0.65, a), [0, 0.43, 0]), at(box(0.55, 0.05, 0.4, 0xc8ccd4), [0, 0.86, 0]), at(cyl(0.02, 0.02, 0.3, 0xc8ccd4, 6), [0, 1.0, -0.22])] },
  // ---------------------------------------------------------------- outdoor & toys
  { id: "fence", name: "나무 울타리", cat: "outdoor", size: [1, 1], price: 400, use: null, colors: WOODS, recipe: [["wood", 2]], build: (a) => [...[-0.35, 0.35].map((x) => at(box(0.1, 0.8, 0.1, a), [x, 0.4, 0])), ...[0.3, 0.6].map((y) => at(box(1.0, 0.08, 0.05, a), [0, y, 0]))] },
  { id: "mailbox", name: "우편함", cat: "outdoor", size: [1, 1], price: 1600, use: null, colors: BRIGHT, build: (a, b) => [at(cyl(0.04, 0.04, 0.8, 0x8a6a4a, 6), [0, 0.4, 0]), at(rbox(0.3, 0.25, 0.4, 0.06, a), [0, 0.9, 0]), at(box(0.02, 0.15, 0.08, b), [0.16, 1.0, 0])] },
  { id: "sign", name: "나무 푯말", cat: "outdoor", size: [1, 1], price: 800, use: null, colors: WOODS, recipe: [["wood", 3]], build: (a, b) => [at(cyl(0.04, 0.05, 1.0, b, 6), [0, 0.5, 0]), at(rbox(0.7, 0.35, 0.05, 0.02, a), [0, 0.9, 0.03])] },
  { id: "parasol", name: "파라솔", cat: "outdoor", size: [1, 1], price: 2800, use: null, colors: BRIGHT, build: (a, b) => [at(cyl(0.02, 0.02, 1.8, 0xf8f8f8, 6), [0, 0.9, 0]), ...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => at(cone(0.25, 0.9, k % 2 ? a : b, 3), [Math.cos((k / 8) * Math.PI * 2) * 0.35, 1.72, Math.sin((k / 8) * Math.PI * 2) * 0.35], [Math.PI / 2 - 0.35, -(k / 8) * Math.PI * 2 - Math.PI / 2, 0], [1, 1, 0.15])), at(cyl(0.2, 0.25, 0.06, 0xa8a8a8, 10), [0, 0.03, 0])] },
  { id: "swing", name: "그네", cat: "toy", size: [2, 1], price: 5000, use: "sit", colors: BRIGHT, recipe: [["wood", 8], ["iron", 3]], build: (a, b) => [...[-0.9, 0.9].flatMap((x) => [at(cyl(0.05, 0.05, 1.9, a, 6), [x, 0.9, -0.3], [0.25, 0, 0]), at(cyl(0.05, 0.05, 1.9, a, 6), [x, 0.9, 0.3], [-0.25, 0, 0])]), at(cyl(0.05, 0.05, 1.9, a, 6), [0, 1.8, 0], [0, 0, Math.PI / 2]), ...[-0.25, 0.25].map((x) => at(cyl(0.01, 0.01, 1.3, 0x8a8a8a, 4), [x, 1.15, 0])), at(box(0.6, 0.05, 0.25, b), [0, 0.48, 0])] },
  { id: "slide", name: "미끄럼틀", cat: "toy", size: [2, 1], price: 5800, use: null, colors: BRIGHT, build: (a, b) => [at(box(0.6, 0.05, 1.5, a), [0.3, 0.6, 0], [0, 0, 0], [1, 1, 1]), at(box(0.5, 1.2, 0.5, b), [-0.6, 0.6, 0]), at(box(0.6, 0.05, 1.4, a), [0.35, 0.55, 0], [0, Math.PI / 2, -0.6])] },
  { id: "fountain", name: "분수대", cat: "outdoor", size: [2, 2], price: 15000, use: null, colors: [["대리석", 0xe8e4dc, 0x7ac8e8]], recipe: [["stone", 20], ["iron", 5]], build: (a, b) => [at(cyl(0.95, 1.0, 0.35, a, 20), [0, 0.18, 0]), at(cyl(0.85, 0.85, 0.3, b, 20), [0, 0.2, 0]), at(cyl(0.12, 0.15, 0.9, a, 10), [0, 0.6, 0]), at(cyl(0.4, 0.3, 0.12, a, 16), [0, 1.0, 0]), at(cone(0.25, 0.5, 0xd8f0ff, 8), [0, 1.3, 0])] },
  { id: "well", name: "우물", cat: "outdoor", size: [1, 1], price: 6000, use: null, colors: [["돌", 0x9a9aa0, 0x8a5a3a]], recipe: [["stone", 10], ["wood", 5]], build: (a, b) => [at(cyl(0.45, 0.48, 0.6, a, 12), [0, 0.3, 0]), at(cyl(0.38, 0.38, 0.05, 0x3a6a8a, 12), [0, 0.5, 0]), ...[-0.4, 0.4].map((x) => at(box(0.06, 1.1, 0.06, b), [x, 0.9, 0])), at(cone(0.6, 0.4, b, 4), [0, 1.55, 0], [0, Math.PI / 4, 0], [1, 1, 0.8])] },
  { id: "woodpile", name: "장작더미", cat: "outdoor", size: [1, 1], price: 1200, use: null, colors: WOODS, recipe: [["wood", 5]], build: (a, b) => [...[0, 1, 2, 3, 4, 5].map((k) => at(cyl(0.09, 0.09, 0.8, k % 2 ? a : b, 8), [-0.22 + (k % 3) * 0.2, 0.1 + Math.floor(k / 3) * 0.17, 0], [0, 0, Math.PI / 2], [1, 1, 1]).rotateY(Math.PI / 2))] },
  { id: "cart", name: "손수레", cat: "outdoor", size: [2, 1], price: 3600, use: null, colors: WOODS, recipe: [["wood", 8], ["iron", 2]], build: (a, b) => [at(box(1.1, 0.35, 0.7, a), [0, 0.5, 0]), ...[-1, 1].map((s) => at(cyl(0.28, 0.28, 0.06, b, 14), [0, 0.3, s * 0.4], [Math.PI / 2, 0, 0])), at(cyl(0.03, 0.03, 0.8, b, 5), [0.9, 0.55, 0], [0, 0, 1.2])] },
  { id: "scarecrow", name: "허수아비", cat: "outdoor", size: [1, 1], price: 1800, use: null, colors: [["밀짚", 0xe8cc80, 0x6a8ae8]], recipe: [["wood", 3], ["weed", 10]], build: (a, b) => [at(cyl(0.04, 0.04, 1.6, 0x8a6a4a, 6), [0, 0.8, 0]), at(cyl(0.03, 0.03, 1.1, 0x8a6a4a, 6), [0, 1.2, 0], [0, 0, Math.PI / 2]), at(rbox(0.5, 0.45, 0.25, 0.08, b), [0, 1.05, 0]), at(ball(0.2, 0xf4ecd0, 10, 8), [0, 1.55, 0]), at(cyl(0.35, 0.35, 0.02, a, 14), [0, 1.7, 0]), at(cyl(0.17, 0.2, 0.15, a, 12), [0, 1.78, 0])] },
  { id: "snowman", name: "눈사람", cat: "outdoor", size: [1, 1], price: 2000, use: null, colors: [["하양", 0xf8fcff, 0xe84a4a]], build: (a, b) => [at(ball(0.35, a, 14, 10), [0, 0.32, 0]), at(ball(0.25, a, 14, 10), [0, 0.82, 0]), at(cone(0.04, 0.15, 0xf8903a, 6), [0, 0.84, 0.3], [Math.PI / 2, 0, 0]), at(torus2(0.2, 0.05, b), [0, 0.64, 0])] },
  { id: "tent", name: "캠핑 텐트", cat: "outdoor", size: [2, 2], price: 8000, use: "lie", colors: BRIGHT, build: (a, b) => [at(cone(1.0, 1.4, a, 4), [0, 0.7, 0], [0, Math.PI / 4, 0]), at(cone(0.3, 0.7, b, 4), [0, 0.35, 0.6], [0, Math.PI / 4, 0], [1, 1, 0.3])] },
  { id: "stone-tower", name: "돌탑", cat: "outdoor", size: [1, 1], price: 900, use: null, colors: [["돌", 0xa8a8a8, 0x8a8a90]], recipe: [["stone", 5]], build: (a, b) => [0, 1, 2, 3, 4].map((k) => at(ball(0.26 - k * 0.04, k % 2 ? a : b, 10, 6), [Math.sin(k) * 0.03, 0.12 + k * 0.17, 0], [0, 0, 0], [1, 0.55, 1])) },
  { id: "wind-chime", name: "풍경", cat: "outdoor", size: [1, 1], price: 1500, use: null, colors: METAL, build: (a) => [at(cyl(0.03, 0.03, 1.6, 0x8a6a4a, 5), [0, 0.8, 0]), at(box(0.5, 0.03, 0.03, 0x8a6a4a), [0.2, 1.6, 0]), at(lathe([[0.001, 0.2], [0.1, 0.15], [0.12, 0], [0.001, 0]], a, 10), [0.4, 1.3, 0]), at(box(0.02, 0.15, 0.08, 0xf8f4ec), [0.4, 1.18, 0])] },
  { id: "pool", name: "튜브", cat: "toy", size: [1, 1], price: 1400, use: null, colors: BRIGHT, build: (a, b) => [at(torus2(0.32, 0.12, a), [0, 0.12, 0], [Math.PI / 2, 0, 0]), at(torus2(0.32, 0.121, b), [0, 0.12, 0], [Math.PI / 2, 0, Math.PI / 4], [0.5, 0.5, 1])] },
  { id: "kite", name: "방패연", cat: "toy", size: [1, 1], price: 900, use: null, colors: BRIGHT, build: (a, b) => [at(box(0.6, 0.8, 0.02, a), [0, 1.0, 0]), at(cyl(0.12, 0.12, 0.03, b, 12), [0, 1.05, 0.01], [Math.PI / 2, 0, 0]), at(cyl(0.01, 0.01, 1.0, 0xf8f8f8, 3), [0, 0.3, 0.1], [0.3, 0, 0])] },
  { id: "gyro", name: "소리통", cat: "toy", size: [1, 1], price: 1100, use: "music", colors: [["흙빛", 0xc8804a, 0x3a2a1a], ["푸른빛", 0x5a8ac8, 0x2a2a3a]], build: (a, b) => [at(lathe([[0.001, 0], [0.18, 0.02], [0.2, 0.2], [0.12, 0.45], [0.15, 0.55], [0.001, 0.58]], a, 12), [0, 0, 0]), ...[-1, 1].map((s) => at(ball(0.03, b, 6, 4), [s * 0.07, 0.4, 0.12]))] },
];

function colorPart(g: THREE.BufferGeometry, c: number): Part {
  g.deleteAttribute("uv");
  if (!g.attributes.normal) g.computeVertexNormals();
  const n = g.attributes.position.count;
  const cc = new THREE.Color(c);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([cc.r, cc.g, cc.b], i * 3);
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

function torus2(r: number, t: number, c: number): Part {
  return colorPart(new THREE.TorusGeometry(r, t, 8, 20).toNonIndexed(), c);
}

export const FURN_BY_ID = new Map(FURNITURE.map((f) => [f.id, f]));

/** An item id for a piece in a colourway: "furn:chair:2". */
export function furnItemId(id: string, variant: number): string {
  return `furn:${id}:${variant}`;
}

export function furnGeometry(id: string, variant: number): THREE.BufferGeometry {
  const d = FURN_BY_ID.get(id)!;
  const [, a, b] = d.colors[variant % d.colors.length];
  return merge(d.build(a, b));
}

void cone;
