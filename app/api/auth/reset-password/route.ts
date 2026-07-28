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
 * Complete a password reset using the token from the emailed link.
 *
 * The DTO takes only `token` and `newPassword` — there is no confirmation field
 * upstream. The confirmation the form shows is therefore a client-side check,
 * which is the right place for it anyway; sending a `confirmPassword` here would
 * be rejected as an unknown property.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const body = await readJsonBody(request);
    const token = requireTrimmed(body, "token", "Reset token");
    const newPassword = requireString(body, "newPassword", "New password");

    await upstreamJson<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: { token, newPassword },
      clientIp: clientIp(request),
    });

    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
