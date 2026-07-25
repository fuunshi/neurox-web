/**
 * Numbered because this content genuinely is a sequence — a loop you go round,
 * not a set of features. The numerals sit on a continuous rule so the order is
 * structural rather than decorative.
 */
const STEPS = [
  {
    title: "Bring your material",
    body: "Paste notes, or upload a PDF, a Word document, Markdown or plain text. Whatever the file, the text is what gets read.",
  },
  {
    title: "Review the drafts",
    body: "Generation produces drafts, never finished cards. Read them, fix the wording, drop the ones that ask nothing worth answering.",
  },
  {
    title: "Study what you kept",
    body: "Only cards you have accepted go into a deck. Nothing you did not choose ends up in front of you later.",
  },
];

export function BuildSteps() {
  return (
    <ol className="grid gap-10 sm:grid-cols-3 sm:gap-0">
      {STEPS.map((step, index) => (
        <li
          key={step.title}
          className="relative flex flex-col gap-2 sm:border-t sm:border-line sm:pt-8 sm:pr-10"
        >
          <span
            aria-hidden
            className="absolute -top-3.5 left-0 hidden size-7 items-center justify-center rounded-full border border-line bg-bg text-sm font-medium text-ink-muted sm:flex"
          >
            {index + 1}
          </span>
          {/* On narrow screens the rule and badge are dropped, so the order has
              to come from the numbers themselves. */}
          <span className="text-sm font-medium text-ink-subtle sm:hidden">
            Step {index + 1}
          </span>
          <h3 className="text-lg">{step.title}</h3>
          <p className="max-w-prose text-ink-muted">{step.body}</p>
        </li>
      ))}
    </ol>
  );
}
