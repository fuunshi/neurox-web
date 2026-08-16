import "server-only";
import { cache } from "react";
import type {
  Activity,
  CursorPage,
  Deck,
  DeckStats,
  FlashCard,
  GenerationJob,
  KnowledgeGraph,
  QuizAttempt,
  QuizHistoryItem,
  Source,
  SourceDetail,
  StudyOverview,
  StudyPool,
  UserMetadata,
  UserProfile,
} from "@/lib/api-types";
import { apiFetch } from "./api";

/**
 * Server-side reads for the signed-in app.
 *
 * `cache` dedupes within a single request, so a layout and a page that both need
 * the same thing cause one call, not two. That matters beyond tidiness: the API
 * throttles per endpoint, and every request from this server shares one bucket.
 *
 * Every loader is scoped to the reader's own token by `apiFetch`, so none of
 * them take a user id — there is no way to ask for someone else's data by
 * passing the wrong argument.
 *
 * Query strings are built with `URLSearchParams` so a value needing escaping
 * cannot silently break the request.
 */

export const getViewer = cache(async (): Promise<UserMetadata> =>
  apiFetch<UserMetadata>("/user/metadata"),
);

export const listDecks = cache(
  async (options: { limit?: number; cursor?: string } = {}) => {
    const query = new URLSearchParams();
    query.set("limit", String(options.limit ?? 24));
    if (options.cursor) query.set("cursor", options.cursor);

    return apiFetch<CursorPage<Deck>>(`/decks?${query.toString()}`);
  },
);

export const getDeck = cache(async (deckId: string): Promise<Deck> =>
  apiFetch<Deck>(`/decks/${encodeURIComponent(deckId)}`),
);

export const listCards = cache(
  async (
    deckId: string,
    options: { limit?: number; cursor?: string; status?: string } = {},
  ) => {
    const query = new URLSearchParams();
    query.set("limit", String(options.limit ?? 50));
    if (options.cursor) query.set("cursor", options.cursor);
    if (options.status) query.set("status", options.status);

    return apiFetch<CursorPage<FlashCard>>(
      `/decks/${encodeURIComponent(deckId)}/cards?${query.toString()}`,
    );
  },
);

export const listSources = cache(
  async (options: { limit?: number; cursor?: string } = {}) => {
    const query = new URLSearchParams();
    query.set("limit", String(options.limit ?? 24));
    if (options.cursor) query.set("cursor", options.cursor);

    return apiFetch<CursorPage<Source>>(`/sources?${query.toString()}`);
  },
);

export const getSource = cache(async (sourceId: string): Promise<SourceDetail> =>
  apiFetch<SourceDetail>(`/sources/${encodeURIComponent(sourceId)}`),
);

/**
 * The cards to study now, with the deck's counts.
 *
 * One request rather than two: the API throttles per endpoint, and the study
 * screen cannot render without either.
 */
export const getStudyPool = cache(
  async (
    deckId: string,
    options: { limit?: number; include?: "due" | "all" } = {},
  ): Promise<StudyPool> => {
    const query = new URLSearchParams();
    query.set("limit", String(options.limit ?? 50));
    if (options.include) query.set("include", options.include);

    return apiFetch<StudyPool>(
      `/decks/${encodeURIComponent(deckId)}/study?${query.toString()}`,
    );
  },
);

export const getDeckStats = cache(
  async (deckId: string): Promise<DeckStats> =>
    apiFetch<DeckStats>(`/decks/${encodeURIComponent(deckId)}/stats`),
);

/** Everything the stats screen shows, in one request — see the API's note. */
export const getStudyOverview = cache(
  async (): Promise<StudyOverview> => apiFetch<StudyOverview>("/study/overview"),
);

/**
 * The reader's material as a graph.
 *
 * The response carries a `placeholder` flag rather than reporting a bare shape,
 * because part of it is synthetic and the page says so to the reader. A client
 * that hid that would be presenting a stand-in as a finding.
 */
export const getKnowledgeGraph = cache(
  async (): Promise<KnowledgeGraph> =>
    apiFetch<KnowledgeGraph>("/graph/knowledge"),
);

/**
 * One quiz attempt, with its questions and whatever has been answered.
 *
 * Not cached across requests — a quiz is a live, mutating thing, and a cached
 * paper would show a reader their answers from before they gave them.
 */
export const getQuizAttempt = (attemptId: string): Promise<QuizAttempt> =>
  apiFetch<QuizAttempt>(`/quizzes/attempts/${encodeURIComponent(attemptId)}`);

/** Past attempts, newest first. */
export const listQuizAttempts = cache(
  async (limit = 10): Promise<CursorPage<QuizHistoryItem>> =>
    apiFetch<CursorPage<QuizHistoryItem>>(
      `/quizzes/attempts?${new URLSearchParams({ limit: String(limit) })}`,
    ),
);

/**
 * The reader's own activity.
 *
 * `contextType` and `contextId` are required by the API and it only permits
 * `USER` with the caller's own id — anything else is a 403. Both are filled in
 * here from the session rather than accepted from a caller, so the feed cannot
 * be pointed at someone else, and the id never appears in a URL.
 */
export const listActivity = cache(
  async (
    userId: string,
    options: { limit?: number; cursor?: string } = {},
  ) => {
    const query = new URLSearchParams();
    query.set("contextType", "USER");
    query.set("contextId", userId);
    query.set("limit", String(options.limit ?? 30));
    if (options.cursor) query.set("cursor", options.cursor);

    return apiFetch<CursorPage<Activity>>(`/activities?${query.toString()}`);
  },
);

export const listGenerationJobs = cache(
  async (
    options: { deckId?: string; limit?: number } = {},
  ): Promise<CursorPage<GenerationJob>> => {
    const query = new URLSearchParams();
    query.set("limit", String(options.limit ?? 20));
    if (options.deckId) query.set("deckId", options.deckId);

    return apiFetch<CursorPage<GenerationJob>>(
      `/generation/jobs?${query.toString()}`,
    );
  },
);

export const getProfile = cache(async (): Promise<{ profile: UserProfile }> =>
  apiFetch<{ profile: UserProfile }>("/user/me/profile"),
);
