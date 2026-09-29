// Dump island maps as PNG: npx tsx tools/map.ts out.png seed [seed...]
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { generate, H, W, idx } from "../src/world/island";

function png(w: number, h: number, rgb: Uint8Array): Buffer {
  const crcT = new Int32Array(256).map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c;
  });
  const crc = (b: Buffer) => {
    let c = -1;
    for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
  const chunk = (t: string, d: Buffer) => {
    const l = Buffer.alloc(4);
    l.writeUInt32BE(d.length);
    const td = Buffer.concat([Buffer.from(t), d]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([l, td, c]);
  };
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w * 3; x++) raw[y * (w * 3 + 1) + 1 + x] = rgb[y * w * 3 + x];
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const [out, ...seeds] = process.argv.slice(2);
const S = 4;
const cols = Math.min(3, seeds.length);
const rows = Math.ceil(seeds.length / cols);
const IW = W * S + 8;
const IH = H * S + 8;
const img = new Uint8Array(IW * cols * IH * rows * 3).fill(30);
seeds.forEach((sd, n) => {
  const t0 = performance.now();
  const I = generate(+sd);
  console.log(`seed ${sd} "${I.name}": ${(performance.now() - t0).toFixed(0)} ms, ramps ${I.ramps.length}, bridges ${I.bridges.length}, falls ${I.falls.length}, plots ${I.plots.map((p) => p.kind[0]).join("")}, objects ${I.seeded.size}, fruit ${I.fruit}`);
  const ox = (n % cols) * IW + 4;
  const oy = Math.floor(n / cols) * IH + 4;
  const put = (x: number, y: number, c: number[]) => {
    const o = ((oy + y) * IW * cols + ox + x) * 3;
    img[o] = c[0];
    img[o + 1] = c[1];
    img[o + 2] = c[2];
  };
  for (let z = 0; z < H; z++)
    for (let x = 0; x < W; x++) {
      const i = idx(x, z);
      const k = I.kind[i];
      const t = I.tier[i];
      let c = [[40, 110, 200], [230, 215, 160], [90, 170, 80], [80, 170, 230], [70, 150, 220], [120, 115, 110], [160, 110, 70]][k];
      if (k === 2) c = [[110, 185, 90], [80, 150, 65], [55, 115, 50]][t];
      const s = I.seeded.get(i);
      for (let dy = 0; dy < S; dy++)
        for (let dx = 0; dx < S; dx++) {
          let cc = c;
          if (s && dx > 0 && dy > 0 && dx < S - 1 && dy < S - 1) cc = s.t === "tree" ? (s.kind === "cedar" ? [20, 70, 40] : s.kind === "palm" ? [150, 140, 40] : s.kind === "fruit" ? [200, 60, 60] : [30, 90, 30]) : s.t === "rock" ? [60, 60, 60] : s.t === "flower" ? [255, 90, 200] : s.t === "shell" ? [255, 255, 255] : c;
          put(x * S + dx, z * S + dy, cc);
        }
    }
  const rect = (x: number, z: number, w: number, d: number, c: number[]) => {
    for (let y = z * S; y < (z + d) * S; y++) for (let xx = x * S; xx < (x + w) * S; xx++) put(xx, y, c);
  };
  for (const r of I.ramps) rect(r.x, r.z, r.w, r.l, [230, 140, 40]);
  for (const b of I.bridges) rect(b.x, b.z, b.w, b.l, [140, 80, 30]);
  for (const f of I.falls) rect(f.x, f.z, 1, 1, [255, 255, 255]);
  const pc: Record<string, number[]> = { office: [240, 240, 60], shop: [60, 200, 240], museum: [180, 90, 200], home: [255, 120, 0], house: [240, 90, 90], camp: [255, 255, 255], dock: [120, 60, 20] };
  for (const p of I.plots) rect(p.x, p.z, p.w, p.d, pc[p.kind]);
});
writeFileSync(out, png(IW * cols, IH * rows, img));
