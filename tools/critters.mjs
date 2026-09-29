// Fishing and bug catching.
import { launch } from "./gpu.mjs";
const pre = process.argv[2] ?? "shots/k";
const { browser, page, errors } = await launch(`http://localhost:5471/?quick&fresh&seed=7&t=2026-07-06T15:00`);
await page.waitForTimeout(2500);
const ev = (f, a) => page.evaluate(f, a);
const key = async (c, ms = 250) => { await page.keyboard.down(c); await page.waitForTimeout(60); await page.keyboard.up(c); await page.waitForTimeout(ms); };
// Stand on a river bank facing the water, with the rod.
const spot = await ev(() => {
  const g = window.__g.game, w = g.world;
  g.equip(g.pockets.firstTool("rod"));
  for (let z = 10; z < 90; z++) for (let x = 10; x < 100; x++) {
    if (!w.passable(x, z) || w.obj(x, z)) continue;
    if (w.waterAt(x, z - 1) === "river" && w.waterAt(x, z - 2) === "river" && w.I.tier[z * 112 + x] === 0) { g.player.pos.set(x + 0.5, w.groundY(x + 0.5, z + 0.5), z + 0.5); g.player.yaw = Math.PI; return [x, z]; }
  }
});
console.log("bank", spot);
await page.waitForTimeout(3000);
console.log("fish near", await ev(() => { const g = window.__g.game; return g.critters.fish?.length ?? "private"; }));
await key("Space", 400);
await page.screenshot({ path: `${pre}-cast.png` });
// Wait for a bite and strike.
let caught = false;
for (let t = 0; t < 120 && !caught; t++) {
  const st = await ev(() => { const F = window.__g.game.critters.fishing; return F && F.fish ? F.fish.state : F ? "wait" : "none"; });
  if (st === "bite") { await key("Space", 1500); caught = true; }
  else if (st === "none") { await key("Space", 400); }
  await page.waitForTimeout(150);
}
await page.screenshot({ path: `${pre}-caught.png` });
console.log("talk", await ev(() => document.getElementById("talk").innerText.slice(0, 60)));
await key("Space", 400); await key("Space", 400); await key("Space", 400);
console.log("pockets", await ev(() => window.__g.game.pockets.slots.filter(Boolean).map((s) => s.id).join(" ")));
// Bugs: swing the net at the nearest one.
await ev(() => { const g = window.__g.game; g.equip(g.pockets.firstTool("net")); });
let got = false;
for (let k = 0; k < 12 && !got; k++) {
  const ok = await ev(() => { const g = window.__g.game; const b = g.critters.bugs.filter((b) => !b.flee).sort((a, c) => a.pos.distanceTo(g.player.pos) - c.pos.distanceTo(g.player.pos))[0]; if (!b) return false; const x = b.pos.x, z = b.pos.z + 0.9; g.player.pos.set(x, g.world.groundY(x, z), z); g.player.yaw = Math.PI; return b.c.name; });
  if (!ok) { await page.waitForTimeout(800); continue; }
  await page.waitForTimeout(100);
  await key("Space", 1200);
  const t = await ev(() => document.getElementById("talk").hidden ? "" : document.getElementById("talk").innerText.slice(0, 40));
  if (t) { console.log("bug", ok, t); got = true; await page.screenshot({ path: `${pre}-bug.png` }); }
}
console.log(errors.slice(0, 6));
await browser.close();
