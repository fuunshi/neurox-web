import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type ChipTone = "neutral" | "accent" | "due" | "danger" | "success";

const TONES: Record<ChipTone, string> = {
  neutral: "border-line bg-surface-2 text-ink-muted",
  accent: "border-transparent bg-accent-soft text-accent",
  // Amber means "needs your attention" everywhere in this product: a draft
  // awaiting review, a card that is due, a source that failed to parse.
  due: "border-transparent bg-due-soft text-due-fg",
  danger: "border-transparent bg-danger-soft text-danger-fg",
  success: "border-transparent bg-success-soft text-success",
};

export function Chip({
  tone = "neutral",
  className,
  children,
}: {
  tone?: ChipTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
