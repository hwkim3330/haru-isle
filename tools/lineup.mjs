// Character lineup close-up: node tools/lineup.mjs out.png [row]
import { launch } from "./gpu.mjs";
const [out = "shots/lineup.png", row = "0", anim = ""] = process.argv.slice(2);
const { browser, page, errors } = await launch(`http://localhost:5471/?quick&fresh&seed=7&t=2026-04-06T14:00`);
await page.waitForTimeout(2000);
await page.evaluate(([row, anim]) => {
  const g = window.__g.game, L = window.__g.lib;
  for (const n of g.villagers.list) n.p.hidden = true, n.inside = true;
  const o = g.world.plot("office");
  const cx = o.x + 3.5, cz = o.z + 6.5;
  g.player.pos.set(cx, g.world.groundY(cx, cz), cz - 0.01); g.player.hidden = true;
  const looks = [L.playerLook(), L.playerLook({ hair: "bob", hairColor: 0xc89050, shirt: 0xf8a0c0 }), ...L.SPECIES.map((s, k) => L.makeVillager(k * 17 + 3, new Set(), s.id).look)];
  const pick = looks.slice(+row * 6, +row * 6 + 6);
  pick.forEach((look, k) => { const p = new L.Person(g.stage.scene, look, "x"); p.pos.set(cx - 2.5 + (k % 3) * 2.5, g.world.groundY(cx, cz), cz - 1 + Math.floor(k / 3) * 1.9); p.yaw = 0; g.__extra = (g.__extra || []).concat(p); if (anim) p.play(anim); });
  const up = (dt) => { for (const p of g.__extra) p.update(0.016); requestAnimationFrame(up); };
  up();
  g.stage.zoom = 0.5;
}, [row, anim]);
await page.waitForTimeout(1800);
await page.screenshot({ path: out });
console.log(errors.slice(0, 4));
await browser.close();
