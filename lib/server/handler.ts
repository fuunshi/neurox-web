import "server-only";
import { ApiError, serializeError } from "@/lib/errors";

/**
 * Shared plumbing for the BFF route handlers: one error shape out, one place
 * that enforces same-origin writes.
 */

export function jsonOk<T>(data: T, status = 200): Response {
  return Response.json(data as unknown as Record<string, unknown>, { status });
}

/** Always `{ error: SerializedApiError }`, so the client has exactly one shape
 *  to rehydrate. */
export function jsonError(error: unknown): Response {
  const payload = serializeError(error);
  const status =
    error instanceof ApiError && error.status && error.status >= 400
      ? error.status
      : 500;

  return Response.json({ error: payload }, { status });
}

/**
 * CSRF guard for state-changing route handlers.
 *
 * Session cookies are `sameSite=lax`, which already blocks cross-site POSTs from
 * a form, and `fetch` from another origin would need CORS approval this app never
 * grants. This closes the remaining gap for anything that slips past both: a
 * request whose `Origin` is present and does not match the host it arrived on is
 * rejected.
 *
 * A missing `Origin` is allowed — same-origin requests from older browsers and
 * non-browser callers omit it, and a cross-site attacker cannot omit it while
 * also sending cookies.
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;

  const host = request.headers.get("host");
  if (!host) return;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError({
      kind: "forbidden",
      status: 403,
      messages: ["That request could not be verified."],
    });
  }

  if (originHost !== host) {
    throw new ApiError({
      kind: "forbidden",
      status: 403,
      messages: ["That request could not be verified."],
    });
  }
}

/**
 * Reads a JSON body, tolerating an empty one. Returns `{}` rather than throwing
 * so a handler can validate what it needs.
 */
export async function readJsonBody(
  request: Request,
): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (typeof body === "object" && body !== null && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
  } catch {
    // Empty or not JSON.
  }
  return {};
}

/** The caller's IP, forwarded so the API can throttle per reader rather than
 *  per server once it trusts the header. */
export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return request.headers.get("x-real-ip");
}
