import { describe, expect, it } from "vitest";
import {
  ApiError,
  apiErrorFromResponse,
  attributeToFields,
  deserializeError,
  isUnverifiedEmail,
  normalizeMessages,
  parseLockoutUntil,
  serializeError,
} from "./errors";

describe("normalizeMessages", () => {
  it("wraps a plain string", () => {
    expect(normalizeMessages("Email is required")).toEqual([
      "Email is required",
    ]);
  });

  it("keeps a batch, which is the shape class-validator produces", () => {
    expect(
      normalizeMessages(["email must be an email", "email should not exist"]),
    ).toEqual(["email must be an email", "email should not exist"]);
  });

  it("drops blanks, trims, and de-duplicates", () => {
    expect(normalizeMessages(["  a  ", "", "   ", "a"])).toEqual(["a"]);
  });

  it("returns nothing for values that are not strings", () => {
    expect(normalizeMessages(undefined)).toEqual([]);
    expect(normalizeMessages({ message: "nope" })).toEqual([]);
    expect(normalizeMessages([1, null, "ok"])).toEqual(["ok"]);
  });
});

describe("attributeToFields", () => {
  it("attributes a message to the field it names", () => {
    expect(attributeToFields(["email must be an email"])).toEqual({
      email: "email must be an email",
    });
  });

  it("prefers the longest matching field name", () => {
    // `confirmPassword` must win over `password`, or a confirmation error would
    // be shown on the wrong input.
    expect(
      attributeToFields(["confirmPassword must match password"]),
    ).toEqual({ confirmPassword: "confirmPassword must match password" });
  });

  it("requires a word boundary, so a prefix is not a match", () => {
    expect(attributeToFields(["emailishThing is wrong"])).toEqual({});
  });

  it("reads the field out of a forbidNonWhitelisted rejection", () => {
    expect(attributeToFields(["property extra should not exist"])).toEqual({
      extra: "property extra should not exist",
    });
  });

  it("leaves unattributable prose alone rather than guessing", () => {
    expect(attributeToFields(["Something went wrong entirely"])).toEqual({});
  });

  it("keeps only the first message per field", () => {
    expect(
      attributeToFields(["title is too long", "title is required"]),
    ).toEqual({ title: "title is too long" });
  });
});

describe("parseLockoutUntil", () => {
  it("pulls the timestamp out of the message the API embeds it in", () => {
    const until = parseLockoutUntil(
      new ApiError({
        kind: "unauthenticated",
        messages: [
          "Account is temporarily locked. Locked Until: 2026-09-24T06:30:00.000Z",
        ],
      }),
    );

    expect(until?.toISOString()).toBe("2026-09-24T06:30:00.000Z");
  });

  it("returns null for an unparseable date rather than an Invalid Date", () => {
    const until = parseLockoutUntil(
      new ApiError({
        kind: "unauthenticated",
        messages: ["Locked Until: not-a-date"],
      }),
    );

    expect(until).toBeNull();
  });

  it("returns null when there is no lockout at all", () => {
    expect(
      parseLockoutUntil(
        new ApiError({ kind: "unauthenticated", messages: ["Wrong password"] }),
      ),
    ).toBeNull();
  });
});

describe("isUnverifiedEmail", () => {
  it("is true only for the message the API sends for an unconfirmed address", () => {
    expect(
      isUnverifiedEmail(
        new ApiError({
          kind: "unauthenticated",
          messages: ["Please verify your email before logging in."],
        }),
      ),
    ).toBe(true);
  });

  it("is false for a plain bad-credentials 401", () => {
    expect(
      isUnverifiedEmail(
        new ApiError({
          kind: "unauthenticated",
          messages: ["Invalid credentials"],
        }),
      ),
    ).toBe(false);
  });
});

describe("apiErrorFromResponse", () => {
  it("reads the error envelope, which uses `status` rather than `success`", async () => {
    const response = new Response(
      JSON.stringify({
        status: false,
        statusCode: 409,
        message: "Email already in use",
        requestId: "req-1",
        code: "ACCOUNT_RECOVERABLE",
        recoverableUntil: "2026-10-01T00:00:00.000Z",
      }),
      { status: 409 },
    );

    const error = await apiErrorFromResponse(response);

    expect(error.kind).toBe("conflict");
    expect(error.summary).toBe("Email already in use");
    expect(error.requestId).toBe("req-1");
    expect(error.isRecoverableAccount).toBe(true);
    expect(error.recoverableUntil).toBe("2026-10-01T00:00:00.000Z");
  });

  it("classifies by status", async () => {
    const cases: Array<[number, string]> = [
      [400, "validation"],
      [403, "forbidden"],
      [404, "not_found"],
      [413, "payload_too_large"],
      [429, "rate_limited"],
      [500, "server"],
      [503, "server"],
    ];

    for (const [status, kind] of cases) {
      const response = new Response(JSON.stringify({ message: "x" }), {
        status,
      });
      expect((await apiErrorFromResponse(response)).kind).toBe(kind);
    }
  });

  it("still produces something useful when the body is not JSON", async () => {
    // A proxy's HTML error page, for instance.
    const response = new Response("<html>Bad Gateway</html>", { status: 502 });
    const error = await apiErrorFromResponse(response);

    expect(error.kind).toBe("server");
    expect(error.messages[0]).toBeTruthy();
  });

  it("gives a rate-limited failure its own wording", async () => {
    const response = new Response("", { status: 429 });
    const error = await apiErrorFromResponse(response);

    expect(error.kind).toBe("rate_limited");
    expect(error.summary).toMatch(/too many/i);
  });
});

describe("serialisation across the wire", () => {
  it("survives a round trip with its meaning intact", () => {
    const original = new ApiError({
      kind: "validation",
      status: 400,
      messages: ["email must be an email", "password is too weak"],
      fieldErrors: { email: "email must be an email" },
      requestId: "req-9",
    });

    const restored = deserializeError(
      JSON.parse(JSON.stringify(serializeError(original))),
    );

    expect(restored.kind).toBe("validation");
    expect(restored.status).toBe(400);
    expect(restored.messages).toEqual(original.messages);
    expect(restored.fieldErrors).toEqual(original.fieldErrors);
    expect(restored.requestId).toBe("req-9");
    expect(restored.summary).toBe("email must be an email");
  });

  it("turns an unknown throw into a safe, generic error", () => {
    const payload = serializeError(new Error("internal detail"));

    // The internal message must not leak to the browser.
    expect(payload.messages.join(" ")).not.toContain("internal detail");
    expect(deserializeError(payload).kind).toBe("unknown");
  });

  it("falls back when messages arrive empty", () => {
    expect(
      deserializeError({ kind: "server", messages: [], fieldErrors: {} })
        .messages[0],
    ).toBeTruthy();
  });
});
