import { isStepUp, type LoginResult } from "@/lib/api-types";
import {
  assertSameOrigin,
  clientIp,
  jsonError,
  jsonOk,
  readJsonBody,
} from "@/lib/server/handler";
import { persistSession, persistTempToken } from "@/lib/server/session";
import { upstreamJson } from "@/lib/server/upstream";
import { requireString } from "@/lib/server/body";

/**
 * Sign in.
 *
 * The response is a union, and two things about it drive this handler:
 *
 *  - It may not contain tokens at all. A step-up challenge
 *    (`UPDATE_PASSWORD`, `MFA_SETUP_REQUIRED`, `MFA_REQUIRED`) carries a
 *    `temporaryToken` instead, so `step` is read before `accessToken`.
 *  - The `temporaryToken` must never reach the browser. It goes straight into an
 *    httpOnly cookie and only the `step` value is echoed back, because a token
 *    the client can read is a token the whole cookie design was meant to avoid.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const body = await readJsonBody(request);
    const email = requireString(body, "email", "Email");
    const password = requireString(body, "password", "Password");

    const result = await upstreamJson<LoginResult>("/auth/login", {
      method: "POST",
      body: { email, password },
      clientIp: clientIp(request),
    });

    if (isStepUp(result)) {
      await persistTempToken(result.temporaryToken);
      return jsonOk({ ok: true, step: result.step });
    }

    await persistSession({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });

    // Enough to greet the reader with. Anything more authoritative is read from
    // the session on the server, not handed to the client.
    return jsonOk({
      ok: true,
      user: {
        id: result.id,
        name: result.name,
        email: result.email,
        role: result.role,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
