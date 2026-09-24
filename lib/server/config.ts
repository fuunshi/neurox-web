/**
 * Server-only configuration.
 *
 * Nothing here is `NEXT_PUBLIC_*`: the browser is never told where the API
 * lives, because it never calls it. Every request goes through this app's own
 * route handlers.
 */

function required(name: string, fallback: string): string {
  const value = process.env[name];
  if (value && value.length > 0) return value.replace(/\/+$/, "");
  return fallback;
}

/**
 * The API's origin. The API serves its routes at the root — there is no
 * `/api` prefix to append (only its Swagger UI sits under `/api/docs`).
 */
export const BACKEND_BASE_URL = required(
  "BACKEND_BASE_URL",
  "http://localhost:3232",
);

/**
 * Whether session cookies carry `Secure`. False by default so that local
 * development over plain HTTP works at all: browsers drop a `Secure` cookie
 * from an `http://` origin without any visible error, which presents as a login
 * that appears to succeed and then immediately forgets you.
 */
export const SESSION_COOKIE_SECURE =
  process.env.SESSION_COOKIE_SECURE === "true" ||
  process.env.NODE_ENV === "production";

/** Builds an absolute API URL from a root-relative path. */
export function apiUrl(path: string): string {
  return `${BACKEND_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
