"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FormBanner } from "@/components/auth/form-banner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { authFetch } from "@/lib/api/client";
import type { MfaSetup } from "@/lib/api-types";
import type { ApiError } from "@/lib/errors";
import type { SubmitOutcome } from "@/lib/hooks/use-submit";
import { useSubmit } from "@/lib/hooks/use-submit";
import { fieldErrorsFromZod, otpSchema } from "@/lib/validation/auth";

interface StepProps {
  pending: boolean;
  error: ApiError | null;
  fieldErrors: Record<string, string>;
  submit: <T>(run: () => Promise<T>) => Promise<SubmitOutcome<T>>;
  setFieldErrors: (fields: Record<string, string>) => void;
  onDone: () => void;
}

export function MfaScreen({ mode }: { mode: "setup" | "verify" }) {
  const router = useRouter();
  const { pending, error, fieldErrors, submit, setFieldErrors } = useSubmit();

  // Both steps end in the same place, so this is built once. `refresh` after
  // `replace` re-renders the server components now that a session exists.
  const onDone = () => {
    router.replace("/decks");
    router.refresh();
  };

  const props: StepProps = {
    pending,
    error,
    fieldErrors,
    submit,
    setFieldErrors,
    onDone,
  };

  return mode === "setup" ? <SetupStep {...props} /> : <VerifyStep {...props} />;
}

/** A single six-digit field. `inputMode` and `autoComplete` make the phone
 *  keyboard a number pad and offer the OS's own code suggestion. */
function OtpField({
  value,
  onChange,
  error,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoFocus?: boolean;
}) {
  return (
    <Field label="Six-digit code" required error={error}>
      <Input
        name="otp"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        required
        autoFocus={autoFocus}
        value={value}
        // Digits only, so a pasted code with spaces or a stray dash still works.
        onChange={(event) =>
          onChange(event.target.value.replace(/\D/g, "").slice(0, 6))
        }
        className="text-center text-lg tracking-[0.4em] tabular-nums"
      />
    </Field>
  );
}

function VerifyStep({
  pending,
  error,
  fieldErrors,
  submit,
  setFieldErrors,
  onDone,
}: StepProps) {
  const [otp, setOtp] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    const parsed = otpSchema.safeParse(otp);
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      return;
    }

    const outcome = await submit(() =>
      authFetch<{ ok: true }>("mfa/verify", {
        method: "POST",
        body: { otp: parsed.data },
      }),
    );

    if (outcome.ok) onDone();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormBanner error={error} />
      <OtpField value={otp} onChange={setOtp} error={fieldErrors.otp} autoFocus />
      <Button type="submit" loading={pending} className="w-full">
        Verify and continue
      </Button>
    </form>
  );
}

function SetupStep({
  pending,
  error,
  fieldErrors,
  submit,
  setFieldErrors,
  onDone,
}: StepProps) {
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [otp, setOtp] = useState("");

  /**
   * Enrolling is a one-time side effect, so it belongs in an effect. It runs
   * exactly once and deliberately has no dependencies: the API replaces
   * `twoFactorSecret` on every call, so a re-run would silently invalidate the
   * entry the reader had already scanned into their authenticator.
   */
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await authFetch<{ ok: true; setup: MfaSetup }>(
          "mfa/setup",
          { method: "POST" },
        );
        if (!cancelled) setSetup(result.setup);
      } catch (thrown) {
        if (!cancelled) {
          setLoadError(
            thrown instanceof Error && "messages" in thrown
              ? (thrown as ApiError)
              : null,
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    const parsed = otpSchema.safeParse(otp);
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      return;
    }

    const outcome = await submit(() =>
      authFetch<{ ok: true; signedIn: boolean }>("mfa/enable", {
        method: "POST",
        body: { otp: parsed.data },
      }),
    );

    if (outcome.ok) onDone();
  }

  if (loadError) {
    return (
      <FormBanner error={loadError}>
        The authenticator setup could not be started. That usually means the
        sign-in has timed out — starting over will issue a fresh one.
      </FormBanner>
    );
  }

  if (!setup) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <p className="text-ink-muted">Preparing your authenticator key…</p>
        <Skeleton className="mx-auto size-44" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <ol className="flex list-none flex-col gap-4">
        <li className="flex flex-col gap-3">
          <p className="text-ink-muted">Scan this with your authenticator app.</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- a data URL,
              not a file, so next/image has nothing to optimise and would need a
              loader configured for inline sources. */}
          <img
            src={setup.qrCodeDataUrl}
            alt="QR code for adding neurox to an authenticator app"
            className="size-44 self-center rounded-md border border-line bg-surface p-2"
          />
        </li>

        <li className="flex flex-col gap-1.5">
          <p className="text-ink-muted">Cannot scan? Enter this key by hand:</p>
          <code className="rounded-md border border-line bg-surface-2 px-3 py-2 text-sm break-all">
            {setup.manualEntryCode}
          </code>
        </li>

        <li>
          <p className="text-ink-muted">
            Then enter the code it shows, to prove the pairing worked.
          </p>
        </li>
      </ol>

      <FormBanner error={error} />
      <OtpField value={otp} onChange={setOtp} error={fieldErrors.otp} />

      <Button type="submit" loading={pending} className="w-full">
        Turn on two-factor authentication
      </Button>

      {/* Worth stating plainly, because there is no undo for it. */}
      <p className="text-sm text-ink-subtle">
        Reloading this page issues a new key, which invalidates one already
        scanned. Finish here rather than starting again.
      </p>
    </form>
  );
}
