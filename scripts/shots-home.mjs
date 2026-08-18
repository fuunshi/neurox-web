/**
 * Verifies the things the navigation restructure is easy to get wrong and
 * invisible when it is: that sign-in lands on the hub, that the rail is absent
 * there and present in a section, that the mobile row substitutes for the rail
 * rather than duplicating it, and that the knowledge map draws.
 *
 * Usage: node scripts/shots-home.mjs <email> <password>
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

// The two section navigations, selected by their `data-nav` hook rather than by
// Tailwind classes — `hidden sm:block` is a selector that would break the
// moment the breakpoint or the display value is restyled, and it would break
// silently, by counting zero and looking like the nav had disappeared.
const railVisible = async () =>
  page.locator('[data-nav="rail"]:visible').count();

const rowVisible = async () => page.locator('[data-nav="row"]:visible').count();

console.log("--- sign in ---");
await visit("/auth/login");
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', password);
await page.click('button[type="submit"]');

// Where does sign-in actually land?
await page.waitForURL(/\/home|\/decks/, { timeout: 180_000 });
await page.waitForSelector("h1");
console.log("  landed on:", new URL(page.url()).pathname);

console.log("--- home ---");
console.log("  heading:", await page.locator("h1").first().textContent());
console.log(
  "  greeting:",
  (await page.locator("header p").first().textContent())?.trim(),
);
console.log("  section cards:", await page.locator("section a[href]").count());
console.log("  rail on home (want 0):", await railVisible());
await page.screenshot({ path: "/tmp/shots/home.png", fullPage: true });

console.log("--- into a section ---");
await page.getByRole("link", { name: /^Decks/ }).first().click();
await page.waitForURL(/\/decks/, { timeout: 180_000 });
await page.waitForSelector("h1");
console.log("  url:", new URL(page.url()).pathname);
console.log("  rail now visible (want 1):", await railVisible());
console.log(
  "  active rail item:",
  await page
    .locator('[data-nav="rail"] [aria-current="page"]')
    .first()
    .textContent(),
);
await page.screenshot({ path: "/tmp/shots/section-sidebar.png", fullPage: true });

console.log("--- knowledge map ---");
await visit("/map");
console.log("  heading:", await page.locator("h1").first().textContent());
console.log("  graph nodes drawn:", await page.locator("figure svg circle").count());
console.log(
  "  placeholder note shown:",
  (await page.getByText(/are placeholders/i).count()) > 0 ? "yes" : "NO",
);
await page.screenshot({ path: "/tmp/shots/map.png", fullPage: true });

console.log("--- mobile width ---");
await page.setViewportSize({ width: 420, height: 900 });

// On the hub there is deliberately no nav chrome at all — the cards are the
// navigation — so both the rail and the row should be absent.
await visit("/home");
console.log("  hub, rail (want 0):", await railVisible());
console.log("  hub, row (want 0):", await rowVisible());
await page.screenshot({ path: "/tmp/shots/home-mobile.png", fullPage: true });

// Inside a section the rail gives way to the scrolling row.
await visit("/decks");
console.log("  section, rail (want 0):", await railVisible());
console.log("  section, row (want 1):", await rowVisible());
console.log(
  "  row marks the active section:",
  await page
    .locator('[data-nav="row"] [aria-current="page"]')
    .first()
    .textContent(),
);
await page.screenshot({ path: "/tmp/shots/section-mobile.png", fullPage: true });

await browser.close();
console.log(
  problems.length
    ? "PROBLEMS: " + [...new Set(problems)].join(" | ")
    : "no console errors",
);
