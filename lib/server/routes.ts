/**
 * Which paths require a session, and where to send people.
 *
 * Kept in one module so the proxy and the layouts cannot disagree about what is
 * protected — a disagreement there is how a page ends up rendering for someone
 * who is not signed in.
 */

/** Signed-in only. Prefix match, so `/decks/:id` is covered by `/decks`. */
export const PROTECTED_PREFIXES = [
  "/decks",
  "/sources",
  "/generate",
  "/activity",
  "/settings",
] as const;

/** Where a signed-in visitor lands, and where sign-in returns to. */
export const APP_HOME = "/decks";
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
