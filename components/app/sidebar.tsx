"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_SECTIONS, isSectionActive } from "@/lib/app-nav";
import { SectionIcon } from "@/components/ui/section-icon";
import { cn } from "@/lib/utils/cn";

/**
 * The section rail.
 *
 * Shown once a reader is inside a section, and deliberately *not* on `/home`.
 * The home page is the hub: its container cards are the navigation, and framing
 * them with a rail that lists the same seven destinations twice would make the
 * cards look like a worse version of the rail rather than the point of the
 * page.
 *
 * This is a second `<nav aria-label="Sections">` because the mobile row is a
 * different navigation for a different viewport, not a fallback for this one —
 * the two are never on screen together (`sm:` splits them).
 */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Sections"
      // Named so a test can tell the rail from the mobile row without matching
      // on Tailwind classes, which is a selector that breaks on a restyle.
      data-nav="rail"
      className="hidden w-52 shrink-0 border-r border-line sm:block"
    >
      {/* `top-14` clears the sticky header, so the rail's own list travels with
          the page instead of scrolling away under it. */}
      <ul className="sticky top-14 flex flex-col gap-0.5 p-3">
        <li>
          <Link
            href="/home"
            className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            {/*
              A dot rather than a seventh icon: home is not one of the sections,
              and giving it a matching glyph would imply it is one more of them.
            */}
            <span
              aria-hidden
              className="mx-0.5 size-4 rounded-full border border-dashed border-line-strong"
            />
            Home
          </Link>
        </li>

        <li aria-hidden className="my-1.5 px-2.5">
          <hr className="border-line" />
        </li>

        {APP_SECTIONS.map((section) => {
          const active = isSectionActive(pathname, section.href);

          return (
            <li key={section.href}>
              <Link
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                  active
                    ? "bg-accent-soft text-accent"
                    : "text-ink-muted hover:bg-surface-2 hover:text-ink",
                )}
              >
                <SectionIcon
                  name={section.icon}
                  className={cn(
                    "size-5 shrink-0",
                    active ? "text-accent" : "text-ink-subtle",
                  )}
                />
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
