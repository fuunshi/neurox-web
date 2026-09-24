"use client";

import type { ReactNode } from "react";
import type { ApiError } from "@/lib/errors";
import { cn } from "@/lib/utils/cn";

/**
 * A form-level message.
 *
 * Two decisions worth keeping: the reader's own errors are not hidden behind a
 * tooltip, and a server-side failure can be reported usefully — the `requestId`
 * identifies the request in the server's logs, so it is offered in a disclosure
 * rather than shown always (it means nothing to most people) or dropped (it is
 * the fastest route to an answer when something is genuinely broken).
 *
 * Not built on the toast system on purpose: a toast for a wrong password
 * disappears before it has been read, and a form's error belongs next to the
 * form.
 */
export function FormBanner({
  error,
  tone,
  children,
}: {
  error?: ApiError | null;
  /** Override the tone for non-error notices, e.g. a neutral confirmation. */
  tone?: "danger" | "due" | "accent";
  children?: ReactNode;
}) {
  if (!error && !children) return null;

  const resolvedTone =
    tone ?? (error?.kind === "rate_limited" ? "due" : "danger");

  const tones = {
    danger: "border-danger/40 bg-danger-soft text-danger-fg",
    due: "border-due/40 bg-due-soft text-due-fg",
    accent: "border-accent/40 bg-accent-soft text-accent",
  } as const;

  const messages = error?.messages ?? [];

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-1 rounded-md border px-3.5 py-3 text-sm",
        tones[resolvedTone],
      )}
    >
      {children}
      {messages.length === 1 ? <p>{messages[0]}</p> : null}
      {messages.length > 1 ? (
        <ul className="flex list-inside list-disc flex-col gap-0.5">
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}

      {error?.requestId ? (
        <details className="mt-1 text-xs opacity-80">
          <summary className="cursor-pointer">Reference</summary>
          <p className="mt-1 break-all">
            {error.status ? `HTTP ${error.status} · ` : null}
            {error.requestId}
          </p>
        </details>
      ) : null}
    </div>
  );
}
