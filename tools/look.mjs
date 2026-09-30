// Close-up lookbook: node tools/look.mjs out.png "query" zoom [x z]
import { launch } from "./gpu.mjs";
const [out = "shots/look.png", query = "quick&fresh&seed=7&t=2026-04-06T15:30", zoom = "0.55", x, z] = process.argv.slice(2);
const { browser, page, errors } = await launch(`http://localhost:5471/?${query}`);
await page.waitForTimeout(2000);
await page.evaluate(([zm, x, z]) => { const g = window.__g.game; if (x) { g.player.pos.set(+x, g.world.groundY(+x, +z), +z); } g.stage.zoom = +zm; window.__lockZoom = +zm; }, [zoom, x, z]);
await page.waitForTimeout(1500);
await page.screenshot({ path: out });
console.log(errors.slice(0, 4));
await browser.close();
