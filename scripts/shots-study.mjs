/**
 * Drives a study session the way a reader would, then checks the result
 * survived a reload.
 *
 * The reload is the important part: it is the difference between a session that
 * looked like it recorded something and a session that did.
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

await page.goto(`${BASE}/auth/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', password);
await page.click('button[type="submit"]');
await page.waitForURL(/\/home|\/decks/, { timeout: 20_000 });

const studyUrl = `${BASE}/decks/${deckId}/study`;

/** How many cards the session says are left. */
const progress = async () => {
  const bar = page.locator('[role="progressbar"]');
  if ((await bar.count()) === 0) return null;
  return {
    done: Number(await bar.getAttribute("aria-valuenow")),
    total: Number(await bar.getAttribute("aria-valuemax")),
  };
};

const poolSize = async () => {
  await page.goto(studyUrl, { waitUntil: "networkidle" });
  const p = await progress();
  if (p) return p.total;
  // No progress bar means the empty state — nothing is due.
  return 0;
};

console.log("--- before ---");
const startingPool = await poolSize();
console.log("  study pool:", startingPool);
if (startingPool === 0) {
  console.log("  nothing due; nothing to test. Run generation/acceptance first.");
  await browser.close();
  process.exit(0);
}

await page.goto(studyUrl, { waitUntil: "networkidle" });
await page.screenshot({ path: `${OUT}/study-question.png`, fullPage: true });

// --- reveal, then grade ------------------------------------------------------
console.log("--- grading ---");

// Grading is refused before the answer is visible.
const beforeReveal = await page.getByRole("button", { name: "Good" }).count();
console.log("  grade buttons before revealing:", beforeReveal, beforeReveal === 0 ? "(ok)" : "(FAILED)");

await page.keyboard.press(" ");
await page.waitForTimeout(150);
const afterReveal = await page.getByRole("button", { name: /^Good/ }).count();
console.log("  space revealed the answer:", afterReveal > 0 ? "ok" : "FAILED");
await page.screenshot({ path: `${OUT}/study-answer.png`, fullPage: true });

// Grade one AGAIN by keyboard: it should stay in the session.
const before = await progress();
await page.keyboard.press("1");
await page.waitForTimeout(900);
const afterAgain = await progress();
const banner = await page.locator('[aria-live="polite"]').first().textContent();
console.log(`  graded AGAIN: ${JSON.stringify(before)} → ${JSON.stringify(afterAgain)}`);
console.log("  banner:", JSON.stringify((banner ?? "").trim().slice(0, 60)));
console.log(
  "  card stayed in the session:",
  afterAgain && before && afterAgain.total === before.total && afterAgain.done === before.done
    ? "ok"
    : "FAILED",
);

// Grade the rest GOOD until the session ends.
let guard = 0;
while (guard < 40) {
  guard += 1;
  const p = await progress();
  if (!p) break; // summary screen: no progress bar

  const revealButton = page.getByRole("button", { name: "Show answer" });
  if (await revealButton.count()) {
    await revealButton.click();
    await page.waitForTimeout(120);
  }

  const good = page.getByRole("button", { name: /^Good/ });
  if ((await good.count()) === 0) break;
  await good.click();
  await page.waitForTimeout(700);
}

const finished = await page.locator("h1", { hasText: "Session finished" }).count();
console.log("  session summary shown:", finished > 0 ? "ok" : "FAILED");
await page.screenshot({ path: `${OUT}/study-summary.png`, fullPage: true });

// --- did it persist? ---------------------------------------------------------
console.log("--- persistence ---");
const afterPool = await poolSize();
console.log(`  pool before: ${startingPool} → after: ${afterPool}`);
console.log(
  "  graded cards no longer due:",
  afterPool < startingPool ? "ok" : "FAILED (nothing was recorded)",
);

// The deck screen should agree with the study screen.
await page.goto(`${BASE}/decks/${deckId}`, { waitUntil: "networkidle" });
const summaryLine = await page.locator("p", { hasText: /active card/ }).first().textContent();
console.log("  deck header:", JSON.stringify((summaryLine ?? "").trim().slice(0, 80)));
await page.screenshot({ path: `${OUT}/deck-after-study.png`, fullPage: true });

// --- reduced motion ----------------------------------------------------------
// Grading is not an animation; reduced motion must not take it away.
console.log("--- reduced motion ---");
const reduced = await browser.newContext({ reducedMotion: "reduce" });
const reducedPage = await reduced.newPage();
reducedPage.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));

await reducedPage.goto(`${BASE}/auth/login`, { waitUntil: "networkidle" });
await reducedPage.fill('input[name="email"]', email);
await reducedPage.fill('input[name="password"]', password);
await reducedPage.click('button[type="submit"]');
await reducedPage.waitForURL(/\/home|\/decks/, { timeout: 20_000 });
await reducedPage.goto(studyUrl, { waitUntil: "networkidle" });

const reducedBar = reducedPage.locator('[role="progressbar"]');
if ((await reducedBar.count()) === 0) {
  console.log("  nothing due under reduced motion either (consistent)");
} else {
  const reveal = reducedPage.getByRole("button", { name: "Show answer" });
  if (await reveal.count()) await reveal.click();
  await reducedPage.waitForTimeout(150);
  const good = reducedPage.getByRole("button", { name: /^Good/ });
  if (await good.count()) {
    const beforeReduced = await reducedBar.getAttribute("aria-valuenow");
    await good.click();
    await reducedPage.waitForTimeout(800);
    const bar2 = reducedPage.locator('[role="progressbar"]');
    const afterReduced = (await bar2.count())
      ? await bar2.getAttribute("aria-valuenow")
      : "finished";
    console.log(`  graded under reduced motion: ${beforeReduced} → ${afterReduced}`);
  }
}

await browser.close();

if (problems.length > 0) {
  console.log("\nBrowser reported problems:");
  for (const p of [...new Set(problems)]) console.log("  -", p);
  process.exitCode = 1;
} else {
  console.log("\nNo console errors or page errors.");
}
