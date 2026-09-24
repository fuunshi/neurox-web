import { requireString } from "@/lib/server/body";
import {
  assertSameOrigin,
  clientIp,
  jsonError,
  jsonOk,
  readJsonBody,
} from "@/lib/server/handler";
import { upstreamJson } from "@/lib/server/upstream";

/**
 * Request a reset link.
 *
 * The API answers identically whether or not the address exists — deliberately
 * non-enumerable, so this endpoint cannot be used to discover which addresses
 * are registered. The client must therefore show the same confirmation either
 * way; a different message per outcome would undo that.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const body = await readJsonBody(request);
    const email = requireString(body, "email", "Email");

    await upstreamJson<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: { email },
      clientIp: clientIp(request),
    });

    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
