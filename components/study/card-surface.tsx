import type { FlashCard } from "@/lib/api-types";
import { cn } from "@/lib/utils/cn";

export type CardSide = "front" | "back";

/**
 * One card, whichever side is showing.
 *
 * Every study mode renders *this* rather than its own markup, which is what
 * makes a new mode a new presentation instead of a new screen. Anything that
 * should look the same wherever a card appears — the question in the serif, the
 * answer in the sans, the hint kept quiet — belongs here and only here.
 *
 * The two sides are told apart by type rather than by a "Question"/"Answer"
 * label: a label above every card is noise the reader learns to skip, and the
 * change of face already reads as a change of state.
 */
export function CardSurface({
  card,
  side,
  className,
}: {
  card: FlashCard;
  side: CardSide;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col", className)}>
      {side === "front" ? (
        <Front card={card} />
      ) : (
        <Back card={card} />
      )}
    </div>
  );
}

function Front({ card }: { card: FlashCard }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <p className="font-display text-xl leading-snug text-balance sm:text-2xl">
        {card.front}
      </p>
      {card.hint ? (
        <p className="max-w-prose text-sm text-ink-subtle">
          Hint: {card.hint}
        </p>
      ) : null}
    </div>
  );
}

function Back({ card }: { card: FlashCard }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      {/* The question stays visible behind the answer. Recalling it is the
          exercise, and hiding it makes the answer unanchored. */}
      <p className="max-w-prose font-display text-base leading-snug text-ink-subtle">
        {card.front}
      </p>
      <div className="w-12 border-t border-line" />
      <p className="max-w-[54ch] text-lg leading-relaxed text-balance">
        {card.back}
      </p>
    </div>
  );
}
