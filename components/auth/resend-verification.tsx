"use client";

import { useState } from "react";
import { FormBanner } from "@/components/auth/form-banner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/api/client";
import { useSubmit } from "@/lib/hooks/use-submit";
import { emailSchema, fieldErrorsFromZod } from "@/lib/validation/auth";

/**
 * Ask for a new verification link.
 *
 * Exists because the alternative was absurd: the only way to trigger a resend
 * was to attempt a login that would be refused for being unverified. Someone
 * who cannot sign in should not have to try.
 *
 * Collapsed to a single button, because it is the second thing a reader wants
 * here — after reading why their link did not work.
 */
export function ResendVerification({ defaultEmail = "" }: { defaultEmail?: string }) {
  const { pending, error, fieldErrors, submit, setFieldErrors } = useSubmit();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      return;
    }

    const outcome = await submit(() =>
      authFetch<{ ok: true }>("resend-verification", {
        method: "POST",
        body: { email: parsed.data },
      }),
    );

    if (outcome.ok) setSent(true);
  }

  if (sent) {
    // Deliberately conditional, like the reset screen: the API answers the same
    // way whether or not the address has an unverified account, and a message
    // that confirmed it would undo that.
    return (
      <p className="text-sm text-ink-muted">
        If <strong className="font-medium text-ink">{email}</strong> is waiting
        to be confirmed, a new link is on its way. It works once and lasts 15
        minutes.
      </p>
    );
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Send a new link
      </Button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-3" noValidate>
      <FormBanner error={error} />

      <Field label="Email" required error={fieldErrors.email}>
        <Input
          type="email"
          name="email"
          autoComplete="email"
          required
          autoFocus
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending}>
          Send the link
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setEmail(defaultEmail);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
