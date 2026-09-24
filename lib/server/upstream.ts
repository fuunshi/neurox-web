import "server-only";
import type { SuccessEnvelope } from "@/lib/api-types";
import { apiErrorFromResponse, networkError } from "@/lib/errors";
import { apiUrl } from "./config";
import { throttle } from "./throttle";

export interface UpstreamOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Bearer token to send, when the call needs one. */
  token?: string;
  /** Forwarded so the API could key its throttler per user instead of per IP. */
  clientIp?: string | null;
  signal?: AbortSignal;
  /** Multipart bodies pass through untouched. */
  rawBody?: FormData;
}

/**
 * The single place that talks to the API.
 *
 * Everything else — route handlers, server components, the proxy — goes through
 * here, so the envelope, the error shape, timeouts and the outbound rate limit
 * are handled exactly once.
 */
export async function upstreamFetch(
  path: string,
  options: UpstreamOptions = {},
): Promise<Response> {
  const { method = "GET", body, token, clientIp, signal, rawBody } = options;

  const headers: Record<string, string> = { accept: "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  if (clientIp) headers["x-forwarded-for"] = clientIp;

  if (body !== undefined) headers["content-type"] = "application/json";

  await throttle(path, method);

  try {
    return await fetch(apiUrl(path), {
      method,
      headers,
      body: rawBody ?? (body !== undefined ? JSON.stringify(body) : undefined),
      signal,
      // No caching at the fetch layer; caching is decided per loader.
      cache: "no-store",
    });
  } catch (cause) {
    throw networkError(cause);
  }
}

/**
 * Unwraps the `{ success, statusCode, message, data, … }` envelope, or throws
 * the normalised error.
 *
 * `204` responses carry no body at all — the API's deletes answer 204 — so they
 * resolve to `undefined` rather than attempting a parse.
 */
export async function readEnvelope<T>(response: Response): Promise<T> {
  if (response.status === 204 || response.status === 205) {
    return undefined as T;
  }

  if (!response.ok) {
    throw await apiErrorFromResponse(response);
  }

  const text = await response.text();
  if (text.length === 0) return undefined as T;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw networkError(cause);
  }

  // A success response always carries the envelope. If it somehow does not,
  // hand back the body rather than a confusing `undefined`.
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "data" in parsed &&
    "success" in parsed
  ) {
    return (parsed as SuccessEnvelope<T>).data;
  }

  return parsed as T;
}

/** Convenience for the common "call it and give me the payload" case. */
export async function upstreamJson<T>(
  path: string,
  options: UpstreamOptions = {},
): Promise<T> {
  return readEnvelope<T>(await upstreamFetch(path, options));
}
