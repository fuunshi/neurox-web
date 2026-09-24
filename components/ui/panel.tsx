import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * A surface with a hairline. Deliberately no default shadow: elevation is a
 * signal, so the few places that need it (a menu, a dialog) ask for
 * `elevated` — otherwise every panel carries the same soft grey drop shadow
 * and hierarchy disappears.
 */
export function Panel({
  elevated = false,
  className,
  children,
}: {
  elevated?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-line bg-surface",
        elevated && "shadow-pop",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  action,
  description,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-lg font-medium">{title}</h2>
        {description ? (
          <p className="text-sm text-ink-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function PanelBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}
