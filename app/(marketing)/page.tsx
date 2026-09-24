import Link from "next/link";
import { AnnotatedPage } from "@/components/marketing/annotated-page";
import { BuildSteps } from "@/components/marketing/build-steps";
import { DraftComparison } from "@/components/marketing/draft-comparison";
import { FormatTable } from "@/components/marketing/format-table";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { buttonStyles } from "@/components/ui/button";

export default function HomePage() {
  return (
    <>
      {/* Hero. The claim is one sentence, and the evidence for it is the
          specimen immediately below rather than a screenshot of chrome. */}
      <section className="mx-auto w-full max-w-6xl px-5 pt-14 pb-12 sm:px-8 sm:pt-20 sm:pb-14">
        {/* Measures are set per element, not on a shared wrapper: `ch` resolves
            against the element's own font size, so a 42ch wrapper would measure
            in 15px body text and squeeze the 48px headline into a narrow
            column. */}
        <h1 className="max-w-[24ch] text-4xl sm:text-5xl">
          Turn your reading into questions you can answer.
        </h1>
        <p className="mt-5 max-w-[54ch] text-lg text-ink-muted">
          Bring your notes, PDFs and slides. neurox drafts flashcards from them,
          and you decide which ones are worth keeping.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link href="/auth/register" className={buttonStyles({ size: "lg" })}>
            Create an account
          </Link>
          <a
            href="#how-it-works"
            className={buttonStyles({ variant: "quiet", size: "lg" })}
          >
            See how a deck gets built
          </a>
        </div>

        {/* Held to page width rather than container width: a document reads as
            a document, and the passage and its margin would otherwise be
            separated by a few hundred pixels of nothing. */}
        <div className="mt-12 max-w-4xl sm:mt-16">
          <AnnotatedPage />
          <p className="mt-4 max-w-prose text-sm text-ink-subtle">
            Three questions drafted from one page, and the phrases they came
            from. Open one to read the answer.
          </p>
        </div>
      </section>

      <section
        id="how-it-works"
        className="mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-16 sm:px-8 sm:py-20"
      >
        <h2 className="mb-10 max-w-[34ch] text-2xl sm:mb-14 sm:text-3xl">
          What happens between a document and a deck
        </h2>
        <BuildSteps />
      </section>

      <section className="border-y border-line bg-surface-2">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <h2 className="text-2xl sm:text-3xl">Drafts, not gospel</h2>
          <p className="mt-4 mb-10 max-w-prose text-lg text-ink-muted">
            A generator that hands you finished-looking cards is asking to be
            trusted. This one hands you drafts and expects you to be the judge —
            the second version below is the one that gets studied, and you write
            it.
          </p>
          <DraftComparison />
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-16 sm:px-8 sm:py-20 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:gap-16">
        <div className="flex flex-col gap-3">
          <h2 className="text-2xl sm:text-3xl">What it reads</h2>
          <p className="max-w-prose text-ink-muted">
            The formats people actually keep their notes in, and the honest
            limit on each. Nothing here needs converting first.
          </p>
        </div>
        <FormatTable />
      </section>

      {/* The scheme control is in the header; repeating it here as a live demo
          is the shortest way to show what "three schemes" means. */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-16 sm:px-8 sm:pb-20">
        <div className="flex flex-wrap items-center justify-between gap-5 rounded-lg border border-line px-5 py-5 sm:px-6">
          <div className="max-w-prose">
            <h2 className="text-lg">Three schemes, one layout</h2>
            <p className="mt-1 text-ink-muted">
              Daylight, Nightlab and Paper change the palette and nothing else.
              Dark here is a scheme you choose, not a setting of your operating
              system.
            </p>
          </div>
          <ThemeSwitcher />
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-24 sm:px-8 sm:pb-28">
        <div className="max-w-[46ch]">
          <h2 className="text-2xl sm:text-3xl">
            Start with something you are already reading
          </h2>
          <p className="mt-4 text-lg text-ink-muted">
            An account is free to create and takes a minute. You will need to
            confirm your email address before your first sign-in.
          </p>
          <div className="mt-6">
            <Link href="/auth/register" className={buttonStyles({ size: "lg" })}>
              Create an account
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
