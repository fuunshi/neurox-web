import "server-only";
import type { TokenPair } from "@/lib/api-types";
import { upstreamJson } from "./upstream";

/**
 * Exchanges a refresh token for a new pair.
 *
 * The token is sent **twice, deliberately**: the API's guard reads the
 * `Authorization` header and is decorated to accept a REFRESH token there, while
 * `RefreshDTO` separately requires it in the body. Sending only one of the two
 * fails — the header alone is a 400, the body alone is a 401.
 */
export async function refreshTokens(refreshToken: string): Promise<TokenPair> {
  return upstreamJson<TokenPair>("/auth/refresh", {
    method: "POST",
    token: refreshToken,
    body: { refreshToken },
  });
}

/**
 * In-flight refreshes, keyed by the refresh token they are using.
 *
 * This is not an optimisation. The API **rotates and single-uses** refresh
 * tokens: it verifies the incoming one, revokes it, and issues a new pair. Two
 * concurrent refreshes therefore both pass verification, both revoke, and one of
 * the resulting pairs is orphaned — after which that browser holds a token the
 * server has already retired.
 *
 * Sharing the flight by token value collapses those callers onto one upstream
 * call. Callers that arrive *after* a flight finished are handled by the caller
 * re-reading its cookie, since by then it holds the rotated value.
 */
const flights = new Map<string, Promise<TokenPair>>();

export function refreshSingleFlight(refreshToken: string): Promise<TokenPair> {
  const existing = flights.get(refreshToken);
  if (existing) return existing;

  const flight = refreshTokens(refreshToken).finally(() => {
    flights.delete(refreshToken);
  });

  flights.set(refreshToken, flight);
  return flight;
}
