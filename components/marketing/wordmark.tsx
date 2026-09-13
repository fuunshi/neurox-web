import { cn } from "@/lib/utils/cn";

/**
 * The ring is a quarter complete. It reads as an aperture — an iris — and as
 * progress through material, which is the same idea either way: partly learned
 * is the normal state, not a failure state.
 *
 * The name is always shown. There used to be a `showName` flag, because the app
 * header wanted the mark alone; every surface shows both now, so the flag was
 * an option with one value.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className="size-5 shrink-0 text-ink-subtle"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          opacity="0.3"
        />
        <path
          d="M12 3a9 9 0 0 1 9 9"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <span className="font-display text-xl tracking-tight text-ink">
        neurox
      </span>
    </span>
  );
}
