import { describe, expect, it } from "vitest";
import { decodeExpiry, needsRefresh, secondsUntilExpiry } from "./token-expiry";

/**
 * Tokens here are fabricated, not signed. That is fine — `decodeExpiry`
 * deliberately does not verify, and these tests exist to pin down the arithmetic
 * and the malformed-input behaviour, not the signature.
 */
function tokenWithExpiry(expSeconds: number | string): string {
  const payload = { sub: "u1", exp: expSeconds };
  const base64url = (value: object) =>
    btoa(JSON.stringify(value))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  return `${base64url({ alg: "HS256", typ: "JWT" })}.${base64url(payload)}.signature`;
}

function tokenExpiringIn(seconds: number): string {
  return tokenWithExpiry(Math.floor(Date.now() / 1000) + seconds);
}

describe("decodeExpiry", () => {
  it("reads exp and converts it to milliseconds", () => {
    const expiresAt = decodeExpiry(tokenWithExpiry(1_800_000_000));
    expect(expiresAt).toBe(1_800_000_000_000);
  });

  it("handles a base64url payload containing - and _", () => {
    // Chosen so the encoded payload produces URL-safe characters; a naive
    // atob() without the substitutions returns garbage.
    const token = tokenWithExpiry(1_777_777_777);
    expect(decodeExpiry(token)).toBe(1_777_777_777_000);
  });

  it("returns null for a token that is not three parts", () => {
    expect(decodeExpiry("not-a-jwt")).toBeNull();
    expect(decodeExpiry("a.b")).toBeNull();
    expect(decodeExpiry("")).toBeNull();
  });

  it("returns null when the payload is not decodable JSON", () => {
    expect(decodeExpiry("aaa.bbb.ccc")).toBeNull();
  });

  it("returns null when there is no exp claim", () => {
    const noExp = btoa(JSON.stringify({ sub: "u1" }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    expect(decodeExpiry(`header.${noExp}.sig`)).toBeNull();
  });

  it("returns null when exp is not a number", () => {
    expect(decodeExpiry(tokenWithExpiry("soon"))).toBeNull();
  });
});

describe("needsRefresh", () => {
  it("is true when there is no token, which is the safe direction", () => {
    expect(needsRefresh(undefined)).toBe(true);
    expect(needsRefresh("")).toBe(true);
  });

  it("is false for a token with plenty of life left", () => {
    expect(needsRefresh(tokenExpiringIn(3600))).toBe(false);
  });

  it("is true for a token that has already expired", () => {
    expect(needsRefresh(tokenExpiringIn(-60))).toBe(true);
  });

  it("is true inside the skew window, so an in-flight request cannot lose its token", () => {
    // Default skew is 60s: a token expiring in 30s is replaced now rather than
    // mid-request.
    expect(needsRefresh(tokenExpiringIn(30))).toBe(true);
    expect(needsRefresh(tokenExpiringIn(30), 0)).toBe(false);
  });

  it("treats an unreadable token as needing refresh", () => {
    expect(needsRefresh("garbage")).toBe(true);
  });
});

describe("secondsUntilExpiry", () => {
  it("rounds down to whole seconds", () => {
    const seconds = secondsUntilExpiry(tokenExpiringIn(600), 999);
    expect(seconds).toBeGreaterThanOrEqual(598);
    expect(seconds).toBeLessThanOrEqual(600);
  });

  it("clamps at zero rather than going negative", () => {
    // A negative max-age deletes a cookie instead of letting it lapse.
    expect(secondsUntilExpiry(tokenExpiringIn(-500), 999)).toBe(0);
  });

  it("falls back when the token cannot be read", () => {
    expect(secondsUntilExpiry("garbage", 1234)).toBe(1234);
  });
});
