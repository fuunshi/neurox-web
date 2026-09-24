"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { FormBanner } from "@/components/auth/form-banner";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { authFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/errors";
import { useSubmit } from "@/lib/hooks/use-submit";
import {
  fieldErrorsFromZod,
  resetPasswordSchema,
} from "@/lib/validation/auth";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const { pending, error, fieldErrors, submit, setFieldErrors } = useSubmit();
  const [values, setValues] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const set = (key: keyof typeof values) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  /** An expired or already-used token cannot be retried — the only way forward
   *  is a new link, so the form is replaced rather than left enabled. */
  const deadToken =
    error && /token/i.test(error.messages.join(" ")) ? error : null;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    const parsed = resetPasswordSchema.safeParse({ token, ...values });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      return;
    }

    const outcome = await submit(() =>
      authFetch<{ ok: true }>("reset-password", {
        method: "POST",
        body: { token, newPassword: parsed.data.newPassword },
      }),
    );

    // The API revokes every token for the user on reset, so there is no session
    // to inherit — sign in with the new password.
    if (outcome.ok) router.replace("/auth/login?reset=1");
  }

  if (deadToken) {
    return (
      <AuthShell
        title="That link cannot be used"
        description={describeTokenProblem(deadToken)}
      >
        <Link
          href="/auth/forgot-password"
          className="inline-flex h-10 items-center rounded-md bg-accent px-4 font-medium text-accent-ink transition-colors hover:bg-accent-hover"
        >
          Request a new link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Set a new password"
      description="Choosing a new password signs you out everywhere else."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormBanner error={error} />

        <Field
          label="New password"
          required
          error={fieldErrors.newPassword}
          hint="At least 6 characters, with a lowercase letter, an uppercase letter, a number and a symbol."
        >
          <PasswordInput
            name="newPassword"
            autoComplete="new-password"
            required
            value={values.newPassword}
            onChange={(event) => set("newPassword")(event.target.value)}
          />
        </Field>

        <Field
          label="Confirm new password"
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

        <Button type="submit" loading={pending} className="mt-1 w-full">
          Set the password
        </Button>
      </form>
    </AuthShell>
  );
}

function describeTokenProblem(error: ApiError): string {
  const text = error.messages.join(" ");

  if (/expired/i.test(text)) {
    return "Reset links last 15 minutes, and this one has run out. Requesting another takes a moment.";
  }
  if (/already|used|no longer/i.test(text)) {
    return "This link has already been used, and each one works once. Request a new link to continue.";
  }
  return "This reset link is not valid any more. Request a new one to continue.";
}
