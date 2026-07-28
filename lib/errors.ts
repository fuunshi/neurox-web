import type { ErrorEnvelope } from "./api-types";

/**
 * One error type for everything that can go wrong talking to the API, so
 * callers branch on `kind` instead of on status codes and message prose.
 */
export type ApiErrorKind =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation"
  | "rate_limited"
  | "payload_too_large"
  | "server"
  | "network"
  | "unknown";

const KIND_BY_STATUS: Record<number, ApiErrorKind> = {
  400: "validation",
  401: "unauthenticated",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  413: "payload_too_large",
  422: "validation",
  429: "rate_limited",
};

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  /** Always a list. The API sends a string for thrown exceptions and a
   *  `string[]` for validation failures; normalising here means no caller has
   *  to ask which. */
  readonly messages: string[];
  /** Machine-readable marker when the API sends one, e.g.
   *  `ACCOUNT_RECOVERABLE`. */
  readonly code?: string;
  /** Set alongside `ACCOUNT_RECOVERABLE`: when the address frees up. */
  readonly recoverableUntil?: string;
  /** Include this when reporting a problem — it identifies the request in the
   *  server's logs. */
  readonly requestId?: string;
  /** Per-field messages, when class-validator prose could be attributed to a
   *  field. Anything unattributable stays in `messages`. */
  readonly fieldErrors: Record<string, string>;

  constructor(init: {
    kind: ApiErrorKind;
    messages: string[];
    status?: number;
    code?: string;
    recoverableUntil?: string;
    requestId?: string;
    fieldErrors?: Record<string, string>;
    cause?: unknown;
  }) {
    super(init.messages[0] ?? "Something went wrong.");
    this.name = "ApiError";
    this.kind = init.kind;
    this.status = init.status;
    this.messages = init.messages;
    this.code = init.code;
    this.recoverableUntil = init.recoverableUntil;
    this.requestId = init.requestId;
    this.fieldErrors = init.fieldErrors ?? {};
    if (init.cause !== undefined) this.cause = init.cause;
  }

  /** A single line suitable for a banner or a toast. */
  get summary(): string {
    return this.messages[0] ?? "Something went wrong.";
  }

  get isRecoverableAccount(): boolean {
    return this.code === "ACCOUNT_RECOVERABLE";
  }
}

/**
 * Turns a response into an ApiError.
 *
 * The body may be anything — a proxy's HTML error page, an empty 502 — so every
 * step is defensive and there is always a usable message.
 */
export async function apiErrorFromResponse(
  response: Response,
): Promise<ApiError> {
  const status = response.status;
  const kind = KIND_BY_STATUS[status] ?? (status >= 500 ? "server" : "unknown");

  let body: Partial<ErrorEnvelope> | null = null;
  try {
    body = (await response.json()) as Partial<ErrorEnvelope>;
  } catch {
    // Not JSON, or empty. Fall through to a status-based message.
  }

  const messages = normalizeMessages(body?.message);
  const requestId =
    typeof body?.requestId === "string" ? body.requestId : undefined;

  return new ApiError({
    kind,
    status,
    messages:
      messages.length > 0 ? messages : [fallbackMessage(status, kind)],
    code: typeof body?.code === "string" ? body.code : undefined,
    recoverableUntil:
      typeof (body as { recoverableUntil?: unknown })?.recoverableUntil ===
      "string"
        ? (body as { recoverableUntil: string }).recoverableUntil
        : undefined,
    requestId,
    fieldErrors: attributeToFields(messages),
  });
}

export function networkError(cause: unknown): ApiError {
  return new ApiError({
    kind: "network",
    messages: [
      "Could not reach the server. Check your connection and try again.",
    ],
    cause,
  });
}

function fallbackMessage(status: number, kind: ApiErrorKind): string {
  switch (kind) {
    case "rate_limited":
      return "Too many requests just now. Try again in a moment.";
    case "payload_too_large":
      return "That file is larger than the 10 MB limit.";
    case "server":
      return "The server ran into a problem. Trying again often works.";
    default:
      return `Request failed (${status}).`;
  }
}

