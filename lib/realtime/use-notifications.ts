"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import type {
  AppNotification,
  NotificationListResponse,
  NotificationMessage,
} from "@/lib/api-types";
import { onRealtimeEvent } from "./client";

/**
 * The notification list and its badge.
 *
 * REST first, socket second — deliberately in that order. The list loads over
 * the ordinary authenticated route handlers, so the bell is correct on a cold
 * page with no socket at all; the socket then adds to it as things happen. A
 * reader whose browser cannot open a WebSocket gets a bell that is right on
 * every page load instead of a feature that is missing.
 *
 * The socket is also not trusted to be the *only* source of truth: a
 * `unreadCount` that arrives with a message is taken as given, because the
 * server counted it, but a message that arrives out of order cannot corrupt the
 * list — the same notification is never inserted twice.
 */

const SERVER_EVENT = {
  NOTIFICATION: "notification",
  UNREAD_CHANGED: "unread-changed",
} as const;

/** How many to keep in memory. The panel is a glance, not an archive — older
 *  ones are still on the server if a fuller list is ever built. */
const KEEP = 20;

export interface NotificationsState {
  items: AppNotification[];
  unreadCount: number;
  loading: boolean;
  error: boolean;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

export function useNotifications(): NotificationsState {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Kept in a ref so the socket listeners below never need re-registering, and
  // so `markRead` can decide whether to call the server without reading state
  // that may be a render behind.
  const readIds = useRef(new Set<string>());

  const load = useCallback(async () => {
    try {
      const result = await apiFetch<NotificationListResponse>(
        "notifications?limit=20",
      );
      setItems(result.data);
      setUnreadCount(result.unreadCount);
      setError(false);
      for (const item of result.data) {
        if (item.readAt) readIds.current.add(item.id);
      }
    } catch {
      // Surfaced as a quiet state rather than an error banner: the bell is not
      // why anyone opened the page.
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Awaited inside an async boundary rather than called straight from the
    // effect body: the writes happen after the first await, and stating that
    // explicitly is what `react-hooks/set-state-in-effect` is asking for.
    void (async () => {
      await load();
    })();
  }, [load]);

  useEffect(() => {
    const offNotification = onRealtimeEvent(
      SERVER_EVENT.NOTIFICATION,
      (payload) => {
        const message = payload as NotificationMessage;
        if (!message?.notification) return;

        setItems((current) => {
          // Deduplicated by id: a reconnect can replay nothing, but a message
          // racing the initial load can deliver something already in the list.
          if (current.some((item) => item.id === message.notification.id)) {
            return current;
          }
          return [message.notification, ...current].slice(0, KEEP);
        });

        // The server counted it, so it is taken as given rather than inferred
        // from the list — the list is capped and the count is not.
        setUnreadCount(message.unreadCount);
      },
    );

    const offUnread = onRealtimeEvent(SERVER_EVENT.UNREAD_CHANGED, (payload) => {
      const count = (payload as { unreadCount?: unknown })?.unreadCount;
      if (typeof count === "number") setUnreadCount(count);
    });

    return () => {
      offNotification();
      offUnread();
    };
  }, []);

  const markRead = useCallback(async (id: string) => {
    if (readIds.current.has(id)) return;
    readIds.current.add(id);

    // Optimistic: the panel closes the moment it is clicked, and a failed call
    // is corrected by the next load rather than by a spinner.
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, readAt: new Date().toISOString() } : item,
      ),
    );
    setUnreadCount((current) => Math.max(0, current - 1));

    try {
      const result = await apiFetch<{ unreadCount: number }>(
        `notifications/${encodeURIComponent(id)}/read`,
        { method: "POST" },
      );
      setUnreadCount(result.unreadCount);
    } catch {
      readIds.current.delete(id);
      void load();
    }
  }, [load]);

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    setItems((current) =>
      current.map((item) => (item.readAt ? item : { ...item, readAt: now })),
    );
    setUnreadCount(0);

    try {
      await apiFetch("notifications/read-all", { method: "POST" });
    } catch {
      void load();
    }
  }, [load]);

  return { items, unreadCount, loading, error, markRead, markAllRead };
}
