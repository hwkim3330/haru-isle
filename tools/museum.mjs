import { launch } from "./gpu.mjs";
const { browser, page, errors } = await launch(`http://localhost:5471/?quick&fresh&seed=7&t=2026-04-06T11:00`);
await page.waitForTimeout(2000);
await page.evaluate(() => { const g = window.__g.game; g.island.museum.push("fish:koi","fish:sea-bass","fish:goldfish","fish:tuna","bug:swallowtail","bug:rhino-beetle","bug:ladybug","fossil:trex-skull","fossil:ammonite","fossil:tri-skull"); const b = g.world.building("museum"); g.interiors.enter("museum", b); });
await page.waitForTimeout(2500);
await page.screenshot({ path: "shots/mu.png" });
console.log(errors);
await browser.close();
