import { chromium } from "playwright";

const url = process.argv[2] || "https://crowthza.com/";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2500);

const info = await page.evaluate(() => {
  const shell = document.querySelector('[style*="display: grid"], [style*="grid-template"]');
  const xdc = document.querySelector("x-dc");
  const raw = document.body?.innerHTML?.includes("{{ shellStyle }}");
  const tiles = Array.from(document.querySelectorAll("button")).filter((b) =>
    /AI Scores|Risk Engine|Live Markets/.test(b.textContent || ""),
  ).length;
  const bg = getComputedStyle(document.body).backgroundColor;
  return {
    title: document.title,
    hasReact: typeof window.React !== "undefined",
    hasReactDOM: typeof window.ReactDOM !== "undefined",
    hasDCLogic: typeof window.DCLogic !== "undefined",
    xdcChildren: xdc ? xdc.children.length : 0,
    stillHasShellPlaceholder: raw,
    tileButtons: tiles,
    bodyBg: bg,
    shellFound: Boolean(shell),
  };
});

console.log(JSON.stringify({ info, errors: errors.slice(0, 10) }, null, 2));
await browser.close();
