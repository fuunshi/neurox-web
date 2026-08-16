import Link from "next/link";
import type { ReactNode } from "react";
import { SectionIcon, type SectionIconId } from "@/components/ui/section-icon";
import { cn } from "@/lib/utils/cn";

/**
 * A section, as something to walk into.
 *
 * The home page's whole job is to say what this app does, and a list of links
 * cannot do that — "Generate" is not a word that tells a new reader anything.
 * So the card carries a sentence, and the sentence is the point of the
 * component rather than a caption on it.
 *
 * It renders as a `<Link>`, which is not a detail. These are destinations, so
 * they open in a new tab, show their target on hover, and work with the
 * browser's own navigation, none of which a `<button>` with a router push
 * would do.
 */
export function SectionCard({
  href,
  title,
  description,
  icon,
  meta,
  className,
}: {
  href: string;
  title: string;
  description: string;
  icon: SectionIconId;
  /** A live figure for the section — a count, a due total, a status. */
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col gap-3 rounded-lg border border-line bg-surface p-5",
        "transition-colors hover:border-line-strong hover:bg-surface-2",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-9 items-center justify-center rounded-md bg-accent-soft text-accent">
          <SectionIcon name={icon} className="size-5" />
        </span>

        {meta ? (
          <span className="shrink-0 text-right text-xs text-ink-subtle">
            {meta}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="text-base font-medium">{title}</h3>
        <p className="text-sm text-ink-muted">{description}</p>
      </div>
    </Link>
  );
}
