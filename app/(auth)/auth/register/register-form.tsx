"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { FormBanner } from "@/components/auth/form-banner";
import { LocalMailHint } from "@/components/auth/local-mail-hint";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/api/client";
import { useSubmit } from "@/lib/hooks/use-submit";
import { fieldErrorsFromZod, registerSchema } from "@/lib/validation/auth";

const EMPTY = {
  firstName: "",
  lastName: "",
  email: "",
  username: "",
  password: "",
  confirmPassword: "",
  phoneNumber: "",
};

export function RegisterForm() {
  const { pending, error, fieldErrors, submit, setFieldErrors } = useSubmit();
  const [values, setValues] = useState(EMPTY);
  const [created, setCreated] = useState<string | null>(null);

  const set = (key: keyof typeof values) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  /**
   * A recently deleted account still owns its address, and the API answers 409
   * with `code: "ACCOUNT_RECOVERABLE"` and a deadline. Registering again cannot
   * work, so this is a fork in the flow rather than an error to retry — the way
   * out is restoring the old account.
   */
  const recoverable = error?.isRecoverableAccount ? error : null;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    const parsed = registerSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      return;
    }

    const outcome = await submit(() =>
      authFetch<{ ok: true; email: string; username: string }>("register", {
        method: "POST",
        body: {
          firstName: parsed.data.firstName,
          // Empty optional strings are dropped so the API sees an absent field
          // rather than an empty one.
          lastName: parsed.data.lastName || undefined,
          email: parsed.data.email,
          username: parsed.data.username,
          password: parsed.data.password,
          confirmPassword: parsed.data.confirmPassword,
          phoneNumber: parsed.data.phoneNumber || undefined,
        },
      }),
    );

    if (outcome.ok) setCreated(outcome.value.email);
  }

  if (created) {
    return (
      <AuthShell
        title="Confirm your email"
        description={
          <>
            We sent a link to <strong>{created}</strong>. Open it and your
            account is ready.
          </>
        }
        footer={
          <Link href="/auth/login" className="text-accent hover:underline">
            Back to sign in
          </Link>
        }
      >
        <p className="text-ink-muted">
          The link is valid for 15 minutes. Nothing else is needed from you in
          the meantime — no account is usable until the address is confirmed.
        </p>
        <LocalMailHint />
      </AuthShell>
    );
  }

  if (recoverable) {
    return (
      <AuthShell
        title="That address is still recoverable"
        description={
          <>
            An account with this address was deleted recently. Its address is
            held until{" "}
            {recoverable.recoverableUntil
              ? new Date(recoverable.recoverableUntil).toLocaleDateString(
                  undefined,
                  { day: "numeric", month: "long", year: "numeric" },
                )
              : "the grace period ends"}
            , so a new account cannot use it yet.
          </>
        }
      >
        <p className="text-ink-muted">
          If it was yours, you can restore it with the password it had. If it was
          not, wait for the date above and register again.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            href={`/auth/recover-account?email=${encodeURIComponent(values.email)}`}
            className="inline-flex h-10 items-center rounded-md bg-accent px-4 font-medium text-accent-ink transition-colors hover:bg-accent-hover"
          >
            Restore that account
          </Link>
          <Link
            href="/auth/login"
            className="text-sm text-accent hover:underline"
          >
            Or sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create an account"
      description="One account holds your sources, decks and cards."
      footer={
        <>
          Already have one?{" "}
          <Link href="/auth/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormBanner error={error} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" required error={fieldErrors.firstName}>
            <Input
              name="firstName"
              autoComplete="given-name"
              required
              value={values.firstName}
              onChange={(event) => set("firstName")(event.target.value)}
            />
          </Field>

          <Field label="Last name" error={fieldErrors.lastName}>
            <Input
              name="lastName"
              autoComplete="family-name"
              value={values.lastName}
              onChange={(event) => set("lastName")(event.target.value)}
            />
          </Field>
        </div>

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

        <Field
          label="Username"
          required
          error={fieldErrors.username}
          hint="Lowercase letters, numbers and underscores."
        >
          <Input
            name="username"
            autoComplete="username"
            required
            value={values.username}
            onChange={(event) => set("username")(event.target.value)}
          />
        </Field>

        <Field
          label="Password"
          required
          error={fieldErrors.password}
          hint="At least 6 characters, with a lowercase letter, an uppercase letter, a number and a symbol."
        >
          <PasswordInput
            name="password"
            autoComplete="new-password"
            required
            value={values.password}
            onChange={(event) => set("password")(event.target.value)}
          />
        </Field>

        <Field
          label="Confirm password"
          required
          error={fieldErrors.confirmPassword}
        >
          <PasswordInput
            name="confirmPassword"
            autoComplete="new-password"
            required
            value={values.confirmPassword}
            onChange={(event) => set("confirmPassword")(event.target.value)}
          />
        </Field>

        <Field label="Phone number" error={fieldErrors.phoneNumber}>
          <Input
            type="tel"
            name="phoneNumber"
            autoComplete="tel"
            value={values.phoneNumber}
            onChange={(event) => set("phoneNumber")(event.target.value)}
          />
        </Field>

        <Button type="submit" loading={pending} className="mt-1 w-full">
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
