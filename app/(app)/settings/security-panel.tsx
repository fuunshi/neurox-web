"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormBanner } from "@/components/auth/form-banner";
import { Button, buttonStyles } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/api/client";
import { useSubmit } from "@/lib/hooks/use-submit";
import { fieldErrorsFromZod, otpSchema } from "@/lib/validation/auth";

/**
 * Sign-in settings.
 *
 * Password and enrolment are links rather than forms here, because each needs
 * its own screen: changing a password revokes every token the account holds, and
 * enrolling an authenticator needs a QR code and a confirmation step. Duplicating
 * either inline would mean two places to keep correct.
 *
 * Turning two-factor *off* is the exception, and is inline: it is one field and
 * one decision, and sending someone to a screen to remove a security measure
 * makes removing it feel like the considered path. It still asks for a current
 * code, so a borrowed session cannot quietly drop the second factor.
 */
export function SecurityPanel({
  twoFactorEnabled,
}: {
  twoFactorEnabled: boolean;
}) {
  const router = useRouter();
  const { pending, error, fieldErrors, submit, setFieldErrors } = useSubmit();
  const [disabling, setDisabling] = useState(false);
  const [otp, setOtp] = useState("");

  async function onDisable(event: React.FormEvent) {
    event.preventDefault();

    const parsed = otpSchema.safeParse(otp);
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      return;
    }

    const outcome = await submit(() =>
      authFetch<{ ok: true }>("mfa/disable", {
        method: "POST",
        body: { otp: parsed.data },
      }),
    );

    if (outcome.ok) {
      setDisabling(false);
      setOtp("");
      // The panel is told whether two-factor is on by the server, so it has to
      // ask the server again rather than assume the write it just made.
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-prose">
          <p className="font-medium">Password</p>
          <p className="text-sm text-ink-muted">
            Changing it signs you out on every device, including this one.
          </p>
        </div>
        <Link
          href="/auth/update-password"
          className={buttonStyles({ variant: "secondary", size: "sm" })}
        >
          Change password
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3 border-t border-line pt-5">
        <div className="max-w-prose">
          <p className="font-medium">Two-factor authentication</p>
          <p className="text-sm text-ink-muted">
            {twoFactorEnabled
              ? "An authenticator app is set up, and a code from it is asked for at every sign-in."
              : "An authenticator app, asked for alongside your password. Enrolling replaces any authenticator already set up for this account."}
          </p>
        </div>

        {twoFactorEnabled ? (
          <Button
            variant="danger"
            size="sm"
            onClick={() => setDisabling(true)}
            disabled={disabling}
          >
            Turn off
          </Button>
        ) : (
          <Link
            href="/auth/mfa?mode=setup"
            className={buttonStyles({ variant: "secondary", size: "sm" })}
          >
            Set up an authenticator
          </Link>
        )}
      </div>

      {disabling ? (
        <form
          onSubmit={onDisable}
          className="flex flex-col gap-4 rounded-lg border border-line bg-surface-2 p-4"
          noValidate
        >
          <FormBanner error={error} />

          <Field label="Six-digit code" required error={fieldErrors.otp}>
            <Input
              value={otp}
              // One-time codes are numeric and worth letting the OS offer, the
              // same as on the sign-in screen.
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              onChange={(event) =>
                setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              autoFocus
              required
            />
          </Field>

          <p className="max-w-prose text-sm text-ink-muted">
            Enter a code to confirm. With two-factor off, your password alone
            will be enough to sign in.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="danger" loading={pending}>
              Turn off two-factor
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDisabling(false);
                setOtp("");
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3 border-t border-line pt-5">
        <div className="max-w-prose">
          <p className="font-medium">Signing out everywhere</p>
          <p className="text-sm text-ink-muted">
            The sign-out control is in the account menu in the header. It ends
            every session for this account, not only this browser.
          </p>
        </div>
      </div>
    </div>
  );
}
