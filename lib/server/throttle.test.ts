import { describe, expect, it } from "vitest";
import { routeTemplate } from "./throttle";

/**
 * The key matters as much as the limit. The API throttles per *handler*, so
 * keying the local limiter by the literal path would give every distinct id its
 * own budget and enforce nothing at all.
 */
describe("routeTemplate", () => {
  it("collapses a uuid to :id", () => {
    expect(
      routeTemplate(
        "/decks/8f2b1c4d-1111-2222-3333-444455556666/cards",
        "GET",
      ),
    ).toBe("GET /decks/:id/cards");
  });

  it("gives two different decks the same bucket", () => {
    const a = routeTemplate(
      "/decks/aaaaaaaa-1111-2222-3333-444455556666",
      "GET",
    );
    const b = routeTemplate(
      "/decks/bbbbbbbb-1111-2222-3333-444455556666",
      "GET",
    );

    expect(a).toBe(b);
  });

  it("collapses a numeric id too", () => {
    expect(routeTemplate("/cards/42", "PATCH")).toBe("PATCH /cards/:id");
  });

  it("keeps fixed segments intact", () => {
    expect(routeTemplate("/auth/mfa/setup", "POST")).toBe(
      "POST /auth/mfa/setup",
    );
  });

  it("drops the query string", () => {
    // Otherwise every cursor page would be its own bucket.
    expect(routeTemplate("/decks?limit=20&cursor=abc", "GET")).toBe(
      "GET /decks",
    );
  });

  it("separates methods, since the API does too", () => {
    expect(routeTemplate("/decks", "GET")).not.toBe(
      routeTemplate("/decks", "POST"),
    );
  });
});
