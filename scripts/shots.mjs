/**
 * Signs in through the real form and captures the app screens.
 *
 * Uses the login form rather than injecting a cookie, so a broken sign-in shows
 * up here rather than being papered over. Not a test — a look at the thing,
 * which is the only way to catch a layout that renders but reads badly.
 *
 * Usage: node scripts/shots.mjs <email> <password> [deckId]
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const [, , email, password, deckId] = process.argv;
if (!email || !password) {
  console.error("usage: node scripts/shots.mjs <email> <password> [deckId]");
  process.exit(1);
}

const BASE = process.env.APP_URL ?? "http://localhost:3001";
const OUT = "/tmp/shots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

const problems = [];
page.on("console", (message) => {
  if (message.type() === "error") problems.push(`console: ${message.text()}`);
});
page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));

// --- sign in through the form -------------------------------------------------
await page.goto(`${BASE}/auth/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', password);
await page.click('button[type="submit"]');
await page.waitForURL(/\/decks/, { timeout: 20_000 });

console.log("signed in; landed on", page.url());

const screens = [
  ["decks", "/decks"],
  ["sources", "/sources"],
  ["generate", "/generate"],
  ["activity", "/activity"],
  ["settings", "/settings"],
  ...(deckId ? [["deck", `/decks/${deckId}`]] : []),
];

for (const [name, path] of screens) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  const heading = await page.locator("h1").first().textContent();
  console.log(`  ${name.padEnd(10)} ${path.padEnd(46)} h1=${JSON.stringify(heading)}`);
}

// --- one scheme swap, to confirm the app follows the theme system too ---------
await page.goto(`${BASE}/decks`, { waitUntil: "networkidle" });
await page.click('[data-scheme-option="nightlab"]');
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/decks-nightlab.png`, fullPage: true });
console.log("  nightlab   captured after an in-app scheme switch");

// --- reduced motion ----------------------------------------------------------
const reduced = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  reducedMotion: "reduce",
});
const reducedPage = await reduced.newPage();
await reducedPage.goto(`${BASE}/`, { waitUntil: "networkidle" });
await reducedPage.screenshot({ path: `${OUT}/home-reduced-motion.png`, fullPage: true });
console.log("  home       captured with prefers-reduced-motion");

await browser.close();

if (problems.length > 0) {
  console.log("\nBrowser reported problems:");
  for (const problem of [...new Set(problems)]) console.log("  -", problem);
  process.exitCode = 1;
} else {
  console.log("\nNo console errors or page errors.");
}
