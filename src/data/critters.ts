/**
 * Fish and bugs: where they live, which months (northern hemisphere) and hours they're out,
 * how much the shop pays, and for fish the size of the shadow. Real animals, our own numbers.
 */

export type FishPlace = "river" | "pond" | "sea" | "pier" | "mouth" | "clifftop";
export type BugPlace = "fly" | "flower" | "tree" | "ground" | "water" | "rock" | "shake" | "light" | "beach" | "palm" | "stump" | "rain" | "night-fly";

export interface Critter {
  id: string;
  name: string;
  price: number;
  /** Months it appears (1..12). */
  months: number[];
  /** Hour ranges [from, to) it appears; to < from wraps midnight. */
  hours: [number, number][];
  rarity: number; // 1 common … 5 rare
  size?: number; // fish shadow 1..6
  place: FishPlace | BugPlace;
  /** Only when raining. */
  rain?: boolean;
  line: string;
}

const ALL: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const M = (...r: [number, number][]) => {
  const out: number[] = [];
  for (const [a, b] of r) for (let m = a; ; m = (m % 12) + 1) {
    out.push(m);
    if (m === b) break;
  }
  return out;
};
const DAY: [number, number][] = [[0, 24]];
const f = (id: string, name: string, price: number, place: FishPlace, size: number, months: number[], hours: [number, number][], rarity: number, line: string, rain = false): Critter => ({ id, name, price, place, size, months, hours, rarity, line, rain });
const b = (id: string, name: string, price: number, place: BugPlace, months: number[], hours: [number, number][], rarity: number, line: string, rain = false): Critter => ({ id, name, price, place, months, hours, rarity, line, rain });

