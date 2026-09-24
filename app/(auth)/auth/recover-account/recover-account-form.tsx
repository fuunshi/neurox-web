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
import { useSubmit } from "@/lib/hooks/use-submit";
import {
  fieldErrorsFromZod,
  recoverAccountSchema,
} from "@/lib/validation/auth";

/**
 * Restores a soft-deleted account inside its grace period.
 *
 * Reached from a recoverable-address conflict at registration, or directly. The
 * password is the proof of ownership, and it must be the one the account had —
 * this is a restore, not a reset.
 */
export function RecoverAccountForm({
  initialEmail,
}: {
  initialEmail?: string;
}) {
  const router = useRouter();
  const { pending, error, fieldErrors, submit, setFieldErrors } = useSubmit();
  const [values, setValues] = useState({
    email: initialEmail ?? "",
    password: "",
  });

  const set = (key: keyof typeof values) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    const parsed = recoverAccountSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      return;
    }

    const outcome = await submit(() =>
      authFetch<{ ok: true }>("recover-account", {
        method: "POST",
        body: { email: parsed.data.email, password: parsed.data.password },
      }),
    );

    // No tokens are issued on a restore, so this ends at sign-in — which is also
    // where a fresh verification email can be triggered if the old one lapsed.
    if (outcome.ok) {
      router.replace(
        `/auth/login?email=${encodeURIComponent(parsed.data.email)}`,
      );
    }
  }

  return (
    <AuthShell
      title="Restore your account"
      description="Deleted accounts keep their address for a grace period. Enter the password the account had to bring it back."
      footer={
        <Link href="/auth/register" className="text-accent hover:underline">
          Create a new account instead
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
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
          Restore the account
        </Button>

        {/* The API answers 401 for a wrong password, an unknown address and a
            closed grace period alike, so the copy covers all three rather than
            guessing which one it was. */}
        <p className="text-sm text-ink-subtle">
          The same message appears whether the password is wrong, the address has
          no recoverable account, or the grace period has ended.
        </p>
      </form>
    </AuthShell>
  );
}
