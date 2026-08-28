"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { Wordmark } from "@/components/marketing/wordmark";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/api/client";
import { isSectionActive, MOBILE_NAV } from "@/lib/app-nav";
import { disconnectRealtime } from "@/lib/realtime/client";
import { cn } from "@/lib/utils/cn";
import { NotificationBell } from "./notification-bell";
import { Sidebar } from "./sidebar";

/**
 * The signed-in chrome.
 *
 * The top bar used to carry the section links, and it carried them as bare
 * labels — six words with no indication of what any of them did. Those links
 * now live in the rail (`Sidebar`) on wide screens and in the scrolling row
 * below the header on narrow ones, which leaves the top bar for what is
 * genuinely global: where you are, and who you are.
 *
 * `/home` is the one exception. It renders without the rail, because the home
 * page's container cards *are* the navigation — see the note in `sidebar.tsx`.
 */
export function AppShell({
  viewer,
  children,
}: {
  viewer: { name: string; email: string };
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const onHome = pathname === "/home";
  const showMobileNav = !onHome;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-sm">
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
          <Link href="/home" className="rounded-md" aria-label="neurox, home">
            <Wordmark showName={false} />
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <ThemeSwitcher className="hidden md:inline-flex" />
            <NotificationBell />
            <UserMenu
              viewer={viewer}
              open={menuOpen}
              onToggle={() => setMenuOpen((current) => !current)}
              onClose={() => setMenuOpen(false)}
            />
          </div>
        </div>

        {/* The nav collapses to a scrolling row on narrow screens rather than a
            drawer: seven short labels do not justify a menu, and a row keeps
            every destination one tap away. */}
        {showMobileNav ? (
          <nav
            aria-label="Sections"
            data-nav="row"
            className="border-t border-line px-4 py-2 sm:hidden"
          >
            <ul className="flex items-center gap-1 overflow-x-auto">
              {MOBILE_NAV.map((item) => {
                const active = isSectionActive(pathname, item.href);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "block rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
                        active
                          ? "bg-accent-soft text-accent"
                          : "text-ink-muted hover:bg-surface-2 hover:text-ink",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        ) : null}
      </header>

      <div className="flex flex-1 items-stretch">
        {onHome ? null : <Sidebar />}
        <main className="min-w-0 flex-1 px-4 py-8 sm:px-6">{children}</main>
      </div>
    </div>
  );
}

function UserMenu({
  viewer,
  open,
  onToggle,
  onClose,
}: {
  viewer: { name: string; email: string };
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const initials = viewer.name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function signOut() {
    setPending(true);
    // Closed before the request, not after: the socket is authenticated as the
    // account that is on its way out, and there is no reason to keep it open
    // while the sign-out is in flight.
    disconnectRealtime();
    await authFetch("logout", { method: "POST" }).catch(() => undefined);
    // The cookie is already gone whichever way the call went, so this always
    // ends on the sign-in screen.
    router.replace("/auth/login");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex cursor-pointer items-center gap-2 rounded-md border border-line bg-surface px-2 py-1.5 text-sm hover:bg-surface-2"
      >
        <span
          aria-hidden
          className="flex size-6 items-center justify-center rounded-full bg-accent-soft text-xs font-medium text-accent"
        >
          {initials || "?"}
        </span>
        <span className="hidden max-w-24 truncate sm:inline">{viewer.name}</span>
      </button>

      {open ? (
        <>
          {/* Click-away. A button rather than a div so it is reachable and
              announced; it is invisible and has no label for a reason. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={onClose}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-1.5 w-56 rounded-lg border border-line bg-surface p-1.5 shadow-pop"
          >
            <div className="px-2.5 py-2">
              <p className="truncate text-sm font-medium">{viewer.name}</p>
              <p className="truncate text-xs text-ink-subtle">{viewer.email}</p>
            </div>
            <hr className="my-1.5" />
            <Link
              href="/settings"
              onClick={onClose}
              role="menuitem"
              className="block rounded-md px-2.5 py-2 text-sm text-ink-muted hover:bg-surface-2 hover:text-ink"
            >
              Account settings
            </Link>
            <div className="px-2.5 py-2 md:hidden">
              <ThemeSwitcher />
            </div>
            <hr className="my-1.5" />
            <div className="px-2.5 py-1.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={signOut}
                loading={pending}
                className="w-full"
              >
                Sign out
              </Button>
              {/* The API revokes every token the account has, not just this
                  one, so this is worth stating rather than discovering. */}
              <p className="mt-2 text-xs text-ink-subtle">
                Signs out on all devices.
              </p>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
