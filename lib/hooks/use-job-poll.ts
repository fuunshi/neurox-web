"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import {
  TERMINAL_JOB_STATUSES,
  type GenerationJob,
  type JobUpdatedMessage,
  type RealtimeErrorMessage,
} from "@/lib/api-types";
import { ApiError } from "@/lib/errors";
import {
  onRealtimeEvent,
  subscribeTopic,
  unsubscribeTopic,
} from "@/lib/realtime/client";

/** Slow enough not to compete for the API's per-endpoint request budget, which
 *  this server shares across every reader. */
const INTERVAL_MS = 1500;

/** Roughly two minutes of polling. Beyond that something is wrong, and a
 *  request every 1.5s forever is worse than admitting it. */
const MAX_ATTEMPTS = 80;

/** The event the API pushes when a generation run changes state. */
const JOB_UPDATED_EVENT = "job:updated";

/** The event the API answers on when it will not carry out a message — here,
 *  a subscription it refused. */
const REALTIME_ERROR_EVENT = "realtime:error";

export interface JobPollState {
  job: GenerationJob | null;
  /** Set when polling itself failed, not when the job failed. */
  error: ApiError | null;
  /** True when polling gave up without the job finishing. */
  stalled: boolean;
  /** True when the server refused this client's subscription to the deck, so
   *  pushes will not arrive and polling is the only way this screen hears
   *  anything. Not an error: the screen still works, it just works the slower
   *  way, and saying so is better than looking identical to a quiet deck. */
  subscriptionRefused: boolean;
}

export interface JobPollResult extends JobPollState {
  /** Polls again after giving up — for a job that is still running server-side. */
  restart: () => void;
}

/** What this hook stores. `subscriptionRefused` is absent because it is derived
 *  from which topic was refused rather than stored — see the return below. */
type JobPollCore = Omit<JobPollState, "subscriptionRefused">;

/**
 * Follows a generation job until it reaches a terminal status.
 *
 * ## Polling, with a socket in front of it
 *
 * A generation run is the longest thing a reader waits for in this product, and
 * asking every 1.5 seconds whether it has finished was always a stand-in for
 * not having a socket. Now there is one, so the API pushes `job:updated` and
 * this fetches the moment it hears — the interval drops from "how you find out"
 * to "how you recover if the socket never connects".
 *
 * The push deliberately does **not** carry the job itself. Its payload is the
 * queue's view — status and a card count — while the screen also renders the
 * provider and the deck, so the event is treated as a nudge to re-read rather
 * than as the record. That keeps one shape of `GenerationJob` in the app, and
 * means a push arriving mid-write cannot show a half-updated card.
 *
 * ## Two ways to stop
 *
 * The interval stops when the job reaches a terminal status, and — separately —
 * after `MAX_ATTEMPTS`, which reports `stalled` rather than spinning forever.
 * The socket does not extend that budget: a run that is genuinely stuck should
 * still give up at the same point whether or not a socket is open.
 */
export function useJobPoll(
  jobId: string | null,
  initialJob: GenerationJob | null = null,
  /** The deck the job belongs to, so this client can watch that deck's topic.
   *  Without it, notifications still arrive; only deck-scoped pushes are missed. */
  deckId?: string | null,
): JobPollResult {
  const [state, setState] = useState<JobPollCore>({
    job: initialJob,
    error: null,
    stalled: false,
  });

  // Kept in a ref so the effect does not restart on every state update — that
  // would reset the interval and hammer the endpoint.
  const attempts = useRef(0);
  // Bumped by `restart`. It is in the effect's dependencies precisely so that
  // asking for another round tears the old interval down and starts a new one.
  const [round, setRound] = useState(0);
  // Which topic was refused, rather than a boolean about "the current one":
  // keyed by name, switching decks clears the flag by itself, with no effect
  // setting state on the way in.
  const [refusedTopic, setRefusedTopic] = useState<string | null>(null);
  // Whether the interval is still wanted. A ref rather than state because the
  // socket's nudge and the interval's own tick both consult it without wanting
  // a re-render.
  const watching = useRef(false);

  const restart = useCallback(() => {
    setState((current) => ({ ...current, stalled: false }));
    setRound((n) => n + 1);
  }, []);

  /** One read of the job, and the decision about whether to keep going. */
  const read = useCallback(async (): Promise<boolean> => {
    if (!jobId) return false;

    try {
      const job = await apiFetch<GenerationJob>(`generation/jobs/${jobId}`);

      setState({ job, error: null, stalled: false });

      if (TERMINAL_JOB_STATUSES.includes(job.status)) {
        watching.current = false;
        return false;
      }

      return true;
    } catch (thrown) {
      watching.current = false;
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
      return false;
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;

    attempts.current = 0;
    watching.current = true;

    // An interval in an effect, cleaned up on unmount or when the id changes.
    // This is what effects are for: synchronising with something outside React.
    const timer = setInterval(() => {
      if (!watching.current) return;

      void (async () => {
        attempts.current += 1;

        const keepGoing = await read();

        if (keepGoing && attempts.current >= MAX_ATTEMPTS) {
          watching.current = false;
          setState((current) => ({ ...current, stalled: true }));
        }
      })();
    }, INTERVAL_MS);

    return () => {
      watching.current = false;
      clearInterval(timer);
    };
  }, [jobId, round, read]);

  /**
   * The socket's nudge: a push for this job means read it now.
   *
   * `watching` is checked so a push that arrives after the job finished — or
   * after the reader cancelled — does not resurrect a request the interval had
   * already stopped.
   */
  useEffect(() => {
    if (!jobId) return;

    return onRealtimeEvent(JOB_UPDATED_EVENT, (payload) => {
      const message = payload as JobUpdatedMessage | null;
      if (message?.jobId !== jobId) return;
      if (!watching.current) return;

      void read();
    });
  }, [jobId, read]);

  /**
   * Watch the deck, so a run started in another tab is heard here too.
   *
   * This is the subscription framework doing what it is for: the socket carries
   * more than notifications, and a screen that wants a specific stream asks for
   * it by name rather than polling for it.
   */
  useEffect(() => {
    if (!deckId) return;

    const topic = `deck:${deckId}`;

    // A refusal is answered, not silent — and without reading it, a refused
    // subscription is indistinguishable from a deck where nothing is happening.
    const offRefusal = onRealtimeEvent(REALTIME_ERROR_EVENT, (payload) => {
      const message = payload as RealtimeErrorMessage | null;
      // Only this deck's refusal. A handler failure carries no topic, and a
      // refusal for some other topic says nothing about this subscription.
      if (message?.topic !== topic) return;
      setRefusedTopic(topic);
    });

    subscribeTopic(topic);

    return () => {
      offRefusal();
      unsubscribeTopic(topic);
    };
  }, [deckId]);

  return {
    ...state,
    // Derived rather than stored, so it cannot disagree with the deck this hook
    // is actually watching.
    subscriptionRefused: deckId != null && refusedTopic === `deck:${deckId}`,
    restart,
  };
}
