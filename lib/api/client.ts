"use client";

import {
  ApiError,
  deserializeError,
  networkError,
  type SerializedApiError,
} from "@/lib/errors";

/**
 * The browser's only route to the API: this app's own route handlers.
 *
 * It never learns the API's address — that lives in server config — and never
 * sees a token, which is the point of the whole arrangement. Requests go to
 * `/api/proxy/…` for data and `/api/auth/…` for the session, both same-origin,
 * so there is no CORS to negotiate and no `credentials` juggling.
 */

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** For `POST /sources/upload`, where the payload is a file. */
  formData?: FormData;
  signal?: AbortSignal;
}

async function send(
  url: string,
  { method = "GET", body, formData, signal }: RequestOptions,
): Promise<Response> {
  try {
    return await fetch(url, {
      method,
      signal,
      headers: formData
        ? undefined
        : body !== undefined
          ? { "content-type": "application/json" }
          : undefined,
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
      // Session cookies ride along, same-origin.
      credentials: "same-origin",
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw networkError(cause);
  }
}

async function parse<T>(response: Response): Promise<T> {
  if (response.status === 204 || response.status === 205) {
    return undefined as T;
  }

  const text = await response.text();
  const parsed: unknown = text.length > 0 ? safeJson(text) : undefined;

  if (!response.ok) {
    const payload = (parsed as { error?: SerializedApiError } | undefined)
      ?.error;

    if (payload) throw deserializeError(payload);

    throw new ApiError({
      kind: response.status >= 500 ? "server" : "unknown",
      status: response.status,
      messages: [`Request failed (${response.status}).`],
    });
  }

  return parsed as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Data calls. `path` is relative to the API root, e.g. `decks/123/cards`. */
export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const clean = path.replace(/^\/+/, "");
  return parse<T>(await send(`/api/proxy/${clean}`, options));
}

/** Session calls, which are handled individually because they set cookies. */
export async function authFetch<T>(
  action: string,
  options: RequestOptions = {},
): Promise<T> {
  const clean = action.replace(/^\/+/, "");
  return parse<T>(await send(`/api/auth/${clean}`, options));
}
