/**
 * Reading `exp` out of a JWT, and deciding when to replace it.
 *
 * Deliberately free of `next/headers` and `server-only` so the logic can be
 * tested directly. These are pure functions over a string, and they are the part
 * most worth testing: an off-by-one here either refreshes constantly or lets a
 * token expire mid-request.
 *
 * **The signature is never verified here.** This value only schedules a refresh;
 * it never decides whether a request is allowed. The API verifies every token it
 * receives, so a forged `exp` buys an attacker a wasted round trip and nothing
 * else.
 */

const CLOCK_SKEW_MS = 60_000;

export function decodeExpiry(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payload: unknown = JSON.parse(atob(padded));

    if (
      typeof payload === "object" &&
      payload !== null &&
      "exp" in payload &&
      typeof (payload as { exp: unknown }).exp === "number"
    ) {
      return (payload as { exp: number }).exp * 1000;
    }
  } catch {
    // A malformed token is treated as expired by callers.
  }

  return null;
}

/**
 * Whether the access token should be replaced before it is used.
 *
 * The skew covers the time a request spends in flight, so a token that expires
 * while the request it was minted for is still running does not produce a
 * spurious 401.
 *
 * A missing or unreadable token counts as needing refresh — the safe direction,
 * since the alternative is sending a request certain to fail.
 */
export function needsRefresh(
  accessToken: string | undefined,
  skewMs = CLOCK_SKEW_MS,
): boolean {
  if (!accessToken) return true;

  const expiresAt = decodeExpiry(accessToken);
  if (expiresAt === null) return true;

  return expiresAt - Date.now() <= skewMs;
}

/** Seconds left on a token, clamped at zero: a negative `max-age` would delete
 *  the cookie rather than leave it to expire. */
export function secondsUntilExpiry(
  token: string,
  fallbackSeconds: number,
): number {
  const expiresAt = decodeExpiry(token);
  if (expiresAt === null) return fallbackSeconds;
  return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
}
