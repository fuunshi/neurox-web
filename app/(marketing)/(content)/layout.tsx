import type { ReactNode } from "react";

/**
 * The reading container for everything under a course.
 *
 * A route group, so it adds no URL segment — `/bca/semester-3` is served by
 * `(content)/[course]/[semester]/page.tsx`. It exists to hold the width and
 * the vertical rhythm once, rather than in each of the four page files.
 *
 * **Nothing in this tree may read `cookies()` or `headers()`.** That is not a
 * style preference: a request-time read anywhere here makes every page beneath
 * it dynamic, and these pages are meant to be prerendered and cached. The
 * session-free chrome above (the marketing header) is what makes that possible,
 * and it is why the public header is a separate component from `AppShell`.
 */
export default function ContentLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      {children}
    </div>
  );
}
