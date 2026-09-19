/**
 * The API roots the browser-facing proxy will forward to.
 *
 * Declared in its own module rather than inside
 * `app/api/proxy/[...path]/route.ts` for two reasons. A route file may only
 * export HTTP methods and route config, so nothing outside it could import the
 * set; and a list that lives only inside the file it guards is a list that
 * nothing can check against the code obliged to obey it.
 *
 * That check is not hypothetical. `lib/server/routes.ts` records the same
 * failure one layer up — `/stats` went missing from `PROTECTED_PREFIXES`, and
 * nothing failed until a reader noticed they had been sent to the wrong page
 * after signing in. This list drifted the same way, and for longer:
 * `notifications` was added to the client but never here, so the bell's list
 * request 404'd on every page load and rendered as its empty state — which
 * reads as "you have no notifications" rather than as a failure. It was found
 * by reading logs, which is the expensive way. `proxy-roots.test.ts` is what
 * makes the next one fail loudly instead.
 *
 * Matching is on the **first path segment only**: `resolvePath` forwards
 * everything after it unexamined, so one entry covers every sub-path and every
 * method beneath it. This is still not an open proxy — an unlisted root is a
 * 404 thrown before any network call is made.
 */
export const ALLOWED_ROOTS = new Set([
  "decks",
  "cards",
  "sources",
  "activities",
  "user",
  "generation",
  "quizzes",
  // The bell's three calls — the list, `:id/read` and `read-all` — all sit
  // under this one root, which is why a single missing entry broke all of them.
  "notifications",
]);
