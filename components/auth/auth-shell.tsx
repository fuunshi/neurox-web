import type { ReactNode } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/marketing/wordmark";

/**
 * Every signed-out screen: one narrow column, a wordmark, a heading, the form,
 * and one way out. No card, no chrome — there is nothing else on the page to
 * compete with.
 */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col">
      <Link href="/" className="mb-8 rounded-md self-start" aria-label="neurox, home">
        <Wordmark />
      </Link>

      <h1 className="text-2xl">{title}</h1>
      {description ? (
        <div className="mt-2 text-ink-muted">{description}</div>
      ) : null}

      <div className="mt-7">{children}</div>

      {footer ? (
        <div className="mt-7 border-t border-line pt-5 text-sm text-ink-muted">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
