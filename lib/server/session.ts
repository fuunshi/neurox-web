import "server-only";
import { cookies, headers } from "next/headers";
import type { NextResponse } from "next/server";
import type { TokenPair } from "@/lib/api-types";
import { secondsUntilExpiry } from "@/lib/token-expiry";
import { SESSION_COOKIE_SECURE } from "./config";
import { ACCESS_TOKEN_HEADER } from "./routes";

export const ACCESS_COOKIE = "nx_at";
export const REFRESH_COOKIE = "nx_rt";
/**
 * Holds the short-lived `temporaryToken` from a step-up login, so the MFA and
 * forced-password-change screens can act without the browser ever seeing it.
 */
export const TEMP_COOKIE = "nx_tmp";

// Re-exported so callers have a single import for session concerns.
export { decodeExpiry, needsRefresh } from "@/lib/token-expiry";

export interface SessionTokens {
  accessToken?: string;
  refreshToken?: string;
  tempToken?: string;
}

/**
 * A `Secure` cookie is dropped silently by the browser over plain HTTP, with no
 * error anywhere — which presents as a login that appears to work and then
 * immediately forgets you. `SESSION_COOKIE_SECURE` therefore comes from config
 * and is false in development, rather than being hardcoded to production.
 */
function baseCookie(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: SESSION_COOKIE_SECURE,
    path: "/",
    maxAge,
  };
}

const ACCESS_FALLBACK_SECONDS = 60 * 60 * 24; // JWT_EXPIRES_IN=1d
const REFRESH_FALLBACK_SECONDS = 60 * 60 * 24 * 7; // REFRESH_TOKEN_EXPIRES_IN=7d
const TEMP_FALLBACK_SECONDS = 60 * 15; // MFA_TEMP_TOKEN_EXPIRES_IN=15m

/* -------------------------------------------------------------------------- */
/* Reading — request scope                                                     */
/* -------------------------------------------------------------------------- */

export async function readSession(): Promise<SessionTokens> {
  const jar = await cookies();

  // The proxy's rotated token wins over the cookie. When it refreshes, it writes
  // the new pair to the *response*, which this request's cookie jar knows
  // nothing about — so without this the whole request would keep using the token
  // that was just replaced. The header is stripped on the way in, so it cannot
  // be supplied by a client.
  const rotated = (await headers()).get(ACCESS_TOKEN_HEADER);

  return {
    accessToken: rotated ?? jar.get(ACCESS_COOKIE)?.value,
    refreshToken: jar.get(REFRESH_COOKIE)?.value,
    tempToken: jar.get(TEMP_COOKIE)?.value,
  };
}

/* -------------------------------------------------------------------------- */
/* Writing — route handlers and server actions                                 */
/* -------------------------------------------------------------------------- */

export async function persistSession(pair: TokenPair): Promise<void> {
  const jar = await cookies();
  jar.set(
    ACCESS_COOKIE,
    pair.accessToken,
    baseCookie(secondsUntilExpiry(pair.accessToken, ACCESS_FALLBACK_SECONDS)),
  );
  jar.set(
    REFRESH_COOKIE,
    pair.refreshToken,
    baseCookie(
      secondsUntilExpiry(pair.refreshToken, REFRESH_FALLBACK_SECONDS),
    ),
  );
  // A completed login supersedes any half-finished step-up.
  jar.delete(TEMP_COOKIE);
}

export async function persistTempToken(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(
    TEMP_COOKIE,
    token,
    baseCookie(secondsUntilExpiry(token, TEMP_FALLBACK_SECONDS)),
  );
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
  jar.delete(TEMP_COOKIE);
}

/* -------------------------------------------------------------------------- */
/* Writing — the proxy, which has a response rather than a request scope        */
/* -------------------------------------------------------------------------- */

export function applySessionToResponse(
  response: NextResponse,
  pair: TokenPair,
): void {
  response.cookies.set(
    ACCESS_COOKIE,
    pair.accessToken,
    baseCookie(secondsUntilExpiry(pair.accessToken, ACCESS_FALLBACK_SECONDS)),
  );
  response.cookies.set(
    REFRESH_COOKIE,
    pair.refreshToken,
    baseCookie(
      secondsUntilExpiry(pair.refreshToken, REFRESH_FALLBACK_SECONDS),
    ),
  );
}

export function clearSessionOnResponse(response: NextResponse): void {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, TEMP_COOKIE]) {
    response.cookies.set(name, "", { ...baseCookie(0), maxAge: 0 });
  }
}
