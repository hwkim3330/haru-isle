// End-to-end: shake a tree, dig, enter the shop and talk, the museum, the office bench, home.
import { launch } from "./gpu.mjs";
const pre = process.argv[2] ?? "shots/f";
const { browser, page, errors } = await launch(`http://localhost:5471/?quick&fresh&seed=7&t=2026-04-06T11:00`);
page.on("console", (m) => m.type() === "log" && console.log("log:", m.text()));
await page.waitForTimeout(2500);
const ev = (f, a) => page.evaluate(f, a);
const key = async (c, ms = 250) => { await page.keyboard.down(c); await page.waitForTimeout(60); await page.keyboard.up(c); await page.waitForTimeout(ms); };
// 1. Shake a fruit tree.
const r1 = await ev(() => {
  const g = window.__g.game, S = g.world.S;
  for (const k in S.objs) { const o = S.objs[k]; if (o.t === "tree" && o.kind === "fruit" && o.fruitN > 0) { const x = k % 112, z = Math.floor(k / 112); if (g.world.passable(x, z + 1)) { g.player.pos.set(x + 0.5, g.world.groundY(x + 0.5, z + 1.5), z + 1.5); g.player.yaw = Math.PI; return [x, z]; } } }
});
await page.waitForTimeout(400);
await key("Space", 1500);
await page.screenshot({ path: `${pre}-shake.png` });
console.log("shook", r1, await ev(([x, z]) => { const g = window.__g.game; let n = 0; for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { const o = g.world.obj(x + dx, z + dz); if (o && o.t === "item") n++; } return n; }, r1));
// Pick them up with E.
for (let k = 0; k < 4; k++) { await ev(() => { const g = window.__g.game; const P = g.player; for (let r = 1; r < 3; r++) for (const [dx, dz] of [[0,1],[1,0],[-1,0],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]) { const x = Math.floor(P.pos.x) + dx * r, z = Math.floor(P.pos.z) + dz * r; const o = g.world.obj(x, z); if (o && o.t === "item" && g.world.passable(x - dx, z - dz)) { P.pos.set(x - dx + 0.5, P.pos.y, z - dz + 0.5); P.yaw = Math.atan2(dx, dz); return; } } }); await page.waitForTimeout(200); await key("KeyE", 500); }
console.log("pockets", await ev(() => window.__g.game.pockets.slots.filter(Boolean).map((s) => s.id + "x" + s.n).join(" ")));
// 2. Dig with the shovel.
await ev(() => { const g = window.__g.game; g.equip(g.pockets.firstTool("shovel")); const P = g.player; for (let k = 0; k < 40; k++) { const x = Math.floor(P.pos.x) + ((k % 7) - 3), z = Math.floor(P.pos.z) + Math.floor(k / 7) - 3; if (g.world.freeTile(x, z) && g.world.passable(x, z + 1) && !g.world.obj(x, z + 1)) { P.pos.set(x + 0.5, g.world.groundY(x + 0.5, z + 1.5), z + 1.5); P.yaw = Math.PI; return; } } });
await page.waitForTimeout(300);
await key("Space", 1200);
console.log("dug", await ev(() => { const g = window.__g.game; const [x, z] = g.player.front(); return JSON.stringify(g.world.obj(x, z)); }));
await page.screenshot({ path: `${pre}-dig.png` });
// 3. The shop.
const go = async (kind) => { await ev((k) => { const g = window.__g.game; const b = g.world.building(k); g.player.pos.set(b.door[0] + 0.5, g.world.groundY(b.door[0] + 0.5, b.door[1] + 0.5), b.door[1] + 0.5); g.player.yaw = Math.PI; }, kind); await page.waitForTimeout(400); await key("Space", 1600); };
await go("shop");
console.log("where", await ev(() => window.__g.game.where));
await page.screenshot({ path: `${pre}-shop.png` });
await ev(() => { const g = window.__g.game; g.player.pos.z -= 3; });
await page.waitForTimeout(300);
await key("Space", 1600);
await page.screenshot({ path: `${pre}-shopkeeper.png` });
console.log("talk", await ev(() => document.getElementById("talk").innerText.slice(0, 80)));
await key("Space", 600);
await page.screenshot({ path: `${pre}-shopmenu.png` });
await key("Escape", 400); await key("Escape", 400);
for (let k = 0; k < 6; k++) await key("Escape", 250);
await ev(() => window.__g.game.interiors.exit());
await page.waitForTimeout(1200);
// 4. Museum and office.
await go("museum");
await page.screenshot({ path: `${pre}-museum.png` });
await ev(() => window.__g.game.interiors.exit());
await page.waitForTimeout(1200);
await go("office");
await page.screenshot({ path: `${pre}-office.png` });
await ev(() => window.__g.game.interiors.exit());
await page.waitForTimeout(1200);
await go("home");
await page.screenshot({ path: `${pre}-home.png` });
console.log("fps", await ev(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / 2); }; requestAnimationFrame(f); })));
console.log(errors.slice(0, 8));
await browser.close();