/** `string | string[] | undefined` into a clean, de-duplicated list. */
export function normalizeMessages(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) {
    return [
      ...new Set(
        value
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ];
  }
  return [];
}

/**
 * Fields a message can be attributed to. Ordered longest-first at match time so
 * `confirmPassword` is not swallowed by `password`.
 */
const KNOWN_FIELDS = [
  "confirmPassword",
  "newConfirmationPassword",
  "currentPassword",
  "newPassword",
  "firstName",
  "lastName",
  "phoneNumber",
  "description",
  "username",
  "password",
  "deckId",
  "sourceId",
  "maxCards",
  "email",
  "title",
  "front",
  "back",
  "hint",
  "text",
  "token",
  "otp",
];

/**
 * class-validator emits prose, not field names, so this is a best-effort
 * attribution and deliberately not clever: a message is assigned to a field
 * only when it *starts* with that field's name. Anything else stays a
 * form-level error rather than being dropped or misfiled.
 *
 * "property foo should not exist" is the `forbidNonWhitelisted` case and names
 * its field explicitly.
 */
export function attributeToFields(
  messages: string[],
): Record<string, string> {
  const fields: Record<string, string> = {};
  const ordered = [...KNOWN_FIELDS].sort((a, b) => b.length - a.length);

  for (const message of messages) {
    const notAllowed = /^property (\w+) should not exist/i.exec(message);
    if (notAllowed) {
      fields[notAllowed[1]] = message;
      continue;
    }

    const lower = message.toLowerCase();
    for (const field of ordered) {
      if (lower.startsWith(field.toLowerCase())) {
        const next = lower.charAt(field.length);
        // Must be a word boundary, so `emailishValue` does not match `email`.
        if (next === "" || !/[a-z0-9]/.test(next)) {
          fields[field] ??= message;
          break;
        }
      }
    }
  }

  return fields;
}

/* -------------------------------------------------------------------------- */
/* Crossing the wire                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Errors thrown inside a route handler cannot be thrown at the browser, so they
 * travel as JSON. This is that shape — deliberately a plain object, since it has
 * to survive `JSON.stringify`. The class methods (`summary`,
 * `isRecoverableAccount`) are reattached by `deserializeError`.
 */
export interface SerializedApiError {
  kind: ApiErrorKind;
  status?: number;
  messages: string[];
  code?: string;
  recoverableUntil?: string;
  requestId?: string;
  fieldErrors: Record<string, string>;
}

export function serializeError(error: unknown): SerializedApiError {
  if (error instanceof ApiError) {
    return {
      kind: error.kind,
      status: error.status,
      messages: error.messages,
      code: error.code,
      recoverableUntil: error.recoverableUntil,
      requestId: error.requestId,
      fieldErrors: error.fieldErrors,
    };
  }

  return {
    kind: "unknown",
    messages: ["Something went wrong. Please try again."],
    fieldErrors: {},
  };
}

export function deserializeError(payload: SerializedApiError): ApiError {
  return new ApiError({
    kind: payload.kind ?? "unknown",
    status: payload.status,
    messages:
      Array.isArray(payload.messages) && payload.messages.length > 0
        ? payload.messages
        : ["Something went wrong. Please try again."],
    code: payload.code,
    recoverableUntil: payload.recoverableUntil,
    requestId: payload.requestId,
    fieldErrors: payload.fieldErrors ?? {},
  });
}

/* -------------------------------------------------------------------------- */
/* Recognising specific backend states                                         */
/* -------------------------------------------------------------------------- */

const LOCKOUT = /Locked Until:\s*(\S+)/i;

/**
 * The lockout timestamp is embedded in the 401 message. Returned as a Date so
 * callers can render a relative time and the absolute local time, rather than
 * showing the reader a raw ISO string.
 */
export function parseLockoutUntil(error: ApiError): Date | null {
  for (const message of error.messages) {
    const match = LOCKOUT.exec(message);
    if (match) {
      const date = new Date(match[1]);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }
  return null;
}

/** The one 401 that means "this account exists but is not confirmed yet". */
export function isUnverifiedEmail(error: ApiError): boolean {
  return (
    error.kind === "unauthenticated" &&
    error.messages.some((message) => /verify your email/i.test(message))
  );
}
