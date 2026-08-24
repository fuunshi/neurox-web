"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormBanner } from "@/components/auth/form-banner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/api/client";
import { useSubmit } from "@/lib/hooks/use-submit";

/**
 * Deleting your own account.
 *
 * Deliberately the last thing on the page and behind a confirmation, and it
 * asks for the password even though the reader is already signed in: this is
 * not undone by signing in again — it starts a clock — so a session borrowed
 * from an unlocked machine must not be able to do it.
 *
 * The deletion is soft. The API reports the deadline it just set, and that date
 * is shown rather than a vague "you have a few days", because the window is a
 * setting an administrator can change.
 */
export function DeleteAccount() {
  const router = useRouter();
  const { pending, error, fieldErrors, submit, setFieldErrors } = useSubmit();
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");

  async function onDelete() {
    if (!password) {
      setFieldErrors({ password: "Enter your password." });
      return;
    }

    const outcome = await submit(() =>
      authFetch<{ ok: true; recoverableUntil: string }>("delete-account", {
        method: "POST",
        body: { password },
      }),
    );

    if (outcome.ok) {
      setPassword("");
      setConfirming(false);
      // The session is gone with the account, so the signed-in shell has
      // nothing left to show.
      router.push("/auth/login");
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-prose">
          <p className="font-medium">Delete your account</p>
          <p className="text-sm text-ink-muted">
            Your decks, cards and review history stop being served. It is not
            immediate — the account can be restored for a short while
            afterwards, from the recovery screen, using your email and password.
          </p>
        </div>
        <Button
          variant="danger"
          size="sm"
          onClick={() => setConfirming(true)}
        >
          Delete account
        </Button>
      </div>

      <FormBanner error={error} />

      <ConfirmDialog
        open={confirming}
        title="Delete your account?"
        description={
          <div className="flex flex-col gap-3">
            <p>
              Everything in the account stops being served, and every device is
              signed out.
            </p>
            <Field label="Your password" required error={fieldErrors.password}>
              <Input
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
                autoFocus
                required
              />
            </Field>
          </div>
        }
        confirmLabel="Delete my account"
        destructive
        pending={pending}
        onConfirm={() => void onDelete()}
        onCancel={() => {
          setConfirming(false);
          setPassword("");
        }}
      />
    </div>
  );
}
