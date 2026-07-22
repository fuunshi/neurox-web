import { cn } from "@/lib/utils/cn";

/**
 * Inherits `currentColor` so it works on any surface without a variant.
 * Always `aria-hidden`: every use site is already announcing its own state
 * through `aria-busy` or visible text, and a spinner read aloud is noise.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      className={cn("size-5 animate-spin", className)}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2.5"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
