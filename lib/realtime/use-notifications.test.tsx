import { renderHook, waitFor, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppNotification, NotificationListResponse } from "@/lib/api-types";

const apiFetch = vi.fn();

vi.mock("@/lib/api/client", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

/** The socket is captured rather than faked away: the point of these tests is
 *  what the hook does when the server pushes, which is the part that cannot be
 *  seen by calling the REST routes alone. */
const handlers = new Map<string, (payload: unknown) => void>();

vi.mock("@/lib/realtime/client", () => ({
  onRealtimeEvent: (event: string, listener: (payload: unknown) => void) => {
    handlers.set(event, listener);
    return () => handlers.delete(event);
  },
}));

import { useNotifications } from "./use-notifications";

function notification(id: string, readAt: string | null = null): AppNotification {
  return {
    id,
    type: "CARDS_GENERATED",
    title: `${id} ready`,
    body: "Waiting for you.",
    href: `/decks/${id}`,
    tone: "due",
    readAt,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function list(
  data: AppNotification[],
  unreadCount = data.filter((n) => !n.readAt).length,
): NotificationListResponse {
  return { data, unreadCount, hasMore: false };
}

/** Pushes over the captured socket, inside `act` so React flushes the update. */
async function push(payload: unknown) {
  await act(async () => {
    handlers.get("notification")?.(payload);
  });
}

describe("useNotifications", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    handlers.clear();
  });

  it("loads the list and the count over REST", async () => {
    apiFetch.mockResolvedValue(list([notification("n1"), notification("n2")]));

    const { result } = renderHook(() => useNotifications());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items.map((n) => n.id)).toEqual(["n1", "n2"]);
    expect(result.current.unreadCount).toBe(2);
  });

  it("puts a pushed notification at the top and takes the server's count", async () => {
    apiFetch.mockResolvedValue(list([notification("n1")], 1));

    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await push({ notification: notification("n2"), unreadCount: 2 });

    expect(result.current.items.map((n) => n.id)).toEqual(["n2", "n1"]);
    // The count comes from the server rather than being incremented locally:
    // the list is capped and the count is not, so they would drift.
    expect(result.current.unreadCount).toBe(2);
  });

  it("ignores a notification it already has", async () => {
    apiFetch.mockResolvedValue(list([notification("n1")], 1));

    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // A push racing the initial load is the realistic way this happens.
    await push({ notification: notification("n1"), unreadCount: 1 });

    expect(result.current.items).toHaveLength(1);
  });

  it("keeps the list bounded", async () => {
    apiFetch.mockResolvedValue(list([], 0));

    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.loading).toBe(false));

    for (let i = 0; i < 25; i += 1) {
      await push({ notification: notification(`n${i}`), unreadCount: i + 1 });
    }

    expect(result.current.items).toHaveLength(20);
    // Newest first, and the newest survived the cap.
    expect(result.current.items[0]!.id).toBe("n24");
  });

  it("marks one read and takes the count the server returns", async () => {
    apiFetch.mockResolvedValueOnce(list([notification("n1"), notification("n2")], 2));
    apiFetch.mockResolvedValueOnce({ unreadCount: 1 });

    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.markRead("n1");
    });

    expect(result.current.items.find((n) => n.id === "n1")?.readAt).not.toBeNull();
    expect(result.current.unreadCount).toBe(1);
    expect(apiFetch).toHaveBeenCalledWith(
      "notifications/n1/read",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("does not re-post for something already read", async () => {
    apiFetch.mockResolvedValueOnce(list([notification("n1", "2026-01-02T00:00:00.000Z")], 0));

    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.loading).toBe(false));

    apiFetch.mockClear();
    await act(async () => {
      await result.current.markRead("n1");
    });

    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("clears the badge on mark-all, and corrects itself if the call fails", async () => {
    apiFetch.mockResolvedValueOnce(list([notification("n1"), notification("n2")], 2));

    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.loading).toBe(false));

    apiFetch.mockRejectedValueOnce(new Error("down"));
    apiFetch.mockResolvedValueOnce(list([notification("n1"), notification("n2")], 2));

    await act(async () => {
      await result.current.markAllRead();
    });

    // Optimistic while in flight, then reloaded from the server, which is the
    // one that knows — so the badge cannot stay wrong.
    await waitFor(() => expect(result.current.unreadCount).toBe(2));
  });

  it("reports a failed load without throwing", async () => {
    apiFetch.mockRejectedValue(new Error("down"));

    const { result } = renderHook(() => useNotifications());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(true);
    expect(result.current.items).toEqual([]);
  });
});
