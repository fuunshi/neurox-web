"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Chip, type ChipTone } from "@/components/ui/chip";
import type { AppNotification, NotificationTone } from "@/lib/api-types";
import { relativeTime } from "@/lib/format";
import { useNotifications } from "@/lib/realtime/use-notifications";
import { cn } from "@/lib/utils/cn";

/** The notification tones are the chip tones already in the design system, so
 *  this is a widening rather than a second palette. */
const TONE: Record<NotificationTone, ChipTone> = {
  neutral: "neutral",
  accent: "accent",
  due: "due",
  success: "success",
  danger: "danger",
};

/**
 * What the app has to tell you, and where you are in it.
 *
 * A bell in the header rather than a page, because most notifications are about
 * something that already has a home in the rail — a deck, a source — and a
 * separate "Notifications" section would be a second place to look for the same
 * things. The panel is a glance; everything in it links onward.
 *
 * The badge is capped at 9+, because past that the number stops being
 * information and starts being decoration.
 */
export function NotificationBell() {
  const { items, unreadCount, loading, error, markRead, markAllRead } =
    useNotifications();
  const [open, setOpen] = useState(false);

  // Closing on Escape, and on navigation, is what a reader expects of a panel
  // that is not a page.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const label =
    unreadCount > 0
      ? `Notifications, ${unreadCount} unread`
      : "Notifications";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className="relative flex size-9 cursor-pointer items-center justify-center rounded-md border border-line bg-surface hover:bg-surface-2"
      >
        <BellIcon />

        {unreadCount > 0 ? (
          <span
            aria-hidden
            className="absolute -top-1 -right-1 flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] leading-4 font-medium text-accent-ink"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          {/* Click-away, matching the account menu: a button so it is reachable,
              invisible and unlabelled because it is not a destination. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />

          <div
            role="menu"
            className="absolute right-0 z-50 mt-1.5 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-1.5 shadow-pop"
          >
            <div className="flex items-center justify-between px-2.5 py-2">
              <p className="text-sm font-medium">Notifications</p>
              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="cursor-pointer text-xs text-accent hover:underline"
                >
                  Mark all read
                </button>
              ) : null}
            </div>

            <hr className="my-1.5" />

            {loading ? (
              <p className="px-2.5 py-6 text-center text-sm text-ink-subtle">
                Loading…
              </p>
            ) : error ? (
              /*
               * Quiet, but not silent. A failed load used to fall through to
               * the empty state below, so the bell answered "Nothing yet" — a
               * claim about the reader's notifications where the truth was a
               * claim about the request. That is how a proxy allow-list
               * missing one root went on 404ing on every page load without
               * anyone noticing. Still not a banner: the panel is a glance,
               * and the hook's whole contract is that the bell is not why
               * anyone opened the page.
               */
              <p className="px-2.5 py-6 text-center text-sm text-ink-subtle">
                Could not load notifications.
              </p>
            ) : items.length === 0 ? (
              <p className="px-2.5 py-6 text-center text-sm text-ink-subtle">
                Nothing yet. Cards finishing, imports landing and account changes
                all show up here.
              </p>
            ) : (
              <ul className="flex max-h-96 flex-col overflow-y-auto">
                {items.map((item) => (
                  <li key={item.id}>
                    <NotificationRow
                      notification={item}
                      onActivate={() => {
                        void markRead(item.id);
                        setOpen(false);
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function NotificationRow({
  notification,
  onActivate,
}: {
  notification: AppNotification;
  onActivate: () => void;
}) {
  const unread = notification.readAt === null;

  const body = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={TONE[notification.tone]}>{notification.title}</Chip>
        <time
          dateTime={notification.createdAt}
          className="text-xs text-ink-subtle"
        >
          {relativeTime(notification.createdAt)}
        </time>
      </div>
      <p className="mt-1.5 text-sm text-ink-muted">{notification.body}</p>
    </>
  );

  const className = cn(
    "block rounded-md px-2.5 py-2.5 transition-colors hover:bg-surface-2",
    // An unread one is marked by a dot rather than by weight: bolding the title
    // would make the whole panel shout once a few arrive at once.
    unread && "bg-accent-soft/40",
  );

  // Where it goes is the server's decision — it is the only side that knows
  // what a deck is. When there is nowhere to go, the row is still a row.
  if (!notification.href) {
    return <div className={className}>{body}</div>;
  }

  return (
    <Link
      href={notification.href}
      onClick={onActivate}
      className={className}
      role="menuitem"
    >
      {body}
    </Link>
  );
}

function BellIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4.5 text-ink-muted"
    >
      <path d="M18 8A6 6 0 1 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}
