// node tools/view.mjs out.png "query" '{"x":56,"z":60,"zoom":1,"yaw":0}'
import { launch } from "./gpu.mjs";
const [out = "shots/v.png", query = "", camj = "{}"] = process.argv.slice(2);
const { browser, page, errors } = await launch(`http://localhost:5471/?${query}`);
await page.evaluate((c) => Object.assign(window.__g.cam, JSON.parse(c)), camj);
await page.waitForTimeout(2500);
await page.screenshot({ path: out });
console.log(errors.slice(0, 5));
await browser.close();
