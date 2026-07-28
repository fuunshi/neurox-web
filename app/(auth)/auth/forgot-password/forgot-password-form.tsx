"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { FormBanner } from "@/components/auth/form-banner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/api/client";
import { useSubmit } from "@/lib/hooks/use-submit";
import { fieldErrorsFromZod, forgotPasswordSchema } from "@/lib/validation/auth";

export function ForgotPasswordForm() {
  const { pending, error, fieldErrors, submit, setFieldErrors } = useSubmit();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      return;
    }

    const outcome = await submit(() =>
      authFetch<{ ok: true }>("forgot-password", {
        method: "POST",
        body: { email: parsed.data.email },
      }),
    );

    if (outcome.ok) setSent(true);
  }

  if (sent) {
    return (
      <AuthShell
        title="Check your inbox"
        description={
          <>
            If an account exists for <strong>{email}</strong>, a reset link is on
            its way.
          </>
        }
        footer={
          <Link href="/auth/login" className="text-accent hover:underline">
            Back to sign in
          </Link>
        }
      >
        {/* The wording above is conditional on purpose: the API answers
            identically whether or not the address exists, so that this endpoint
            cannot be used to discover who has an account. A message that
            confirmed the address would give that away. */}
        <p className="text-ink-muted">
          The link is valid for 15 minutes. If nothing arrives, the address may
          not have an account — creating one takes a minute.
        </p>
        <p className="mt-4 rounded-md border border-line bg-surface-2 px-3.5 py-3 text-sm text-ink-muted">
          Running this locally? Read the message in Mailpit at{" "}
          <a
            href="http://localhost:8025"
            className="text-accent hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            localhost:8025
          </a>
          .
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      description="Give us the address on the account and we will send a link to set a new password."
      footer={
        <Link href="/auth/login" className="text-accent hover:underline">
          Back to sign in
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
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>

        <Button type="submit" loading={pending} className="mt-1 w-full">
          Send the link
        </Button>
      </form>
    </AuthShell>
  );
}
