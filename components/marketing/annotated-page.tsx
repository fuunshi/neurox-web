"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * The hero's subject is the product's actual transformation: a page of study
 * text goes in, and the questions written from it come out in the margin. The
 * marked phrases in the passage *are* the fronts of the notes beside them, and
 * the reference numerals are the join between the two.
 *
 * The sample passage is about memory and spacing on purpose — the demonstration
 * material is also a claim that the product understands its own domain.
 */

interface Segment {
  text: string;
  /** Reference numeral, matching a note by `ref`. */
  ref?: number;
}

interface Note {
  ref: number;
  question: string;
  answer: string;
}

/** Paragraphs rather than one blob, so the marks can be authored precisely
 *  instead of located by string matching at render time. */
const PASSAGE: Segment[][] = [
  [
    { text: "Spaced repetition", ref: 1 },
    {
      text: " is a study method in which review sessions are spread out over increasing intervals. ",
    },
    { text: "Hermann Ebbinghaus mapped the forgetting curve in 1885", ref: 2 },
    {
      text: ", showing that retention drops steeply within the first day and then levels off.",
    },
  ],
  [
    {
      text: "Each time you successfully recall an item, the interval before you next need to see it grows. Items that resist recall come back sooner. ",
    },
    { text: "Familiarity is not retrieval", ref: 3 },
    { text: ", which is why re-reading feels productive while doing very little." },
  ],
];

const NOTES: Note[] = [
  {
    ref: 1,
    question: "What is spaced repetition?",
    answer:
      "A study method in which review sessions are spread out over increasing intervals, so each successful recall pushes the next review further away.",
  },
  {
    ref: 2,
    question: "Who mapped the forgetting curve, and when?",
    answer:
      "Hermann Ebbinghaus, in 1885. Retention of new material falls steeply over the first day and then levels off.",
  },
  {
    ref: 3,
    question: "Why does re-reading feel productive but work less well?",
    answer:
      "Because it makes the text familiar, and familiarity is not retrieval. Only the effort of retrieving something strengthens your hold on it.",
  },
];

export function AnnotatedPage() {
  const id = useId();
  // The first note starts open: the reveal is the point, and an unopened
  // disclosure does not show one.
  const [openRef, setOpenRef] = useState<number | null>(1);

  const toggle = (ref: number) =>
    setOpenRef((current) => (current === ref ? null : ref));

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      {/* The input, named, so it is clear the passage is a document and not
          copy written for the page. */}
      <div className="flex items-center gap-2.5 border-b border-line bg-surface-2 px-5 py-3">
        <span
          className="rounded-sm border border-line bg-surface px-1.5 py-0.5 text-xs text-ink-muted"
          style={{ fontFamily: "ui-monospace, monospace" }}
        >
          .pdf
        </span>
        <span className="truncate text-sm text-ink-muted">
          Lecture 3 — Memory and retention.pdf
        </span>
      </div>

      <div className="grid gap-8 px-5 py-7 sm:px-8 sm:py-9 md:grid-cols-[minmax(0,1fr)_15rem] md:gap-10 lg:grid-cols-[minmax(0,1fr)_17rem]">
        {/* The page. */}
        <div className="flex max-w-[48ch] flex-col gap-5">
          {PASSAGE.map((paragraph, index) => (
            <p
              key={index}
              className="font-display text-lg leading-relaxed text-ink sm:text-xl"
            >
              {paragraph.map((segment, segmentIndex) =>
                segment.ref === undefined ? (
                  <span key={segmentIndex}>{segment.text}</span>
                ) : (
                  <MarkedPhrase
                    key={segmentIndex}
                    text={segment.text}
                    refNumber={segment.ref}
                    open={openRef === segment.ref}
                    controls={`${id}-note-${segment.ref}`}
                    onToggle={() => toggle(segment.ref as number)}
                  />
                ),
              )}
            </p>
          ))}
        </div>

        {/* The margin. */}
        <div className="flex flex-col gap-4 md:border-l md:border-line md:pl-8">
          {NOTES.map((note) => (
            <MarginNote
              key={note.ref}
              note={note}
              id={`${id}-note-${note.ref}`}
              open={openRef === note.ref}
              onToggle={() => toggle(note.ref)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MarkedPhrase({
  text,
  refNumber,
  open,
  controls,
  onToggle,
}: {
  text: string;
  refNumber: number;
  open: boolean;
  controls: string;
  onToggle: () => void;
}) {
  return (
    <span
      className={cn(
        "bg-accent-soft/60 decoration-accent decoration-2 underline-offset-[5px]",
        open ? "underline" : "underline decoration-dotted",
      )}
    >
      {text}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={controls}
        className="ml-0.5 cursor-pointer align-super font-sans text-[0.6em] font-semibold text-accent"
      >
        {refNumber}
        <span className="sr-only"> — show the card drafted from this</span>
      </button>
    </span>
  );
}

function MarginNote({
  note,
  id,
  open,
  onToggle,
}: {
  note: Note;
  id: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={id}
        className="group flex cursor-pointer items-start gap-2 text-left"
      >
        <span
          aria-hidden
          className={cn(
            "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
            open
              ? "border-accent bg-accent text-accent-ink"
              : "border-line-strong text-ink-subtle group-hover:border-accent group-hover:text-accent",
          )}
        >
          {note.ref}
        </span>
        <span className="font-display text-base leading-snug text-ink">
          {note.question}
        </span>
      </button>

      <div
        id={id}
        hidden={!open}
        className="ml-6 border-l-2 border-accent-soft pl-3 text-sm text-ink-muted"
      >
        {note.answer}
      </div>
    </div>
  );
}
