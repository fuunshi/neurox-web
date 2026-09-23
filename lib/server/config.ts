/**
 * Server-only configuration.
 *
 * Nothing here is `NEXT_PUBLIC_*`. Ordinary requests never leave this app: the
 * browser calls these route handlers, which hold the session and attach the
 * bearer header, so it has no reason to know the API's address.
 *
 * The realtime socket is the one exception, and it is why `BACKEND_BASE_URL` is
 * handed out at all — see `/api/auth/realtime-ticket`. The address is delivered
 * with a ticket rather than compiled into the bundle, so it stays configuration
 * rather than a build input.
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

/**
 * This site's own public origin.
 *
 * Required, because `metadataBase` needs an absolute base and a relative URL
 * field without one is a **build error** in this version — not a warning, and
 * not something that shows up until a page sets an `openGraph` image or a
 * canonical. Canonical links, the sitemap and structured data are all built
 * from it, so it has to be the origin a crawler sees, which is not necessarily
 * the host this app is served on behind a proxy.
 *
 * The default is the dev server's port, so a local build works without
 * configuration. Production must set it: a canonical pointing at localhost is
 * worse than no canonical at all, because it tells a search engine the real
 * page lives somewhere that does not resolve.
 */
export const SITE_URL = required("SITE_URL", "http://localhost:3001");

/** An absolute URL for a site path. The one place `SITE_URL` is concatenated. */
export function siteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
