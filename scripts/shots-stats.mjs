import { chromium } from "@playwright/test";

const [, , email, password] = process.argv;
const BASE = "http://localhost:3001";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1180, height: 1200 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const problems = [];
page.on("console", (m) => m.type() === "error" && problems.push(m.text()));
page.on("pageerror", (e) => problems.push(e.message));

await page.goto(`${BASE}/auth/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', password);
await page.click('button[type="submit"]');
await page.waitForURL(/\/home|\/decks/, { timeout: 20000 });

await page.goto(`${BASE}/stats`, { waitUntil: "networkidle" });
const h1 = await page.locator("h1").first().textContent();
console.log("h1:", JSON.stringify(h1));

for (const scheme of ["daylight", "nightlab", "paper"]) {
  await page.click(`[data-scheme-option="${scheme}"]`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `/tmp/shots/stats-${scheme}.png`, fullPage: true });
  console.log("captured", scheme);
}

// The table view, which is the accessibility path.
await page.click('[data-scheme-option="daylight"]');
await page.waitForTimeout(200);
const details = page.locator("details").first();
await details.locator("summary").click();
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/shots/stats-table.png", fullPage: true });
console.log("captured table view");

await browser.close();
console.log(problems.length ? "PROBLEMS:\n" + [...new Set(problems)].join("\n") : "no console errors");
