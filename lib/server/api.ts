import "server-only";
import { ApiError } from "@/lib/errors";
import { readEnvelope, upstreamFetch, type UpstreamOptions } from "./upstream";
import { clearSession, readSession } from "./session";

export interface ApiFetchOptions extends Omit<UpstreamOptions, "token"> {
  /** Override the Bearer token — used by the step-up flows, which act with a
   *  temporary token rather than an access token. */
  token?: string;
  /** Skip the session lookup entirely, for calls made before sign-in. */
  anonymous?: boolean;
}

/**
 * Authenticated call to the API, for server components, server actions and
 * route handlers.
 *
 * There is deliberately no refresh-and-retry here. The proxy refreshes before
 * the request reaches any of those, and it is the only place that *can*: server
 * components cannot set cookies, so a refresh triggered inside one could not
 * persist the rotated pair. A 401 arriving here therefore means the session is
 * genuinely finished, and the honest response is to clear it and let the next
 * navigation land on the sign-in page.
 */
export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { token, anonymous, ...rest } = options;

  let bearer = token;
  if (bearer === undefined && !anonymous) {
    bearer = (await readSession()).accessToken;
  }

  const response = await upstreamFetch(path, { ...rest, token: bearer });

  if (response.status === 401 && bearer && !token) {
    await clearSession();
    throw new ApiError({
      kind: "unauthenticated",
      status: 401,
      messages: ["Your session has ended. Sign in again to continue."],
    });
  }

  return readEnvelope<T>(response);
}
