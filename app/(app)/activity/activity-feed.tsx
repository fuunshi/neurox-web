"use client";

import Link from "next/link";
import { Chip, type ChipTone } from "@/components/ui/chip";
import type { Activity } from "@/lib/api-types";
import { relativeTime } from "@/lib/format";

/**
 * Describes an activity in the reader's terms.
 *
 * The API returns an enum (`CARDS_GENERATED`) and a free-form `data` payload, so
 * this is a presentation map rather than something the server should be
 * deciding — what reads well is a property of the interface.
 */
const DESCRIPTIONS: Record<
  string,
  { label: string; tone: ChipTone; detail?: (data: Record<string, unknown>) => string }
> = {
  DECK_CREATED: { label: "Deck created", tone: "neutral" },
  DECK_UPDATED: { label: "Deck updated", tone: "neutral" },
  DECK_DELETED: { label: "Deck deleted", tone: "danger" },
  CARD_CREATED: { label: "Card added", tone: "neutral" },
  CARD_UPDATED: { label: "Card edited", tone: "neutral" },
  CARD_STATUS_CHANGED: { label: "Card status changed", tone: "accent" },
  CARD_DELETED: { label: "Card deleted", tone: "danger" },
  SOURCE_CREATED: { label: "Source added", tone: "neutral" },
  SOURCE_TEXT_EXTRACTED: { label: "Source read", tone: "success" },
  SOURCE_DELETED: { label: "Source deleted", tone: "danger" },
  CARDS_GENERATED: {
    label: "Cards drafted",
    tone: "due",
    detail: (data) => {
      const count = typeof data.cardsCreated === "number" ? data.cardsCreated : null;
      const provider = typeof data.provider === "string" ? data.provider : null;
      const source = typeof data.sourceTitle === "string" ? data.sourceTitle : null;

      if (count === null) return source ? `From “${source}”` : "";

      return [
        count === 0 ? "Nothing worth asking about" : `${count} draft card${count === 1 ? "" : "s"}`,
        source ? `from “${source}”` : null,
        provider ? `via ${provider}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    },
  },
};

export function ActivityFeed({ activities }: { activities: Activity[] }) {
  return (
    <ol className="flex flex-col">
      {activities.map((activity) => {
        const described = DESCRIPTIONS[activity.type];
        const detail = described?.detail?.(activity.data ?? "");

        return (
          <li
            key={activity.id}
            className="flex flex-col gap-1.5 border-b border-line py-4 last:border-b-0"
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <Chip tone={described?.tone ?? "neutral"}>
                {described?.label ?? activity.type}
              </Chip>
              <time
                dateTime={activity.createdAt}
                className="text-sm text-ink-subtle"
              >
                {relativeTime(activity.createdAt)}
              </time>
            </div>

            {detail ? <p className="text-ink-muted">{detail}</p> : null}

            {activity.entityType === "DECK" ? (
              <Link
                href={`/decks/${activity.entityId}`}
                className="self-start text-sm text-accent hover:underline"
              >
                Open the deck
              </Link>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
