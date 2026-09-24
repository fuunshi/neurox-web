/**
 * Exercises the two things that are easy to get wrong and invisible when they
 * are: that the export is a real download with real rows, and that undo puts a
 * card back rather than merely appearing to.
 *
 * Usage: node scripts/shots-export-undo.mjs <email> <password> <deckId>
 */
import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";

const [, , email, password, deckId] = process.argv;
const BASE = process.env.APP_URL ?? "http://localhost:3001";
mkdirSync("/tmp/shots", { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1180, height: 1000 },
  deviceScaleFactor: 2,
  acceptDownloads: true,
});
const page = await context.newPage();
const problems = [];
page.on("console", (m) => m.type() === "error" && problems.push(m.text()));
page.on("pageerror", (e) => problems.push(e.message));

await page.goto(`${BASE}/auth/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', password);
await page.click('button[type="submit"]');
await page.waitForURL(/\/decks/, { timeout: 20000 });

// --- export ------------------------------------------------------------------
console.log("--- export ---");
await page.goto(`${BASE}/decks/${deckId}`, { waitUntil: "networkidle" });

const [download] = await Promise.all([
  page.waitForEvent("download", { timeout: 15000 }),
  page.getByRole("link", { name: "Export as CSV" }).click(),
]);
const path = await download.path();
const text = readFileSync(path, "utf8");
const lines = text.trim().split("\r\n");
console.log("  suggested filename:", download.suggestedFilename());
console.log("  rows:", lines.length, "(1 header + cards)");
console.log("  header:", lines[0]);

// Parse properly rather than counting commas: a card with a comma in it is
// exactly the case this feature exists to survive.
function parse(t, d = ",") {
  const rows = []; let row = [], f = "", q = false, i = 0;
  while (i < t.length) {
    const c = t[i];
    if (q) {
      if (c === '"') { if (t[i+1] === '"') { f += '"'; i += 2; continue; } q = false; i++; continue; }
      f += c; i++; continue;
    }
    if (c === '"') { q = true; i++; continue; }
    if (c === d) { row.push(f); f = ""; i++; continue; }
    if (c === "\r" && t[i+1] === "\n") { row.push(f); rows.push(row); row = []; f = ""; i += 2; continue; }
    f += c; i++;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}
const parsed = parse(text);
const body = parsed.slice(1).filter((r) => r.length > 1);
console.log("  parsed columns per row:", [...new Set(parsed.map((r) => r.length))]);
console.log("  cards:", body.length);
console.log("  first card front:", JSON.stringify(body[0]?.[0]?.slice(0, 40)));

// --- undo --------------------------------------------------------------------
console.log("--- undo ---");
await page.goto(`${BASE}/decks/${deckId}/study`, { waitUntil: "networkidle" });

const bar = page.locator('[role="progressbar"]');
if ((await bar.count()) === 0) {
  console.log("  nothing due — cannot exercise undo");
  await browser.close();
  process.exit(0);
}

const read = async () => {
  const b = page.locator('[role="progressbar"]');
  return (await b.count())
    ? { done: await b.getAttribute("aria-valuenow"), total: await b.getAttribute("aria-valuemax") }
    : "finished";
};

const before = await read();
const firstFront = await page.locator("main button[aria-label='Show the answer'] p").first().textContent();
console.log("  start:", JSON.stringify(before), "first card:", JSON.stringify(firstFront?.slice(0, 30)));

await page.getByRole("button", { name: "Show answer" }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: /^Good/ }).click();
await page.waitForTimeout(900);
const graded = await read();
console.log("  after grading:", JSON.stringify(graded));

const undo = page.getByRole("button", { name: "Undo" });
console.log("  undo offered:", (await undo.count()) > 0 ? "yes" : "NO");
await page.screenshot({ path: "/tmp/shots/study-undo.png", fullPage: true });

await undo.click();
await page.waitForTimeout(1200);
const undone = await read();
const frontAfter = await page.locator("main button[aria-label='Show the answer'] p").first().textContent();
console.log("  after undo:", JSON.stringify(undone));
console.log("  back to the same card:", frontAfter === firstFront ? "yes" : `NO (${frontAfter?.slice(0, 30)})`);
console.log("  progress restored:", JSON.stringify(before) === JSON.stringify(undone) ? "yes" : "NO");

await page.screenshot({ path: "/tmp/shots/study-after-undo.png", fullPage: true });
await browser.close();
console.log(problems.length ? "PROBLEMS: " + [...new Set(problems)].join(" | ") : "no console errors");
