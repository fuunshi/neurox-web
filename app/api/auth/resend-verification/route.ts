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
 * Ask for a new verification link.
 *
 * Public, because the reader this is for cannot usefully sign in — that is what
 * being unverified means. The API answers identically whether or not the
 * address belongs to an unverified account, so this must not turn that
 * uniformity into a difference in the UI.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const body = await readJsonBody(request);
    const email = requireString(body, "email", "Email");

    await upstreamJson<{ message: string }>("/auth/resend-verification", {
      method: "POST",
      body: { email },
      clientIp: clientIp(request),
    });

    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
