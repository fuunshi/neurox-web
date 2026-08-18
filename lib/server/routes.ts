/**
 * Which paths require a session, and where to send people.
 *
 * Kept in one module so the proxy and the layouts cannot disagree about what is
 * protected — a disagreement there is how a page ends up rendering for someone
 * who is not signed in.
 */

/**
 * Signed-in only. Prefix match, so `/decks/:id` is covered by `/decks`.
 *
 * `/stats` was missing from this list, which meant an anonymous visit was not
 * redirected by the proxy — it still failed safe, because the `(app)` layout
 * checks the session against the API, but it arrived at the sign-in screen
 * *without* `?next=`, so signing in dropped the reader on the home page
 * instead of the page they asked for.
 */
export const PROTECTED_PREFIXES = [
  "/home",
  "/decks",
  "/sources",
  "/generate",
  "/quizzes",
  "/stats",
  "/map",
  "/activity",
  "/settings",
] as const;

/**
 * Where a signed-in visitor lands, and where sign-in returns to.
 *
 * `/home` rather than `/decks`: the app opens on a hub that says what the
 * sections are, instead of dropping a first-time reader into a list of decks
 * with no explanation of what the rest of the app does.
 */
export const APP_HOME = "/home";
export const LOGIN_PATH = "/auth/login";

/** Pages a signed-in visitor should not see. */
export const GUEST_ONLY_PATHS = [
  LOGIN_PATH,
  "/auth/register",
  "/auth/forgot-password",
  "/auth/recover-account",
] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isGuestOnlyPath(pathname: string): boolean {
  return (GUEST_ONLY_PATHS as readonly string[]).includes(pathname);
}

/**
 * The header the proxy uses to hand a rotated access token to the rest of the
 * request. Downstream code reads request cookies, which still hold the *old*
 * value, so a refresh would otherwise be invisible until the next navigation.
 */
export const ACCESS_TOKEN_HEADER = "x-nx-access-token";
