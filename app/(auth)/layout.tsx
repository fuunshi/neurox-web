import type { ReactNode } from "react";

/**
 * Signed-out screens. Centred vertically so a short form does not sit stranded
 * at the top of a tall window.
 *
 * The routes inside are shaped by the backend, not chosen here: its email
 * templates build `${FRONTEND_URL}/auth/verify-email?token=…` and
 * `${FRONTEND_URL}/reset-password?token=…`, so verification lives under `/auth`
 * and reset does not. The route group keeps one layout over both without adding
 * a path segment.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col justify-center px-5 py-12 sm:px-8">
      {children}
    </main>
  );
}
