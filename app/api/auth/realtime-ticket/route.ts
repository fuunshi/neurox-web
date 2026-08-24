import { ApiError } from "@/lib/errors";
import {
  assertSameOrigin,
  clientIp,
  jsonError,
  jsonOk,
} from "@/lib/server/handler";
import { readSession } from "@/lib/server/session";
import { upstreamJson } from "@/lib/server/upstream";
import { BACKEND_BASE_URL } from "@/lib/server/config";

/**
 * Mints a ticket for the realtime socket, and says where to open it.
 *
 * ## Why the socket needs its own credential
 *
 * Everything else the browser asks for goes through this app's route handlers,
 * which hold the session in httpOnly cookies that JavaScript cannot read. A
 * WebSocket cannot be served that way: Next.js route handlers are request-scoped
 * and cannot hold a connection open, so the socket connects to the API directly.
 * A direct connection cannot carry this origin's cookie, and even if it could,
 * the browser would be holding a full session credential.
 *
 * So the API mints a ticket that is typed `REALTIME`, carries nothing but the
 * user id, expires in a minute, and is refused by every REST route — see
 * `realtime.ticket.ts` on the API side. The browser holds that instead of the
 * session.
 *
 * ## Why the URL comes from here too
 *
 * The socket address is returned with the ticket rather than baked into the
 * client as a `NEXT_PUBLIC_` variable. It then stays server configuration, so
 * changing it is a redeploy of this app's config rather than a rebuild of the
 * bundle — and the address is never in the JavaScript until the moment it is
 * needed. It is still an address the browser learns, which is a real departure
 * from the rest of this app and is called out in the README.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const session = await readSession();

    if (!session.accessToken) {
      throw new ApiError({
        kind: "unauthenticated",
        status: 401,
        messages: ["Sign in to open the realtime connection."],
      });
    }

    const result = await upstreamJson<{
      ticket: string;
      expiresInSeconds: number;
    }>("/auth/realtime-ticket", {
      method: "POST",
      token: session.accessToken,
      clientIp: clientIp(request),
    });

    return jsonOk({
      ok: true,
      ticket: result.ticket,
      expiresInSeconds: result.expiresInSeconds,
      // `/realtime` is the Socket.IO namespace, matching the API's gateway.
      url: `${BACKEND_BASE_URL}/realtime`,
    });
  } catch (error) {
    return jsonError(error);
  }
}
