/**
 * Drives a real quiz in all three formats.
 *
 * The things easy to get wrong and invisible when they are: that a question
 * does not show its answer before it is answered, that feedback appears after
 * answering rather than the quiz silently advancing, that the matching board
 * grades in one go, and that the summary says the schedule was untouched.
 *
 * Usage: node scripts/shots-quiz.mjs <email> <password>
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const [, , email, password] = process.argv;
const BASE = process.env.APP_URL ?? "http://localhost:3001";
mkdirSync("/tmp/shots", { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 1100 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
const problems = [];
page.on("console", (m) => m.type() === "error" && problems.push(m.text()));
page.on("pageerror", (e) => problems.push(e.message));

/**
 * Navigates, waits for the route to have painted, and then waits for the page
 * to go quiet.
 *
 * All three steps are needed. `domcontentloaded` alone does not wait for
 * Turbopack's compile — the first hit on a route can take over a minute on this
 * filesystem. And the heading alone does not mean React has hydrated: filling a
 * controlled input in that window sets the value and hydration then resets it,
 * so the form submits empty and fails its own validation, which looks exactly
 * like a wrong password.
 */
async function visit(path) {
  await page.goto(`${BASE}${path}`, {
    waitUntil: "domcontentloaded",
    timeout: 180_000,
  });
  await page.waitForSelector("h1", { timeout: 180_000 });
  await page.waitForLoadState("networkidle", { timeout: 180_000 });
}

async function startQuiz(format, deckName) {
  await visit("/quizzes");

  // Pick the deck explicitly rather than taking the default: the list is
  // newest-first, so the default is whatever was created most recently, which
  // is not a property this script has any reason to depend on.
  await page.getByRole("radio", { name: deckName }).check();
  await page.getByRole("radio", { name: format }).check();

  await page.getByRole("button", { name: "Start the quiz" }).click();
  await page.waitForURL(/\/quizzes\/[0-9a-f-]{36}/, { timeout: 180_000 });
  await page.waitForSelector("h1");
  console.log("  started:", new URL(page.url()).pathname.slice(0, 22) + "…");
}

console.log("--- sign in ---");
await visit("/auth/login");
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', password);
await page.click('button[type="submit"]');
await page.waitForURL(/\/home/, { timeout: 180_000 });
await page.waitForSelector("h1");

console.log("--- multiple choice ---");
await startQuiz("Multiple choice", "Cell biology");

console.log(
  "  questions on the paper:",
  await page.locator('ul li button[type="button"]').count(),
);
await page.screenshot({ path: "/tmp/shots/quiz-mc.png", fullPage: true });

// Answer the first question and check that feedback is shown rather than the
// quiz moving on by itself.
const beforePrompt = await page.locator("p.font-display").first().textContent();
await page.locator('ul li button[type="button"]').first().click();
await page.waitForTimeout(1200);

const afterPrompt = await page.locator("p.font-display").first().textContent();
console.log(
  "  stayed on the question after answering:",
  beforePrompt === afterPrompt ? "yes" : "NO (advanced by itself)",
);
console.log(
  "  a next step is offered:",
  (await page.getByRole("button", { name: /Next question|See results/ }).count()) > 0
    ? "yes"
    : "NO",
);
await page.screenshot({ path: "/tmp/shots/quiz-mc-answered.png", fullPage: true });

// Work through the rest.
for (let i = 0; i < 20; i += 1) {
  const next = page.getByRole("button", { name: "Next question" });
  if ((await next.count()) === 0) break;
  await next.click();
  await page.waitForTimeout(400);
  await page.locator('ul li button[type="button"]').first().click();
  await page.waitForTimeout(900);
}

await page.getByRole("button", { name: "See results" }).click();
await page.waitForTimeout(400);
console.log("  summary heading:", await page.locator("h1").first().textContent());
console.log(
  "  says the schedule is untouched:",
  (await page.getByText(/review schedule is unchanged/i).count()) > 0 ? "yes" : "NO",
);
await page.screenshot({ path: "/tmp/shots/quiz-summary.png", fullPage: true });

console.log("--- cloze ---");
await startQuiz("Fill in the blank", "Cell biology");
const clozePrompt = await page.locator("p.font-display").first().textContent();
console.log("  prompt:", JSON.stringify(clozePrompt?.slice(0, 60)));
console.log("  has a gap:", clozePrompt?.includes("____") ? "yes" : "NO");
await page.screenshot({ path: "/tmp/shots/quiz-cloze.png", fullPage: true });

console.log("--- matching ---");
await startQuiz("Matching", "Cell biology");
const prompts = await page.locator('ul li button[aria-pressed]').count();
const options = await page.locator('ul li button:not([aria-pressed])').count();
console.log("  prompts:", prompts, " answers in the pool:", options);
console.log(
  "  check is blocked until every pair is placed:",
  (await page.getByRole("button", { name: /Pair all/i }).count()) > 0 ? "yes" : "NO",
);
await page.screenshot({ path: "/tmp/shots/quiz-matching.png", fullPage: true });

await browser.close();
console.log(
  problems.length
    ? "PROBLEMS: " + [...new Set(problems)].join(" | ")
    : "no console errors",
);
