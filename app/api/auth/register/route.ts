import type { RegisteredUser } from "@/lib/api-types";
import { optionalString, requireString, requireTrimmed } from "@/lib/server/body";
import {
  assertSameOrigin,
  clientIp,
  jsonError,
  jsonOk,
  readJsonBody,
} from "@/lib/server/handler";
import { upstreamJson } from "@/lib/server/upstream";

/**
 * Create an account.
 *
 * Deliberately returns no session: the API answers with the user and nothing
 * else, because signing in is gated on confirming the email address. The client
 * is expected to land on "check your inbox", not in the app.
 *
 * A 409 here may carry `code: "ACCOUNT_RECOVERABLE"` with a `recoverableUntil`
 * timestamp — the address belongs to a recently deleted account, and the fix is
 * to restore that account rather than to register again. It reaches the client
 * unchanged so the form can route there.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const body = await readJsonBody(request);

    const payload = {
      firstName: requireTrimmed(body, "firstName", "First name"),
      lastName: optionalString(body, "lastName"),
      email: requireTrimmed(body, "email", "Email"),
      username: requireTrimmed(body, "username", "Username").toLowerCase(),
      password: requireString(body, "password", "Password"),
      confirmPassword: requireString(body, "confirmPassword", "Password"),
      phoneNumber: optionalString(body, "phoneNumber"),
    };

    const user = await upstreamJson<RegisteredUser>("/user/register", {
      method: "POST",
      body: payload,
      clientIp: clientIp(request),
    });

    return jsonOk({ ok: true, email: user.email, username: user.username }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
