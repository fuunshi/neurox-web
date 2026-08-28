import { requireString } from "@/lib/server/body";
import {
  assertSameOrigin,
  clientIp,
  jsonError,
  jsonOk,
  readJsonBody,
} from "@/lib/server/handler";
import { clearSession, readSession } from "@/lib/server/session";
import { upstreamJson } from "@/lib/server/upstream";

/**
 * Delete the caller's own account.
 *
 * The access token is used deliberately, never the temporary one: a session
 * that is only half-authenticated (mid-MFA, or forced to change a password)
 * should not be able to end an account.
 *
 * The API revokes every token on success, so the local session is cleared here
 * too — otherwise the browser would keep presenting a refresh token the server
 * has already invalidated, and the reader would sit on a signed-in screen that
 * fails on the next request.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const password = requireString(
      await readJsonBody(request),
      "password",
      "Password",
    );

    const session = await readSession();

    const result = await upstreamJson<{
      message: string;
      recoverableUntil: string;
    }>("/auth/delete-account", {
      method: "POST",
      body: { password },
      token: session.accessToken,
      clientIp: clientIp(request),
    });

    await clearSession();
    return jsonOk({ ok: true, recoverableUntil: result.recoverableUntil });
  } catch (error) {
    return jsonError(error);
  }
}
