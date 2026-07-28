import { assertSameOrigin, jsonError, jsonOk } from "@/lib/server/handler";
import { clearSession, readSession } from "@/lib/server/session";
import { upstreamFetch } from "@/lib/server/upstream";

/**
 * Sign out.
 *
 * The API's logout revokes **every** token belonging to the user, on every
 * device — that is its documented behaviour, not a bug here. The UI says so
 * rather than letting it be a surprise.
 *
 * Cookies are cleared whatever the API answers. A failed revoke is a reason to
 * report a problem, not a reason to leave someone stuck looking at a signed-in
 * interface they asked to leave.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const { accessToken } = await readSession();

    if (accessToken) {
      try {
        await upstreamFetch("/auth/logout", {
          method: "POST",
          token: accessToken,
        });
      } catch {
        // Network failure or an already-revoked token. Clearing the session
        // below is still the right outcome.
      }
    }

    await clearSession();
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
