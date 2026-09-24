"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import {
  TERMINAL_JOB_STATUSES,
  type GenerationJob,
} from "@/lib/api-types";
import { ApiError } from "@/lib/errors";

/** Slow enough not to compete for the API's per-endpoint request budget, which
 *  this server shares across every reader. */
const INTERVAL_MS = 1500;

/** Roughly two minutes of polling. Beyond that something is wrong, and a
 *  request every 1.5s forever is worse than admitting it. */
const MAX_ATTEMPTS = 80;

export interface JobPollState {
  job: GenerationJob | null;
  /** Set when polling itself failed, not when the job failed. */
  error: ApiError | null;
  /** True when polling gave up without the job finishing. */
  stalled: boolean;
}

/**
 * Follows a generation job until it reaches a terminal status.
 *
 * Polling, rather than a socket, because the job is short-lived and the result
 * is a single row — a subscription would be more machinery than the problem
 * needs. The interval is deliberately not aggressive: the API throttles per
 * endpoint and every request from this server shares one budget.
 */
export function useJobPoll(
  jobId: string | null,
  initialJob: GenerationJob | null = null,
): JobPollState {
  const [state, setState] = useState<JobPollState>({
    job: initialJob,
    error: null,
    stalled: false,
  });

  // Kept in a ref so the effect does not restart on every state update — that
  // would reset the interval and hammer the endpoint.
  const attempts = useRef(0);

  useEffect(() => {
    if (!jobId) return;

    attempts.current = 0;
    let cancelled = false;

    // An interval in an effect, cleaned up on unmount or when the id changes.
    // This is what effects are for: synchronising with something outside React.
    const timer = setInterval(() => {
      void (async () => {
        attempts.current += 1;

        try {
          const job = await apiFetch<GenerationJob>(
            `generation/jobs/${jobId}`,
          );
          if (cancelled) return;

          setState({ job, error: null, stalled: false });

          if (TERMINAL_JOB_STATUSES.includes(job.status)) {
            clearInterval(timer);
          } else if (attempts.current >= MAX_ATTEMPTS) {
            clearInterval(timer);
            setState((current) => ({ ...current, stalled: true }));
          }
        } catch (thrown) {
          if (cancelled) return;

          clearInterval(timer);
          setState((current) => ({
            ...current,
            error:
              thrown instanceof ApiError
                ? thrown
                : new ApiError({
                    kind: "unknown",
                    messages: ["Could not check on that job."],
                  }),
          }));
        }
      })();
    }, INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [jobId]);

  return state;
}