export const FISH: Critter[] = [
  f("crucian", "붕어", 160, "river", 2, ALL, DAY, 1, "붕어를 낚았다! 어디서나 반가운 얼굴!"),
  f("minnow", "피라미", 120, "river", 1, ALL, [[9, 16]], 1, "피라미를 낚았다! 반짝반짝 날쌔다!"),
  f("carp", "잉어", 300, "pond", 4, ALL, DAY, 1, "잉어를 낚았다! 수염이 멋지다!"),
  f("koi", "비단잉어", 4000, "pond", 4, ALL, [[16, 9]], 4, "비단잉어를 낚았다! 무늬가 예술이다!"),
  f("goldfish", "금붕어", 1300, "pond", 1, ALL, DAY, 3, "금붕어를 낚았다! 행운이 올지도!"),
  f("killifish", "송사리", 300, "pond", 1, M([4, 8]), DAY, 1, "송사리를 낚았다! 작아도 힘차다!"),
  f("tadpole", "올챙이", 100, "pond", 1, M([3, 7]), DAY, 1, "올챙이를 낚았다! 곧 다리가 나오겠지?"),
  f("frog", "참개구리", 120, "pond", 2, M([5, 8]), DAY, 1, "개구리를 낚았다! 개굴개굴!"),
  f("crawfish", "가재", 200, "pond", 2, M([4, 9]), DAY, 1, "가재를 낚았다! 집게 조심!"),
  f("softshell", "자라", 3750, "river", 4, M([8, 9]), [[16, 9]], 3, "자라를 낚았다! 목을 쏙 넣었다!"),
  f("catfish", "메기", 800, "pond", 4, M([5, 10]), [[16, 9]], 2, "메기를 낚았다! 입이 정말 크다!"),
  f("snakehead", "가물치", 5500, "pond", 4, M([6, 8]), [[9, 16]], 4, "가물치를 낚았다! 힘이 장사다!"),
  f("mandarin", "쏘가리", 2000, "river", 3, M([5, 10]), [[4, 21]], 3, "쏘가리를 낚았다! 표범 무늬 같다!"),
  f("sweetfish", "은어", 900, "river", 3, M([7, 9]), DAY, 2, "은어를 낚았다! 수박 향이 난다나?"),
  f("salmon", "연어", 700, "mouth", 4, M([9, 9]), DAY, 2, "연어를 낚았다! 고향으로 돌아왔구나!"),
  f("lenok", "열목어", 1000, "clifftop", 3, M([3, 6], [9, 11]), [[16, 9]], 3, "열목어를 낚았다! 맑은 물의 주인!"),
  f("trout", "산천어", 3800, "clifftop", 3, M([3, 6], [9, 11]), [[16, 9]], 4, "산천어를 낚았다! 계곡의 보석!"),
  f("eel", "뱀장어", 2000, "river", 5, M([5, 10]), DAY, 3, "뱀장어를 낚았다! 미끌미끌!"),
  f("loach", "미꾸라지", 400, "river", 2, M([3, 5]), DAY, 1, "미꾸라지를 낚았다! 요리조리!"),
  f("bass", "배스", 400, "river", 4, ALL, DAY, 1, "배스를 낚았다! 제법 묵직하다!"),
  f("bluegill", "블루길", 180, "river", 2, ALL, [[9, 16]], 1, "블루길을 낚았다!"),
  f("piranha", "피라냐", 2500, "river", 2, M([6, 9]), [[9, 16], [21, 4]], 3, "피라냐를 낚았다! 이빨 조심!"),
  f("arowana", "아로와나", 10000, "river", 4, M([6, 9]), [[16, 9]], 5, "아로와나를 낚았다! 용처럼 빛난다!"),
  f("gar", "가아", 6000, "pond", 6, M([6, 9]), [[16, 4]], 5, "가아를 낚았다! 고대에서 온 물고기!"),
  f("horse-mackerel", "전갱이", 150, "sea", 2, ALL, DAY, 1, "전갱이를 낚았다! 반찬감이다!"),
  f("anchovy", "멸치", 200, "sea", 1, ALL, [[4, 21]], 1, "멸치를 낚았다! 작지만 소중해!"),
  f("sardine", "정어리", 150, "sea", 2, ALL, DAY, 1, "정어리를 낚았다!"),
  f("sea-bass", "농어", 400, "sea", 5, ALL, DAY, 1, "농어를 낚았다! 또 너니?"),
  f("sea-bream", "참돔", 1100, "sea", 4, ALL, DAY, 2, "참돔을 낚았다! 경사로다!"),
  f("flounder", "광어", 800, "sea", 3, ALL, DAY, 2, "광어를 낚았다! 눈이 한쪽에!"),
  f("puffer", "복어", 5000, "sea", 3, M([11, 2]), [[21, 4]], 3, "복어를 낚았다! 빵빵해졌다!"),
  f("squid", "오징어", 500, "sea", 3, M([12, 8]), DAY, 1, "오징어를 낚았다! 먹물 조심!"),
  f("octopus", "문어", 1200, "sea", 3, ALL, DAY, 2, "문어를 낚았다! 다리가 여덟 개!"),
  f("seahorse", "해마", 1100, "sea", 1, M([4, 11]), DAY, 2, "해마를 낚았다! 말을 닮은 물고기!"),
  f("clownfish", "흰동가리", 650, "sea", 1, M([4, 9]), DAY, 2, "흰동가리를 낚았다! 줄무늬가 귀여워!"),
  f("filefish", "쥐치", 350, "sea", 2, ALL, DAY, 1, "쥐치를 낚았다!"),
  f("tuna", "참다랑어", 7000, "pier", 6, M([11, 4]), DAY, 4, "참다랑어를 낚았다! 바다의 왕자!"),
  f("marlin", "청새치", 10000, "pier", 6, M([7, 9], [11, 4]), DAY, 5, "청새치를 낚았다! 칼 같은 주둥이!"),
  f("sunfish", "개복치", 4000, "sea", 6, M([7, 9]), [[4, 21]], 4, "개복치를 낚았다! 둥실둥실!"),
  f("manta", "쥐가오리", 2500, "sea", 5, M([8, 11]), [[4, 21]], 3, "쥐가오리를 낚았다! 날개처럼 퍼덕!"),
  f("shark", "상어", 15000, "sea", 6, M([6, 9]), [[16, 9]], 5, "상어를 낚았다! 심장이 쿵쾅!"),
  f("whale-shark", "고래상어", 13000, "sea", 6, M([6, 9]), DAY, 5, "고래상어를 낚았다! 세상에서 제일 큰 물고기!"),
  f("jellyfish", "해파리", 100, "sea", 1, M([8, 9]), DAY, 1, "해파리를… 낚았다? 흐물흐물."),
  f("coelacanth", "실러캔스", 15000, "sea", 6, ALL, DAY, 5, "실러캔스를 낚았다! 살아있는 화석!", true),
];

