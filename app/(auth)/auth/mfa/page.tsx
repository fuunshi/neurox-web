import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { buttonStyles } from "@/components/ui/button";
import { MfaScreen } from "./mfa-screen";

export const metadata = { title: "Two-factor authentication" };

/**
 * Both halves of the MFA flow, decided by `?mode=`.
 *
 * The two are separate steps of the same journey — `setup` enrols an
 * authenticator and immediately confirms it, `verify` confirms a code for an
 * authenticator that already exists — so they share one screen and one place to
 * explain what is happening.
 */
export default async function MfaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.mode;
  const mode = (Array.isArray(raw) ? raw[0] : raw) === "setup" ? "setup" : "verify";

  return (
    <AuthShell
      title={
        mode === "setup"
          ? "Set up two-factor authentication"
          : "Enter your code"
      }
      description={
        mode === "setup"
          ? "This account requires an authenticator app before you can continue."
          : "Open your authenticator app and enter the six-digit code it shows for neurox."
      }
      footer={
        // There is no way back into the flow from here: the temporary token that
        // authorises these steps is short-lived, so restarting is the honest
        // option rather than a back button that would fail confusingly.
        <Link href="/auth/login" className={buttonStyles({ variant: "quiet" })}>
          Start over
        </Link>
      }
    >
      <MfaScreen mode={mode} />
    </AuthShell>
  );
}
