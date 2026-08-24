import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResendVerification } from "@/components/auth/resend-verification";
import { buttonStyles } from "@/components/ui/button";
import { ApiError } from "@/lib/errors";
import { upstreamJson } from "@/lib/server/upstream";

export const metadata = { title: "Confirm your email" };

// The token is single-use, so this must run per request rather than being
// prerendered or cached.
export const dynamic = "force-dynamic";

/**
 * Confirms an address from the link in the verification email.
 *
 * Verification happens **during the render**, on the server, so the token never
 * reaches client JavaScript. The API is called directly rather than through a
 * route handler — going out to `/api/auth/...` and back would put the token in a
 * URL the browser can see for no benefit.
 *
 * This is the one auth route not redirected away from when a session exists: a
 * signed-in reader clicking an old verification link should still learn what
 * happened.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.token;
  const token = Array.isArray(raw) ? raw[0] : raw;

  if (!token) {
    return (
      <Outcome
        title="That link is incomplete"
        body="The address is missing its verification token — usually because the link was cut in half by an email client wrapping it across lines. Ask for a new one and it will arrive intact."
        action={<ResendVerification />}
      />
    );
  }

  let message: string;
  try {
    const result = await upstreamJson<{ message: string }>(
      `/auth/verify-email?token=${encodeURIComponent(token)}`,
      { method: "GET" },
    );
    message = result.message ?? "";
  } catch (error) {
    return <Failure error={error} />;
  }

  // An already-verified address answers 200, not 400 — it is a success from the
  // reader's point of view, just not a new one.
  const alreadyVerified = /already verified/i.test(message);

  return (
    <AuthShell
      title={alreadyVerified ? "Already confirmed" : "Email confirmed"}
      description={
        alreadyVerified
          ? "This address was confirmed earlier, so there is nothing left to do."
          : "That address is confirmed. You can sign in now."
      }
      footer={
        <Link href="/auth/register" className="text-accent hover:underline">
          Create another account
        </Link>
      }
    >
      <Link href="/auth/login?verified=1" className={buttonStyles({ size: "lg" })}>
        Sign in
      </Link>
    </AuthShell>
  );
}

/** The API reports four distinct problems on this route, and they need
 *  different answers, so the message is matched rather than flattened. */
function Failure({ error }: { error: unknown }) {
  const apiError = error instanceof ApiError ? error : null;
  const text = apiError?.messages.join(" ") ?? "";

  if (/no longer valid/i.test(text)) {
    return (
      <Outcome
        title="That link has been used"
        body="Each verification link works once. If you have already confirmed this address, sign in. If you have not, ask for a new link."
        action={
          <div className="flex flex-col gap-3">
            <ResendVerification />
            <Link href="/auth/login" className={buttonStyles({ variant: "quiet" })}>
              Go to sign in
            </Link>
          </div>
        }
      />
    );
  }

  if (/expired/i.test(text)) {
    return (
      <Outcome
        title="That link has expired"
        body="Verification links last 15 minutes. Ask for a new one and it will arrive in a moment."
        action={
          <div className="flex flex-col gap-3">
            <ResendVerification />
            <Link href="/auth/login" className={buttonStyles({ variant: "quiet" })}>
              Go to sign in
            </Link>
          </div>
        }
      />
    );
  }

  return (
    <Outcome
      title="That link did not work"
      body={
        apiError?.summary ??
        "Something went wrong confirming this address. You can ask for a new link."
      }
      action={
        <div className="flex flex-col gap-3">
          <ResendVerification />
          <Link href="/auth/login" className={buttonStyles({ variant: "quiet" })}>
            Go to sign in
          </Link>
        </div>
      }
    />
  );
}

function Outcome({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action: React.ReactNode;
}) {
  return (
    <AuthShell title={title} description={body}>
      {action}
    </AuthShell>
  );
}
