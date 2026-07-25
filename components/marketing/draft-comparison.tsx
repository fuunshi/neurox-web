import { Chip } from "@/components/ui/chip";

/**
 * The product's actual stance, shown rather than asserted: generation hands you
 * drafts. The difference between the two columns is the work the reader is
 * expected to do, which is the honest thing to put on a marketing page for a
 * tool that writes questions for you.
 */
export function DraftComparison() {
  return (
    <div className="grid gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-2">
      <Specimen
        state="As drafted"
        tone="due"
        front="What is spaced repetition?"
        back="Spaced repetition is a study method in which review sessions are spread out over increasing intervals. Each time you successfully recall an item, the interval before you next need to see it grows. Items that resist recall come back sooner."
        caption="The sentence it came from, close to verbatim. Accurate, and too long to be a good answer."
      />
      <Specimen
        state="As kept"
        tone="accent"
        front="What is spaced repetition?"
        back="Reviewing material at increasing intervals, so each successful recall pushes the next review further away."
        caption="Trimmed to the part you would actually say out loud. This is the card that gets studied."
      />
    </div>
  );
}

function Specimen({
  state,
  tone,
  front,
  back,
  caption,
}: {
  state: string;
  tone: "due" | "accent";
  front: string;
  back: string;
  caption: string;
}) {
  return (
    <div className="flex flex-col gap-4 bg-surface p-5 sm:p-6">
      <Chip tone={tone}>{state}</Chip>

      <div className="flex flex-col gap-3">
        <p className="font-display text-lg leading-snug">{front}</p>
        <div className="border-t border-line pt-3">
          <p className="text-ink-muted">{back}</p>
        </div>
      </div>

      <p className="mt-auto text-sm text-ink-subtle">{caption}</p>
    </div>
  );
}
