import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * An empty screen is an invitation to act, so `action` is the point of this
 * component and the explanation is one sentence. It says what will appear here
 * and what to do about it, and it does not apologise.
 */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 rounded-lg border border-dashed border-line px-6 py-10",
        className,
      )}
    >
      <h3 className="text-lg font-medium">{title}</h3>
      <p className="max-w-prose text-ink-muted">{description}</p>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
