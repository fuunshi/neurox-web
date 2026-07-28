import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { ApiError } from "@/lib/errors";
import { getViewer } from "@/lib/server/queries";
import { LOGIN_PATH } from "@/lib/server/routes";
import { readSession } from "@/lib/server/session";

/**
 * The gate for everything signed-in.
 *
 * The proxy also redirects on a missing cookie, but that check is a convenience:
 * it only tests that a cookie exists, not that it works. This one calls the API
 * with the token, so a revoked or malformed session is caught here — and the
 * docs are explicit that proxy matching must never be the only check, since a
 * matcher that skips a path silently skips its protection too.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const { accessToken } = await readSession();
  if (!accessToken) redirect(LOGIN_PATH);

  let viewer;
  try {
    viewer = await getViewer();
  } catch (error) {
    if (error instanceof ApiError && error.kind === "unauthenticated") {
      redirect(LOGIN_PATH);
    }
    throw error;
  }

  const name =
    [viewer.firstName, viewer.lastName].filter(Boolean).join(" ") ||
    viewer.email;

  return (
    <AppShell viewer={{ name, email: viewer.email }}>{children}</AppShell>
  );
}
