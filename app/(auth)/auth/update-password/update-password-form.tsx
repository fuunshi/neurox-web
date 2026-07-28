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
import { useSubmit } from "@/lib/hooks/use-submit";
import {
  fieldErrorsFromZod,
  updatePasswordSchema,
} from "@/lib/validation/auth";

export function UpdatePasswordForm() {
  const router = useRouter();
  const { pending, error, fieldErrors, submit, setFieldErrors } = useSubmit();
  const [values, setValues] = useState({
    currentPassword: "",
    newPassword: "",
    newConfirmationPassword: "",
  });

  const set = (key: keyof typeof values) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    const parsed = updatePasswordSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      return;
    }

    const outcome = await submit(() =>
      authFetch<{ ok: true }>("update-password", {
        method: "POST",
        body: parsed.data,
      }),
    );

    // The API revokes every token belonging to the user on success, including
    // the one this request used, so there is never a session to continue with.
    if (outcome.ok) router.replace("/auth/login?reset=1");
  }

  return (
    <AuthShell
      title="Choose a new password"
      description="This account needs a new password before you can carry on."
      footer={
        <Link href="/auth/login" className="text-accent hover:underline">
          Sign in as someone else
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormBanner error={error} />

        <Field
          label="Current password"
          required
          error={fieldErrors.currentPassword}
        >
          <PasswordInput
            name="currentPassword"
            autoComplete="current-password"
            required
            value={values.currentPassword}
            onChange={(event) => set("currentPassword")(event.target.value)}
          />
        </Field>

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
          error={fieldErrors.newConfirmationPassword}
        >
          <PasswordInput
            name="newConfirmationPassword"
            autoComplete="new-password"
            required
            value={values.newConfirmationPassword}
            onChange={(event) =>
              set("newConfirmationPassword")(event.target.value)
            }
          />
        </Field>

        <Button type="submit" loading={pending} className="mt-1 w-full">
          Change the password
        </Button>

        {/* Signing out is offered because there is no "back" that makes sense
            here: returning to sign-in with the same account loops straight back
            to this screen. */}
        <p className="text-sm text-ink-subtle">
          Changing the password signs you out on every device.
        </p>
      </form>
    </AuthShell>
  );
}
