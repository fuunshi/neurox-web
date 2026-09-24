import "server-only";
import { cache } from "react";
import type {
  CursorPage,
  Deck,
  FlashCard,
  Source,
  UserMetadata,
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
