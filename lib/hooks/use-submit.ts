"use client";

import { useCallback, useState } from "react";
import { ApiError, networkError } from "@/lib/errors";

export type SubmitOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; error: ApiError };

export interface SubmitState {
  pending: boolean;
  error: ApiError | null;
  /** Field errors from the last failure — client-side or the API's. */
  fieldErrors: Record<string, string>;
}

/**
 * Runs one async submission and keeps the resulting error in a shape a form can
 * render.
 *
 * Deliberately not a data-fetching hook: these are one-shot commands with a
 * pending state and an error, and TanStack Query would be more machinery than
 * the job needs. Data reads are server components; data writes in the app use
 * Query mutations.
 *
 * The outcome is *returned* as well as stored. Callers need to classify failures
 * — a locked account and an unconfirmed address are not the same as a wrong
 * password — and doing that inside the event handler is what keeps the render
 * pure. Deriving it during render would mean parsing messages and reading the
 * clock while rendering, which React forbids for good reason.
 */
export function useSubmit() {
  const [state, setState] = useState<SubmitState>({
    pending: false,
    error: null,
    fieldErrors: {},
  });

  const clearError = useCallback(() => {
    setState({ pending: false, error: null, fieldErrors: {} });
  }, []);

  /** Lets client-side validation write into the same channel the API's field
   *  errors use, so a form renders both identically. */
  const setFieldErrors = useCallback((fields: Record<string, string>) => {
    setState((current) => ({ ...current, error: null, fieldErrors: fields }));
  }, []);

  const submit = useCallback(
    async <T,>(run: () => Promise<T>): Promise<SubmitOutcome<T>> => {
      setState({ pending: true, error: null, fieldErrors: {} });

      try {
        const value = await run();
        setState({ pending: false, error: null, fieldErrors: {} });
        return { ok: true, value };
      } catch (thrown) {
        const error =
          thrown instanceof ApiError ? thrown : networkError(thrown);

        setState({ pending: false, error, fieldErrors: error.fieldErrors });
        return { ok: false, error };
      }
    },
    [],
  );

  return { ...state, submit, clearError, setFieldErrors };
}
