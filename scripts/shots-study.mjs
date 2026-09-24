/**
 * Drives the study modes the way a reader would and captures them.
 *
 * Exercises the interactions, not just the render: flipping, arrow-keying,
 * swiping with a real pointer drag, and switching modes. A mode that renders but
 * cannot be operated is exactly the failure this is looking for.
 *
 * Usage: node scripts/shots-study.mjs <email> <password> <deckId>
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const [, , email, password, deckId] = process.argv;
if (!email || !password || !deckId) {
  console.error("usage: node scripts/shots-study.mjs <email> <password> <deckId>");
  process.exit(1);
}

const BASE = process.env.APP_URL ?? "http://localhost:3001";
const OUT = "/tmp/shots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 950 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

const problems = [];
page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));

// --- sign in -----------------------------------------------------------------
await page.goto(`${BASE}/auth/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', password);
await page.click('button[type="submit"]');
await page.waitForURL(/\/decks/, { timeout: 20_000 });

const url = `${BASE}/decks/${deckId}/study`;
await page.goto(url, { waitUntil: "networkidle" });

const progress = () => page.locator('[role="progressbar"]').getAttribute("aria-valuenow");

console.log("--- swipe mode ---");
console.log("  start at card", await progress());
await page.screenshot({ path: `${OUT}/study-swipe-front.png`, fullPage: true });

// Reveal the answer with the button, then check the label flipped.
await page.getByRole("button", { name: "Show answer" }).click();
await page.waitForTimeout(150);
const hideVisible = await page.getByRole("button", { name: "Hide answer" }).count();
console.log("  reveal via button:", hideVisible > 0 ? "ok" : "FAILED");
await page.screenshot({ path: `${OUT}/study-swipe-back.png`, fullPage: true });

// Arrow key advances, and resets to the question.
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(200);
console.log("  after ArrowRight, card", await progress());
const backOnFront = await page.getByRole("button", { name: "Show answer" }).count();
console.log("  new card starts on its question:", backOnFront > 0 ? "ok" : "FAILED");

// A real pointer drag, which is the gesture the mode is named for.
// The card is matched by its exact label: "Show the answer" (the card) rather
// than "Show answer" (the control below it), and rather than a bare
// `main button`, which would match the mode switcher first.
const card = page.getByRole("button", { name: "Show the answer", exact: true });
const box = await card.boundingBox();
if (!box) throw new Error("card not found for the drag test");
const y = box.y + box.height / 2;
await page.mouse.move(box.x + box.width - 60, y);
await page.mouse.down();
await page.mouse.move(box.x + 120, y, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(300);
console.log("  after a leftward drag, card", await progress());

// Space flips when nothing focusable holds focus.
await page.locator("body").click({ position: { x: 5, y: 5 } });
await page.keyboard.press(" ");
await page.waitForTimeout(150);
const spaceFlipped = await page.getByRole("button", { name: "Hide answer" }).count();
console.log("  space reveals the answer:", spaceFlipped > 0 ? "ok" : "FAILED");

// --- grid mode ---------------------------------------------------------------
console.log("--- grid mode ---");
await page.getByRole("radio", { name: "Grid" }).click();
await page.waitForTimeout(300);
const tiles = await page.locator("main ul li button").count();
console.log("  tiles rendered:", tiles);
await page.screenshot({ path: `${OUT}/study-grid.png`, fullPage: true });

await page.getByRole("button", { name: "Reveal all" }).click();
await page.waitForTimeout(200);
const expanded = await page.locator('main ul li button[aria-expanded="true"]').count();
console.log("  after Reveal all, revealed:", expanded);
await page.screenshot({ path: `${OUT}/study-grid-revealed.png`, fullPage: true });

// The choice should survive a reload, the way the colour scheme does.
await page.reload({ waitUntil: "networkidle" });
const stillGrid = await page.getByRole("radio", { name: "Grid" }).getAttribute("aria-checked");
console.log("  mode persisted across reload:", stillGrid === "true" ? "ok" : `FAILED (${stillGrid})`);

// --- reduced motion ----------------------------------------------------------
// The gesture is direct manipulation, not decoration, so it must keep working
// when animations are switched off — reduced motion flattens the snap-back, it
// does not disable the drag.
console.log("--- reduced motion ---");
const reduced = await browser.newContext({
  viewport: { width: 1280, height: 950 },
  reducedMotion: "reduce",
});
const reducedPage = await reduced.newPage();
reducedPage.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));

await reducedPage.goto(`${BASE}/auth/login`, { waitUntil: "networkidle" });
await reducedPage.fill('input[name="email"]', email);
await reducedPage.fill('input[name="password"]', password);
await reducedPage.click('button[type="submit"]');
await reducedPage.waitForURL(/\/decks/, { timeout: 20_000 });
await reducedPage.goto(url, { waitUntil: "networkidle" });

const reducedProgress = () =>
  reducedPage.locator('[role="progressbar"]').getAttribute("aria-valuenow");

const reducedCard = reducedPage.getByRole("button", {
  name: "Show the answer",
  exact: true,
});
const reducedBox = await reducedCard.boundingBox();
if (!reducedBox) throw new Error("card not found under reduced motion");

const ry = reducedBox.y + reducedBox.height / 2;
await reducedPage.mouse.move(reducedBox.x + reducedBox.width - 60, ry);
await reducedPage.mouse.down();
await reducedPage.mouse.move(reducedBox.x + 120, ry, { steps: 12 });
await reducedPage.mouse.up();
await reducedPage.waitForTimeout(250);
console.log("  drag under reduced motion, card", await reducedProgress());

await reducedPage.keyboard.press("ArrowRight");
await reducedPage.waitForTimeout(150);
console.log("  ArrowRight under reduced motion, card", await reducedProgress());

await browser.close();

if (problems.length > 0) {
  console.log("\nBrowser reported problems:");
  for (const p of [...new Set(problems)]) console.log("  -", p);
  process.exitCode = 1;
} else {
  console.log("\nNo console errors or page errors.");
}
