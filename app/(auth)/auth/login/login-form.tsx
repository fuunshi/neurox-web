"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { FormBanner } from "@/components/auth/form-banner";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/api/client";
import { APP_HOME } from "@/lib/server/routes";
import { LocalMailHint } from "@/components/auth/local-mail-hint";
import { isUnverifiedEmail, parseLockoutUntil } from "@/lib/errors";
import { useSubmit } from "@/lib/hooks/use-submit";
import { fieldErrorsFromZod, loginSchema } from "@/lib/validation/auth";

/** Mirrors `LoginStep` in api-types. */
type Step = "UPDATE_PASSWORD" | "MFA_SETUP_REQUIRED" | "MFA_REQUIRED";

const STEP_TARGETS: Record<Step, string> = {
  UPDATE_PASSWORD: "/auth/update-password",
  // Both MFA steps land on one screen, which renders the right half of the flow.
  MFA_SETUP_REQUIRED: "/auth/mfa?mode=setup",
  MFA_REQUIRED: "/auth/mfa?mode=verify",
};

/**
 * A failure that is not really an error: neither of these belongs in a red box,
 * because neither is fixed by trying again with the same details.
 */
type Screen =
  | { kind: "form" }
  | { kind: "unverified" }
  | { kind: "locked"; until: Date; minutes: number };

export function LoginForm({
  next,
  initialEmail,
  justVerified,
  justReset,
}: {
  next?: string;
  initialEmail?: string;
  justVerified: boolean;
  justReset: boolean;
}) {
  const router = useRouter();
  const { pending, error, fieldErrors, submit, clearError, setFieldErrors } =
    useSubmit();

  const [values, setValues] = useState({
    email: initialEmail ?? "",
    password: "",
  });
  const [screen, setScreen] = useState<Screen>({ kind: "form" });

  const set = (key: keyof typeof values) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      return;
    }

    const outcome = await submit(() =>
      authFetch<{ ok: true; step?: Step }>("login", {
        method: "POST",
        body: { email: parsed.data.email, password: parsed.data.password },
      }),
    );

    if (!outcome.ok) {
      // Classified here, in the handler, rather than during render: reading the
      // clock for a relative time is impure, and React is right to forbid it in
      // a render pass. It also guarantees this text never renders on the server,
      // so its locale-formatted dates cannot mismatch on hydration.
      if (isUnverifiedEmail(outcome.error)) {
        setScreen({ kind: "unverified" });
        return;
      }

      const until = parseLockoutUntil(outcome.error);
      if (until) {
        setScreen({
          kind: "locked",
          until,
          minutes: Math.max(
            1,
            Math.ceil((until.getTime() - Date.now()) / 60_000),
          ),
        });
      }
      return;
    }

    if (outcome.value.step) {
      router.push(STEP_TARGETS[outcome.value.step]);
      return;
    }

    // `next` arrives from a query string, so only a same-site path is honoured —
    // an absolute URL here would be an open redirect.
    const target =
      next && next.startsWith("/") && !next.startsWith("//")
        ? next
        : APP_HOME;

    router.replace(target);
    // Re-render server components so the new session is picked up.
    router.refresh();
  }

  const notice = justVerified
    ? "Your email address is confirmed. Sign in to continue."
    : justReset
      ? "Your password has been changed. Sign in with the new one."
      : null;

  if (screen.kind === "unverified") {
    return (
      <AuthShell
        title="Confirm your email first"
        description={
          <>
            Sign-in is blocked until <strong>{values.email}</strong> is
            confirmed. Open the link in the email we sent, then come back.
          </>
        }
        footer={
          <button
            type="button"
            onClick={() => {
              clearError();
              setScreen({ kind: "form" });
            }}
            className="cursor-pointer text-accent hover:underline"
          >
            Use a different address
          </button>
        }
      >
        <p className="text-ink-muted">
          The link is valid for 15 minutes. If it has expired, signing in again
          sends a fresh one.
        </p>
        <LocalMailHint />
      </AuthShell>
    );
  }

  if (screen.kind === "locked") {
    return (
      <AuthShell
        title="Too many attempts"
        description={
          <>
            This account is locked until{" "}
            <time dateTime={screen.until.toISOString()}>
              {screen.until.toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              })}
            </time>{" "}
            — about {screen.minutes}{" "}
            {screen.minutes === 1 ? "minute" : "minutes"} from now.
          </>
        }
        footer={
          <Link
            href="/auth/forgot-password"
            className="text-accent hover:underline"
          >
            Reset the password instead
          </Link>
        }
      >
        <p className="text-ink-muted">
          Nothing is wrong with the account itself. Waiting it out, or resetting
          the password, both clear the lock.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Sign in"
      description="Your decks and sources are where you left them."
      footer={
        <>
          No account yet?{" "}
          <Link href="/auth/register" className="text-accent hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {notice ? <FormBanner tone="accent">{notice}</FormBanner> : null}
        <FormBanner error={error} />

        <Field label="Email" required error={fieldErrors.email}>
          <Input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={values.email}
            onChange={(event) => set("email")(event.target.value)}
          />
        </Field>

        <Field label="Password" required error={fieldErrors.password}>
          <PasswordInput
            name="password"
            autoComplete="current-password"
            required
            value={values.password}
            onChange={(event) => set("password")(event.target.value)}
          />
        </Field>

        <Button type="submit" loading={pending} className="mt-1 w-full">
          Sign in
        </Button>

        <Link
          href="/auth/forgot-password"
          className="self-start text-sm text-accent hover:underline"
        >
          Forgotten your password?
        </Link>
      </form>
    </AuthShell>
  );
}

