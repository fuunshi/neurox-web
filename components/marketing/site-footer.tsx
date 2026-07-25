import Link from "next/link";
import { Wordmark } from "./wordmark";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex flex-col gap-2">
            <Wordmark />
            <p className="max-w-xs text-sm text-ink-muted">
              Flashcards drafted from the material you already have, kept only
              if you say so.
            </p>
          </div>

          <nav className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <Link href="/auth/register" className="text-ink-muted hover:text-ink">
              Create an account
            </Link>
            <Link href="/auth/login" className="text-ink-muted hover:text-ink">
              Sign in
            </Link>
            <Link
              href="/auth/forgot-password"
              className="text-ink-muted hover:text-ink"
            >
              Reset a password
            </Link>
          </nav>
        </div>

        {/* The theme control lives in the header. Saying so once here is
            cheaper than a second copy of the switcher. */}
        <p className="text-sm text-ink-subtle">
          Three colour schemes — Daylight, Nightlab and Paper — switchable from
          the header. They change the palette, never the layout.
        </p>
      </div>
    </footer>
  );
}