export const BUGS: Critter[] = [
  b("cabbage-white", "배추흰나비", 160, "fly", M([3, 6], [9, 10]), [[4, 19]], 1, "배추흰나비를 잡았다! 팔랑팔랑!"),
  b("yellow-butterfly", "노랑나비", 160, "fly", M([3, 6], [9, 10]), [[4, 19]], 1, "노랑나비를 잡았다! 봄이 왔구나!"),
  b("swallowtail", "호랑나비", 240, "fly", M([3, 8]), [[4, 19]], 1, "호랑나비를 잡았다! 날개가 멋지다!"),
  b("peacock", "제비나비", 2500, "flower", M([3, 6]), [[4, 19]], 3, "제비나비를 잡았다! 초록빛으로 반짝!"),
  b("blue-butterfly", "부전나비", 300, "flower", M([4, 9]), [[4, 19]], 2, "부전나비를 잡았다! 하늘색 날개!"),
  b("moth", "나방", 130, "light", ALL, [[19, 4]], 1, "나방을 잡았다! 불빛을 좋아하는구나."),
  b("atlas-moth", "아틀라스나방", 3000, "tree", M([4, 9]), [[19, 4]], 4, "아틀라스나방을 잡았다! 거대하다!"),
  b("ladybug", "무당벌레", 200, "flower", M([3, 6], [10, 10]), [[8, 17]], 1, "무당벌레를 잡았다! 점이 일곱 개!"),
  b("mantis", "사마귀", 430, "flower", M([3, 11]), [[8, 17]], 2, "사마귀를 잡았다! 기도하는 자세!"),
  b("orchid-mantis", "난초사마귀", 2400, "flower", M([3, 11]), [[8, 17]], 4, "난초사마귀를 잡았다! 꽃인 줄 알았어!"),
  b("grasshopper", "메뚜기", 160, "ground", M([7, 9]), [[8, 17]], 1, "메뚜기를 잡았다! 폴짝폴짝!"),
  b("rice-grasshopper", "방아깨비", 400, "ground", M([8, 11]), [[8, 19]], 2, "방아깨비를 잡았다! 방아 찧는 다리!"),
  b("cricket", "귀뚜라미", 130, "ground", M([9, 11]), [[17, 8]], 1, "귀뚜라미를 잡았다! 가을밤의 노래!"),
  b("bell-cricket", "방울벌레", 430, "ground", M([9, 10]), [[17, 4]], 2, "방울벌레를 잡았다! 딸랑딸랑 우네!"),
  b("katydid", "여치", 600, "ground", M([7, 9]), [[8, 19]], 2, "여치를 잡았다!"),
  b("cicada", "참매미", 250, "tree", M([7, 8]), [[8, 17]], 1, "참매미를 잡았다! 맴맴!"),
  b("big-cicada", "말매미", 300, "tree", M([7, 8]), [[8, 17]], 1, "말매미를 잡았다! 쏴아아 운다!"),
  b("evening-cicada", "쓰르라미", 550, "tree", M([7, 8]), [[4, 8], [16, 19]], 2, "쓰르라미를 잡았다! 해 질 녘의 노래!"),
  b("red-dragonfly", "고추잠자리", 180, "fly", M([9, 10]), [[8, 19]], 1, "고추잠자리를 잡았다! 가을 하늘 같아!"),
  b("dragonfly", "밀잠자리", 230, "fly", M([4, 10]), [[8, 17]], 1, "밀잠자리를 잡았다!"),
  b("darner", "왕잠자리", 4500, "fly", M([5, 10]), [[8, 17]], 4, "왕잠자리를 잡았다! 날개 소리가 우렁차다!"),
  b("firefly", "반딧불이", 300, "night-fly", M([6, 6]), [[19, 4]], 2, "반딧불이를 잡았다! 손안의 작은 별!"),
  b("stag", "사슴벌레", 2000, "tree", M([7, 8]), [[17, 8]], 3, "사슴벌레를 잡았다! 멋진 턱!"),
  b("rhino-beetle", "장수풍뎅이", 1350, "tree", M([7, 8]), [[17, 8]], 3, "장수풍뎅이를 잡았다! 뿔이 늠름하다!"),
  b("giant-stag", "왕사슴벌레", 10000, "stump", M([7, 8]), [[23, 8]], 5, "왕사슴벌레를 잡았다! 전설의 곤충!"),
  b("longhorn", "하늘소", 1000, "tree", M([5, 9]), DAY, 2, "하늘소를 잡았다! 더듬이가 길어!"),
  b("jewel-beetle", "비단벌레", 2400, "stump", M([7, 8]), DAY, 4, "비단벌레를 잡았다! 보석 같아!"),
  b("water-strider", "소금쟁이", 130, "water", M([5, 9]), [[8, 19]], 1, "소금쟁이를 잡았다! 물 위를 걷는다!"),
  b("diving-beetle", "물방개", 800, "water", M([5, 9]), [[8, 19]], 2, "물방개를 잡았다! 헤엄 선수!"),
  b("ant", "개미", 80, "ground", ALL, DAY, 1, "개미를 잡았다! 부지런해!"),
  b("fly", "파리", 60, "ground", ALL, DAY, 1, "파리를 잡았다. 윙윙."),
  b("pill-bug", "공벌레", 250, "rock", M([9, 6]), [[23, 16]], 1, "공벌레를 잡았다! 동그랗게 말렸다!"),
  b("snail", "달팽이", 250, "rain", ALL, DAY, 1, "달팽이를 잡았다! 느긋하게 가자~", true),
  b("spider", "거미", 480, "shake", ALL, [[19, 8]], 2, "거미를 잡았다! 거미줄 장인!"),
  b("bagworm", "도롱이벌레", 600, "shake", ALL, DAY, 2, "도롱이벌레를 잡았다! 나뭇잎 이불!"),
  b("tarantula", "타란튤라", 8000, "ground", M([11, 4]), [[19, 4]], 5, "타란튤라를 잡았다! 손이 떨려!"),
  b("scorpion", "전갈", 8000, "ground", M([5, 10]), [[19, 4]], 5, "전갈을 잡았다! 꼬리 조심!"),
  b("dung-beetle", "쇠똥구리", 3000, "ground", M([12, 2]), DAY, 4, "쇠똥구리를 잡았다! 굴리는 게 일!"),
  b("bee", "꿀벌", 200, "flower", M([3, 7]), [[8, 17]], 1, "꿀벌을 잡았다! 윙윙 부지런히!"),
  b("wasp", "말벌", 2500, "shake", ALL, DAY, 3, "말벌을 잡았다! 휴, 살았다…"),
  b("walking-stick", "대벌레", 600, "tree", M([7, 11]), [[4, 8], [17, 19]], 2, "대벌레를 잡았다! 나뭇가지인 척!"),
  b("hermit-crab", "소라게", 1000, "beach", ALL, [[19, 8]], 2, "소라게를 잡았다! 집이 멋지네!"),
  b("crab", "꽃게", 300, "beach", ALL, DAY, 1, "꽃게를 잡았다! 옆으로 옆으로!"),
  b("mosquito", "모기", 130, "night-fly", M([6, 9]), [[17, 4]], 1, "모기를 잡았다! 더는 못 물지!"),
  b("flea", "벼룩", 70, "ground", M([4, 11]), DAY, 1, "벼룩을 잡았다! 폴짝!"),
  b("coconut-crab", "야자집게", 8000, "palm", M([4, 8]), DAY, 4, "야자집게를 잡았다! 힘이 엄청나!"),
];

export function inSeason(c: Critter, month: number, hour: number, rain: boolean): boolean {
  if (c.rain && !rain) return false;
  if (!c.months.includes(month)) return false;
  return c.hours.some(([a, b]) => (a <= b ? hour >= a && hour < b : hour >= a || hour < b));
}

export function monthsText(c: Critter): string {
  if (c.months.length === 12) return "일 년 내내";
  const ms = [...c.months].sort((a, b) => a - b);
  const runs: [number, number][] = [];
  for (const m of ms) {
    const r = runs[runs.length - 1];
    if (r && m === r[1] + 1) r[1] = m;
    else runs.push([m, m]);
  }
  return runs.map(([a, z]) => (a === z ? `${a}월` : `${a}~${z}월`)).join(", ");
}

export function hoursText(c: Critter): string {
  if (c.hours.length === 1 && c.hours[0][0] === 0 && c.hours[0][1] === 24) return "하루 종일";
  return c.hours.map(([a, z]) => `${a}시~${z}시`).join(", ");
}
