import "server-only";
import { ApiError } from "@/lib/errors";

/**
 * Field readers for route-handler bodies.
 *
 * The API validates with `whitelist` **and** `forbidNonWhitelisted`, so a body
 * carrying one field the DTO does not declare is a 400 rather than a silently
 * ignored key. Every handler therefore builds its upstream body from named
 * fields — never by spreading the incoming object — and these helpers make that
 * the path of least resistance.
 *
 * `undefined` is safe to include: `JSON.stringify` drops those keys, so an
 * omitted optional field simply does not appear.
 */

export function requireString(
  body: Record<string, unknown>,
  key: string,
  label = key,
): string {
  const value = body[key];
  if (typeof value !== "string" || value.trim() === "") {
    const message = `${label} is required.`;
    throw new ApiError({
      kind: "validation",
      status: 400,
      messages: [message],
      fieldErrors: { [key]: message },
    });
  }
  return value;
}

export function optionalString(
  body: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = body[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** Trims, and reports the field name the API would use. */
export function requireTrimmed(
  body: Record<string, unknown>,
  key: string,
  label = key,
): string {
  return requireString(body, key, label).trim();
}

/** Numbers arriving from a JSON body, with a bounds check. */
export function optionalInt(
  body: Record<string, unknown>,
  key: string,
  { min, max }: { min: number; max: number },
): number | undefined {
  const value = body[key];
  if (value === undefined || value === null || value === "") return undefined;

  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return undefined;

  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}
