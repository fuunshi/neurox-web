import {
  isStepUp,
  type LoginResult,
  type MessageResponse,
  type MfaSetup,
} from "@/lib/api-types";
import { ApiError } from "@/lib/errors";
import { requireString } from "@/lib/server/body";
import {
  assertSameOrigin,
  clientIp,
  jsonError,
  jsonOk,
  readJsonBody,
} from "@/lib/server/handler";
import { persistSession, readSession } from "@/lib/server/session";
import { upstreamJson } from "@/lib/server/upstream";

/**
 * The four MFA endpoints behind one route, because they share the same
 * token-selection problem and differ only in which token type is acceptable.
 *
 *  - `setup`   — start enrolling an authenticator. Accepts a temporary token
 *                (forced enrolment after sign-in) or an access token (from
 *                settings).
 *  - `enable`  — confirm the first code. Accepts either, **and its response
 *                shape depends on which**: via the temporary token it returns a
 *                full token pair, via the access token it returns only a
 *                message. Both are handled.
 *  - `verify`  — complete a sign-in that was challenged for MFA. Temporary
 *                token only.
 *  - `disable` — turn MFA off. Access token only, so it can never be done with
 *                a half-authenticated session.
 */
const ACTIONS = ["setup", "enable", "verify", "disable"] as const;
type Action = (typeof ACTIONS)[number];

function isAction(value: string): value is Action {
  return (ACTIONS as readonly string[]).includes(value);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    assertSameOrigin(request);

    const { action } = await params;
    if (!isAction(action)) {
      throw new ApiError({
        kind: "not_found",
        status: 404,
        messages: ["Unknown authentication step."],
      });
    }

    const session = await readSession();
    const ip = clientIp(request);

    if (action === "verify") {
      const otp = requireString(await readJsonBody(request), "otp", "Code");
      const result = await upstreamJson<LoginResult>("/auth/mfa/verify", {
        method: "POST",
        body: { otp },
        token: session.tempToken,
        clientIp: ip,
      });

      // A challenged sign-in always ends in a token pair, never another step.
      if (isStepUp(result)) {
        throw new ApiError({
          kind: "server",
          status: 500,
          messages: ["That sign-in could not be completed. Start again."],
        });
      }

      await persistSession({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
      return jsonOk({ ok: true, user: { id: result.id, name: result.name } });
    }

    if (action === "disable") {
      const otp = requireString(await readJsonBody(request), "otp", "Code");
      await upstreamJson<MessageResponse>("/auth/mfa/disable", {
        method: "POST",
        body: { otp },
        token: session.accessToken,
        clientIp: ip,
      });
      return jsonOk({ ok: true });
    }

    // `setup` and `enable` act on whichever token the flow issued.
    const token = session.tempToken ?? session.accessToken;

    if (action === "setup") {
      const setup = await upstreamJson<MfaSetup>("/auth/mfa/setup", {
        method: "POST",
        token,
        clientIp: ip,
      });
      return jsonOk({ ok: true, setup });
    }

    const otp = requireString(await readJsonBody(request), "otp", "Code");
    const result = await upstreamJson<LoginResult | MessageResponse>(
      "/auth/mfa/enable",
      { method: "POST", body: { otp }, token, clientIp: ip },
    );

    // Came back with a session (enrolling via the forced flow), or with just a
    // message (enrolling from settings while already signed in).
    if ("accessToken" in result) {
      await persistSession({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    }

    return jsonOk({ ok: true, signedIn: "accessToken" in result });
  } catch (error) {
    return jsonError(error);
  }
}
