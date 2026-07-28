import { NextResponse, type NextRequest } from "next/server";
import { refreshSingleFlight } from "@/lib/server/refresh";
import {
  ACCESS_COOKIE,
  applySessionToResponse,
  decodeExpiry,
  needsRefresh,
  REFRESH_COOKIE,
} from "@/lib/server/session";
import {
  ACCESS_TOKEN_HEADER,
  APP_HOME,
  isGuestOnlyPath,
  isProtectedPath,
  LOGIN_PATH,
} from "@/lib/server/routes";

/**
 * Two jobs, both cheap: rotate an expiring access token, and redirect on
 * obviously-missing or obviously-present sessions.
 *
 * This is the **only** place a refresh can happen. Server components cannot set
 * cookies, so a refresh triggered inside one could not persist the rotated pair
 * — and the API rotates and single-uses refresh tokens, so a lost rotation
 * leaves the browser holding a token the server has retired. The proxy can write
 * cookies, and it runs before the request reaches anything else.
 *
 * It is deliberately not an authorisation layer. The redirect below is a
 * convenience, not a security boundary: it checks that a cookie exists, not that
 * it is valid. Every layout, loader and route handler verifies for itself, which
 * is also what Next's own guidance requires — a matcher that excludes a path
 * silently skips the proxy for server functions on that path.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public marketing pages never need a token, so they do no work here and stay
  // statically servable.
  const relevant = isProtectedPath(pathname) || pathname.startsWith("/api");
  if (!relevant) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  let effectiveAccessToken = accessToken;

  if (refreshToken && needsRefresh(accessToken)) {
    try {
      const pair = await refreshSingleFlight(refreshToken);
      effectiveAccessToken = pair.accessToken;

      const response = nextWithToken(request, effectiveAccessToken);
      applySessionToResponse(response, pair);
      return finish(request, response, effectiveAccessToken);
    } catch {
      // Someone may have rotated this token already, in which case the failure
      // is a race rather than a dead session. Do not clear the cookies: the
      // winner's cookies are good, and clearing them here would sign the reader
      // out for losing a millisecond-wide race.
      //
      // The old access token is still usable if it has not actually expired,
      // which is the common shape of that race.
      const expiresAt = accessToken ? decodeExpiry(accessToken) : null;
      effectiveAccessToken =
        expiresAt !== null && expiresAt > Date.now() ? accessToken : undefined;
    }
  }

  return finish(request, nextWithToken(request, undefined), effectiveAccessToken);
}

/** Passes a rotated token downstream, and strips any inbound copy so a client
 *  cannot inject one. */
function nextWithToken(request: NextRequest, token: string | undefined) {
  const headers = new Headers(request.headers);
  headers.delete(ACCESS_TOKEN_HEADER);
  if (token) headers.set(ACCESS_TOKEN_HEADER, token);
  return NextResponse.next({ request: { headers } });
}

function finish(
  request: NextRequest,
  response: NextResponse,
  accessToken: string | undefined,
) {
  const { pathname } = request.nextUrl;

  if (!accessToken && isProtectedPath(pathname)) {
    const login = new URL(LOGIN_PATH, request.url);
    // Remember where they were headed, so signing in resumes rather than
    // dumping them on a generic landing page.
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (accessToken && isGuestOnlyPath(pathname)) {
    return NextResponse.redirect(new URL(APP_HOME, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except Next's own assets and static files. `/api` is included
     * on purpose: the route handlers depend on the token rotation above, and a
     * matcher that skipped them would leave them operating on expired tokens.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
