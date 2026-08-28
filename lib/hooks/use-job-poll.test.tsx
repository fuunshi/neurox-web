import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", () => ({
  apiFetch: vi.fn(),
}));

/** The socket is captured rather than faked away: these tests are about what
 *  the hook does with a server message, which no REST call can show. */
const handlers = new Map<string, (payload: unknown) => void>();
const subscribed: string[] = [];
const unsubscribed: string[] = [];

vi.mock("@/lib/realtime/client", () => ({
  onRealtimeEvent: (event: string, listener: (payload: unknown) => void) => {
    handlers.set(event, listener);
    return () => handlers.delete(event);
  },
  subscribeTopic: (topic: string) => {
    subscribed.push(topic);
  },
  unsubscribeTopic: (topic: string) => {
    unsubscribed.push(topic);
  },
}));

import { useJobPoll } from "./use-job-poll";

/** Pushes over the captured socket, inside `act` so React flushes the update. */
async function push(event: string, payload: unknown) {
  await act(async () => {
    handlers.get(event)?.(payload);
  });
}

describe("useJobPoll subscriptions", () => {
  beforeEach(() => {
    handlers.clear();
    subscribed.length = 0;
    unsubscribed.length = 0;
  });

  it("asks for the deck's topic, and gives it up on the way out", () => {
    const { unmount } = renderHook(() => useJobPoll("j1", null, "d1"));

    expect(subscribed).toContain("deck:d1");

    unmount();
    expect(unsubscribed).toContain("deck:d1");
  });

  it("notes a refusal of the topic it asked for", async () => {
    const { result } = renderHook(() => useJobPoll("j1", null, "d1"));

    await push("realtime:error", {
      topic: "deck:d1",
      message: "Not allowed to subscribe to that.",
    });

    // Not an error, but not silence either: without this the screen is
    // indistinguishable from a deck where nothing is happening.
    expect(result.current.subscriptionRefused).toBe(true);
  });

  it("ignores a refusal for a topic it did not ask for", async () => {
    const { result } = renderHook(() => useJobPoll("j1", null, "d1"));

    await push("realtime:error", {
      topic: "deck:someone-elses",
      message: "Not allowed to subscribe to that.",
    });

    expect(result.current.subscriptionRefused).toBe(false);
  });

  it("ignores a failed message that names no topic", async () => {
    // What a handler failure looks like. It is not about any subscription, so
    // it must not be read as one having been refused.
    const { result } = renderHook(() => useJobPoll("j1", null, "d1"));

    await push("realtime:error", { message: "Something went wrong." });

    expect(result.current.subscriptionRefused).toBe(false);
  });

  it("does not carry one deck's refusal over to another", async () => {
    const { result, rerender } = renderHook(
      ({ deckId }: { deckId: string }) => useJobPoll("j1", null, deckId),
      { initialProps: { deckId: "d1" } },
    );

    await push("realtime:error", {
      topic: "deck:d1",
      message: "Not allowed to subscribe to that.",
    });
    expect(result.current.subscriptionRefused).toBe(true);

    rerender({ deckId: "d2" });

    // The flag is keyed by topic, so a different deck starts clean rather than
    // inheriting the previous deck's refusal.
    expect(result.current.subscriptionRefused).toBe(false);
  });
});
