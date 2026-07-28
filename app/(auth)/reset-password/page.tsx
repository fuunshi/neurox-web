import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { buttonStyles } from "@/components/ui/button";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "Set a new password" };

/**
 * Lives at `/reset-password`, at the root rather than under `/auth`, because
 * that is the path the backend's email template builds from `FRONTEND_URL`. The
 * route group gives it the same layout as the `/auth` screens without adding a
 * path segment.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.token;
  const token = Array.isArray(raw) ? raw[0] : raw;

  if (!token) {
    return (
      <AuthShell
        title="That link is incomplete"
        description="The address is missing its reset token — usually because the link was wrapped across lines by an email client."
      >
        <Link href="/auth/forgot-password" className={buttonStyles()}>
          Request a new link
        </Link>
      </AuthShell>
    );
  }

  return <ResetPasswordForm token={token} />;
}
