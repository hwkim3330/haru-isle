// node tools/play.mjs prefix "query" "script"
// script: | separated list: "w:ms"(hold KeyW) "hold:Code/ms" "key:Code" "wait:ms" "shot:name" "eval:js" "log:js"
import { launch } from "./gpu.mjs";
const [pre = "shots/p", query = "quick&fresh&seed=7", script = "wait:1500,shot:0"] = process.argv.slice(2);
const { browser, page, errors } = await launch(`http://localhost:5471/?${query}`);
page.on("console", (m) => (m.type() === "log" || m.type() === "warning") && console.log("log:", m.text()));
await page.waitForTimeout(1500);
for (const step of script.split("|")) {
  const i = step.indexOf(":");
  const k = i < 0 ? step : step.slice(0, i);
  const v = i < 0 ? "" : step.slice(i + 1);
  if (k === "wait") await page.waitForTimeout(+v);
  else if (k === "shot") await page.screenshot({ path: `${pre}-${v}.png` });
  else if (k === "key") { await page.keyboard.down(v); await page.waitForTimeout(70); await page.keyboard.up(v); await page.waitForTimeout(250); }
  else if (k === "hold") { const [code, ms] = v.split("/"); await page.keyboard.down(code); await page.waitForTimeout(+ms); await page.keyboard.up(code); }
  else if (k === "eval") await page.evaluate(v);
  else if (k === "log") console.log(await page.evaluate(v));
}
console.log(errors.slice(0, 8));
await browser.close();
