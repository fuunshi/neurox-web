import { requireString, requireTrimmed } from "@/lib/server/body";
import {
  assertSameOrigin,
  clientIp,
  jsonError,
  jsonOk,
  readJsonBody,
} from "@/lib/server/handler";
import { upstreamJson } from "@/lib/server/upstream";

/**
 * Restore a soft-deleted account inside its grace period.
 *
 * Reachable from two places: registration answering 409 with
 * `ACCOUNT_RECOVERABLE`, and the recovery screen directly. Ownership is proven
 * with the original password.
 *
 * No tokens are issued on success — the restored account still has to sign in,
 * so the client confirms and sends the reader to the sign-in form.
 *
 * A 401 here cannot distinguish "no recoverable account", "wrong password" and
 * "the window has closed": the API reports all three the same way. The screen's
 * copy has to cover all three honestly rather than guessing which one it was.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const body = await readJsonBody(request);
    const email = requireTrimmed(body, "email", "Email");
    const password = requireString(body, "password", "Password");

    await upstreamJson<{ message: string }>("/auth/recover-account", {
      method: "POST",
      body: { email, password },
      clientIp: clientIp(request),
    });

    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
