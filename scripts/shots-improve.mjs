/**
 * Checks what the card screen does when a rewrite is asked for.
 *
 * Without GEMINI_API_KEY this exercises the failure path, which is the one a
 * self-hosted install sees first — so it had better name the fix rather than
 * look broken. With a key the same script captures the proposal.
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const [, , email, password, deckId] = process.argv;
const BASE = process.env.APP_URL ?? "http://localhost:3001";
mkdirSync("/tmp/shots", { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1180, height: 1000 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const problems = [];
page.on("console", (m) => m.type() === "error" && problems.push(m.text()));
page.on("pageerror", (e) => problems.push(e.message));

await page.goto(`${BASE}/auth/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', password);
await page.click('button[type="submit"]');
await page.waitForURL(/\/home|\/decks/, { timeout: 20000 });

await page.goto(`${BASE}/decks/${deckId}`, { waitUntil: "networkidle" });

// Set a lapse count on a card so the leech state is reachable, if it is not.
const buttons = page.getByRole("button", { name: "Suggest a rewrite" });
const count = await buttons.count();
console.log("suggest buttons on the page:", count);
if (count === 0) {
  console.log("no card has been forgotten twice yet — nothing to exercise");
  await browser.close();
  process.exit(0);
}

await buttons.first().click();
await page.waitForTimeout(1500);

const alert = page.locator('[role="alert"]');
const text = (await alert.count()) ? await alert.first().textContent() : null;
console.log("alert shown:", text ? JSON.stringify(text.trim().slice(0, 120)) : "NONE");

await page.screenshot({ path: "/tmp/shots/improve-error.png", fullPage: true });
await browser.close();
console.log(problems.length ? "PROBLEMS: " + [...new Set(problems)].join(" | ") : "no console errors");
