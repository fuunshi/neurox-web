import "server-only";
import type { CurriculumNode, NoteDetail, NoteSummary } from "@/lib/api-types";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { apiFetch } from "./api";

/**
 * Every public loader, and the only place public data is fetched.
 *
 * Three rules hold this together, and all three are why it is one file:
 *
 * 1. **Caching wraps the loader, not the `fetch`.** `unstable_cache` is
 *    consulted before the function body runs, so a cache hit never reaches
 *    `upstreamFetch` — which means it also never reaches `throttle()`. That
 *    matters more than it looks: `upstreamFetch` rate-limits *before* fetching,
 *    so caching at the fetch layer would still spend a slot in the frontend's
 *    own outbound budget on every reader request, and the budget is per-IP and
 *    shared with the whole signed-in app. Because the cache sits here instead,
 *    a hit costs neither a rate-limit slot nor an API call nor the row the API
 *    would otherwise write to `request_log`.
 *
 * 2. **Anonymous, always.** These loaders pass `anonymous: true`, so no session
 *    is read and no token is attached. They also never forward a client IP:
 *    that would both vary the API's throttler key per reader and leak a
 *    per-reader dimension into a response that a shared cache may hand to
 *    somebody else. A loader here must be safe to serve to anyone.
 *
 * 3. **Nothing here may read `cookies()` or `headers()`.** Not a style rule —
 *    it is what lets the pages above be prerendered and cached at all. A single
 *    request-time read in this tree makes every public page dynamic, which is
 *    the whole thing this design exists to avoid.
 *
 * `unstable_cache` is documented as superseded by `"use cache"`, which needs
 * `cacheComponents: true` — see the note in the plan. Keeping every public
 * loader in this one module is what makes that migration a rewrite of one file.
 */

/** An hour. Publishing also invalidates explicitly, so this is the backstop for
 *  anything that changes without going through the publish path. */
const REVALIDATE_SECONDS = 3600;

export const CONTENT_TAGS = {
  tree: "taxonomy:tree",
  note: "content:note",
} as const;

/**
 * The whole syllabus tree.
 *
 * One cached call answers the sitemap, the breadcrumb, every index page and
 * `generateStaticParams`. It is a few hundred rows and changes a handful of
 * times a year, so the alternative — a request per level — would be more round
 * trips to keep in step.
 *
 * Returns an empty array rather than throwing when the API cannot be reached,
 * because this feeds `generateStaticParams` and the sitemap: a build in an
 * environment with no API running should produce a site that renders on demand,
 * not a failed build. The warning is deliberate — degrading quietly is how a
 * misconfigured `BACKEND_BASE_URL` reaches production unnoticed.
 */
export const getCurriculumTree = cache(
  unstable_cache(
    async (): Promise<CurriculumNode[]> => {
      try {
        return await apiFetch<CurriculumNode[]>("/content/tree", {
          anonymous: true,
        });
      } catch (error) {
        console.warn(
          `[content] Could not load the syllabus tree: ${
            error instanceof Error ? error.message : String(error)
          }. Prerendering nothing; pages will render on demand.`,
        );
        return [];
      }
    },
    ["content:tree"],
    { revalidate: REVALIDATE_SECONDS, tags: [CONTENT_TAGS.tree] },
  ),
);

/** One published note, with its body and breadcrumb trail. */
export const getNote = cache(
  unstable_cache(
    async (slug: string): Promise<NoteDetail> =>
      apiFetch<NoteDetail>(`/content/notes/${encodeURIComponent(slug)}`, {
        anonymous: true,
      }),
    ["content:note"],
    { revalidate: REVALIDATE_SECONDS, tags: [CONTENT_TAGS.note] },
  ),
);

/**
 * Published notes, newest first, optionally under one node.
 *
 * The limit is an argument rather than a closure default on purpose: the cache
 * key includes the arguments, so a value read from the enclosing scope would
 * change what is cached without changing the key.
 */
export const listNotes = cache(
  unstable_cache(
    async (path: string | null, limit: number): Promise<NoteSummary[]> => {
      const query = new URLSearchParams({ limit: String(limit) });
      if (path) query.set("path", path);

      try {
        return await apiFetch<NoteSummary[]>(
          `/content/notes?${query.toString()}`,
          { anonymous: true },
        );
      } catch {
        // Same reasoning as the tree: a listing that cannot load should empty a
        // section of a page, not fail the build that is rendering it.
        return [];
      }
    },
    ["content:notes"],
    { revalidate: REVALIDATE_SECONDS, tags: [CONTENT_TAGS.note] },
  ),
);

/* ------------------------------------------------------------------ *
 * Derived helpers. Pure functions over the tree — no fetching, so they
 * are free to call and need no caching of their own.
 * ------------------------------------------------------------------ */

/** The node at `path`, if the tree has one. */
export function nodeAt(
  tree: CurriculumNode[],
  path: string,
): CurriculumNode | undefined {
  return tree.find((node) => node.path === path);
}

/** Direct children of `path`, in display order. */
export function childrenOf(
  tree: CurriculumNode[],
  path: string,
): CurriculumNode[] {
  return tree
    .filter((node) => node.parentPath === path)
    .sort((a, b) => a.ordinal - b.ordinal);
}

/** Every node at or below `path`, optionally limited to one kind. */
export function descendantsOf(
  tree: CurriculumNode[],
  path: string,
  kind?: CurriculumNode["kind"],
): CurriculumNode[] {
  const prefix = `${path}/`;

  return tree
    .filter((node) => node.path.startsWith(prefix))
    .filter((node) => (kind ? node.kind === kind : true))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/** The trail from the root down to and including `path`. */
export function pathTo(
  tree: CurriculumNode[],
  path: string,
): CurriculumNode[] {
  const parts = path.split("/");

  return parts
    .map((_, index) => nodeAt(tree, parts.slice(0, index + 1).join("/")))
    .filter((node): node is CurriculumNode => node !== undefined);
}

/** A node's own URL. The tree stores paths; URLs are a frontend concern. */
export function urlFor(path: string): string {
  return `/${path}`;
}

/**
 * The short name of a node, for title tags.
 *
 * "BCA (Bachelor of Computer Applications)" becomes "BCA". A title tag has
 * roughly 60 characters before a search engine truncates it and the root
 * template spends nine of them on "— neurox", so a full expansion plus a
 * qualifier does not fit — and a truncated title loses exactly the words that
 * made it worth writing.
 *
 * A title with no bracket is returned whole, so this is safe on nodes that
 * never had an expansion.
 */
export function shortTitle(node: Pick<CurriculumNode, "title">): string {
  return node.title.split("(")[0].trim() || node.title;
}

/** Where a note lives, given the node it hangs off. */
export function noteUrl(note: Pick<NoteSummary, "nodePath" | "slug">): string {
  return `/${note.nodePath}/notes/${note.slug}`;
}
