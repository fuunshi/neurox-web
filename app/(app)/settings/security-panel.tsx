"use client";

import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";

/**
 * Sign-in settings.
 *
 * Both actions are links rather than forms here, because each needs its own
 * screen: changing a password revokes every token the account holds, and
 * enrolling an authenticator needs a QR code and a confirmation step. Duplicating
 * either inline would mean two places to keep correct.
 */
export function SecurityPanel() {
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
            An authenticator app, asked for alongside your password. Enrolling
            replaces any authenticator already set up for this account.
          </p>
        </div>
        <Link
          href="/auth/mfa?mode=setup"
          className={buttonStyles({ variant: "secondary", size: "sm" })}
        >
          Set up an authenticator
        </Link>
      </div>

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
