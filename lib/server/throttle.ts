import "server-only";

/**
 * Outbound rate limiting, mirroring the API's own buckets.
 *
 * The API throttles per endpoint **and per IP**. Because every request from this
 * app arrives from one server, the whole app shares a single bucket per endpoint
 * — three requests per second across all users, not per user. Those defaults are
 * relaxed in local development, but they are the production values, so the
 * budget has to be spent deliberately rather than discovered in an incident.
 *
 * This spaces calls out instead of dropping them: callers await a slot, so a
 * burst becomes slightly slower rather than a 429.
 *
 * Keyed by route template (`GET /decks/:id`, not `GET /decks/abc`) so that ids
 * do not each get their own bucket — that would defeat the limit entirely, since
 * the API's key is the handler, not the path.
 */

interface Bucket {
  /** Timestamps of calls inside the window, oldest first. */
  hits: number[];
}

const LIMITS = [
  { windowMs: 1_000, max: 3 },
  { windowMs: 10_000, max: 20 },
  { windowMs: 60_000, max: 100 },
];

const buckets = new Map<string, Bucket>();

/** Collapses ids so `/decks/8f2…/cards` and `/decks/1a9…/cards` share a
 *  bucket, matching how the API's throttler keys on the handler. */
export function routeTemplate(path: string, method: string): string {
  const normalised = path
    .split("?")[0]
    .split("/")
    // A UUID, or anything else that is plainly an identifier rather than a
    // fixed route segment.
    .map((segment) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        segment,
      ) || /^\d+$/.test(segment)
        ? ":id"
        : segment,
    )
    .join("/");

  return `${method} ${normalised}`;
}

function delayFor(key: string, now: number): number {
  const bucket = buckets.get(key) ?? { hits: [] };
  buckets.set(key, bucket);

  // Drop anything outside the widest window.
  const widest = LIMITS[LIMITS.length - 1].windowMs;
  bucket.hits = bucket.hits.filter((at) => now - at < widest);

  let waitMs = 0;
  for (const { windowMs, max } of LIMITS) {
    const inWindow = bucket.hits.filter((at) => now - at < windowMs);
    if (inWindow.length < max) continue;

    // Wait for the oldest hit in this window to age out.
    const oldest = inWindow[inWindow.length - max];
    waitMs = Math.max(waitMs, oldest + windowMs - now + 1);
  }

  return waitMs;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Waits until this call fits inside every bucket. Single-process and
 * best-effort: it serialises the app's own outbound calls, it does not
 * coordinate across instances.
 */
export async function throttle(path: string, method: string): Promise<void> {
  const key = routeTemplate(path, method);

  // Two passes covers the case where waiting for the wide window pushes the
  // call into a fresh narrow window.
  for (let attempt = 0; attempt < 2; attempt++) {
    const now = Date.now();
    const waitMs = delayFor(key, now);

    if (waitMs <= 0) {
      buckets.get(key)?.hits.push(now);
      return;
    }

    await sleep(waitMs);
  }

  buckets.get(key)?.hits.push(Date.now());
}
