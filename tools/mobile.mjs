import { chromium, devices } from "playwright";
const browser = await chromium.launch({ headless: true, args: ["--use-angle=vulkan", "--enable-features=Vulkan", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ ...devices["Pixel 7"] });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://localhost:5471/?quick&fresh&seed=7&t=2026-04-06T15:30");
await p.waitForTimeout(3500);
await p.screenshot({ path: "shots/m-0.png" });
// Push the stick up for a second.
const s = await p.locator("#stick").boundingBox();
await p.touchscreen.tap(s.x + s.width / 2, s.y + 5);
await p.waitForTimeout(500);
await p.locator("[data-ui=bag]").click();
await p.waitForTimeout(800);
await p.screenshot({ path: "shots/m-1.png" });
console.log(errs);
await browser.close();
