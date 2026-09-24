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
 * Change a password, in one of two situations.
 *
 *  - **Forced**, straight after signing in with `step: UPDATE_PASSWORD`. The
 *    request acts on the short-lived temporary token in the `nx_tmp` cookie,
 *    which the browser cannot read.
 *  - **Voluntary**, from account settings, acting on the normal access token.
 *
 * The API accepts either token type here, so the only decision is which to
 * prefer — and the temporary one has to win when it exists, since that is the
 * one the forced flow was issued for.
 *
 * The API revokes all of the user's tokens on success, so the session is cleared
 * afterwards either way. The forced path issues nothing to replace it, which is
 * why both paths end at the sign-in page.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const body = await readJsonBody(request);
    const currentPassword = requireString(
      body,
      "currentPassword",
      "Current password",
    );
    const newPassword = requireString(body, "newPassword", "New password");
    const newConfirmationPassword = requireString(
      body,
      "newConfirmationPassword",
      "Password confirmation",
    );

    const session = await readSession();
    const token = session.tempToken ?? session.accessToken;

    await upstreamJson<{ message: string }>("/auth/update-password", {
      method: "POST",
      body: { currentPassword, newPassword, newConfirmationPassword },
      token,
      clientIp: clientIp(request),
    });

    await clearSession();
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
