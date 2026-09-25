import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ALLOWED_ROOTS } from "./proxy-roots";

/**
 * Guards the proxy's allow-list against the client code obliged to obey it.
 *
 * `ALLOWED_ROOTS` and the browser's calls are two halves of one contract that
 * live in different files, and nothing connected them: adding
 * `apiFetch("notifications/…")` to a component was enough to produce a request
 * the BFF answers 404 to before it ever reaches the API. No test, lint rule or
 * type error stood in the way, and the failure is quiet by construction — the
 * proxy's 404 has the same shape as any other missing endpoint, and the bell
 * renders it as its empty state. It was found by reading logs.
 *
 * A source scan rather than a rendered test, because the property being
 * checked belongs to the codebase rather than to any one call: *every* call
 * site, present and future, has to name an allowed root. Counts are asserted
 * alongside the roots for the same reason — a scan that quietly stops finding
 * call sites would pass forever while guarding nothing.
 */

const SOURCE_DIRS = ["app", "components", "lib"];
const SKIPPED_DIRS = new Set(["node_modules", ".next"]);

/**
 * The client helpers whose path the proxy has to allow.
 *
 * Matched by import rather than by name, because there are two `apiFetch`
 * functions: this one, which goes through the proxy, and the server's in
 * `lib/server/api.ts`, which calls the API directly and is deliberately free to
 * use roots that are not listed (`study`, `analytics`, `graph`, `auth`).
 * Scanning by name alone would flag every server loader as a violation.
 */
const BROWSER_FETCH_IMPORT = /from\s+["']@\/lib\/api\/client["']/;
const CURSOR_LIST_IMPORT = /from\s+["']@\/lib\/hooks\/use-cursor-list["']/;

/**
 * A call's opening parenthesis, reached without crossing a newline.
 *
 * `[^(\n]*` rather than a generic matcher so nested type arguments
 * (`apiFetch<CursorPage<T>>(`) need no balancing, and so the scan cannot run
 * past the end of a statement and pair a call with a parenthesis several lines
 * below it.
 */
const API_FETCH_CALL = /apiFetch[^(\n]*\(/g;
const CURSOR_LIST_CALL = /useCursorList[^(\n]*\(/g;

type Call = {
  file: string;
  /** The first argument as written, or null when it is not a string literal. */
  argument: string | null;
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIPPED_DIRS.has(entry.name)) return [];

    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);

    // Tests assert the client contract against a mocked client, so they say
    // nothing about whether the path would survive the proxy.
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) {
      return [];
    }

    return [path];
  });
}

/** `decks/${id}/cards?limit=50` → `decks`; `notifications?limit=20` → `notifications`. */
function rootOf(literal: string): string {
  return literal.replace(/^\/+/, "").split(/[/?]/)[0];
}

/** The string literal at `index`, or null when the code there is not one. */
function literalAt(text: string, index: number): string | null {
  const rest = text.slice(index).replace(/^\s+/, "");
  const match = /^(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/.exec(rest);
  if (!match) return null;

  return match[1] ?? match[2] ?? match[3] ?? null;
}

/** The literal in the second argument, which is where `useCursorList` takes its path. */
function secondArgument(text: string, index: number): string | null {
  const comma = text.indexOf(",", index);
  return comma === -1 ? null : literalAt(text, comma + 1);
}

function calls(
  file: string,
  text: string,
  opener: RegExp,
  read: (text: string, index: number) => string | null,
): Call[] {
  return [...text.matchAll(opener)].map((match) => ({
    file,
    argument: read(text, match.index + match[0].length),
  }));
}

/**
 * A path whose first segment is interpolated, so the root is the caller's and
 * not this file's.
 *
 * There is exactly one, and it is the point of `useCursorList`: the hook
 * appends `?cursor=…` to a base path its caller owns. The base paths are
 * checked by the second pass below, so this call is covered — but it is named
 * here rather than filtered out, because a *new* interpolated call somewhere
 * else would be a genuine hole and has to fail.
 */
function isInterpolated(call: Call): boolean {
  return call.argument?.trimStart().startsWith("${") ?? false;
}

/** Roots a call names that the proxy would refuse. */
function disallowed(calls: Call[]): Call[] {
  return calls.filter((call) => {
    if (call.argument === null || isInterpolated(call)) return false;
    return !ALLOWED_ROOTS.has(rootOf(call.argument));
  });
}

/** Call sites the scan could not read at all: not a literal, not an
 *  interpolation either — a path built at runtime, or a shape this test no
 *  longer understands. Either way it is unguarded, so it fails. */
function unreadable(calls: Call[]): Call[] {
  return calls.filter((call) => call.argument === null);
}

const FILES = SOURCE_DIRS.flatMap(sourceFiles).map((path) => ({
  path,
  text: readFileSync(path, "utf8"),
}));

function callsIn(importing: RegExp, opener: RegExp, read: typeof literalAt) {
  return FILES.filter(({ text }) => importing.test(text)).flatMap(
    ({ path, text }) => calls(path, text, opener, read),
  );
}

const BROWSER_CALLS = callsIn(BROWSER_FETCH_IMPORT, API_FETCH_CALL, literalAt);
const CURSOR_CALLS = callsIn(
  CURSOR_LIST_IMPORT,
  CURSOR_LIST_CALL,
  secondArgument,
);

describe("proxy allow-list", () => {
  it("allows every root the browser's apiFetch calls name", () => {
    expect(unreadable(BROWSER_CALLS)).toEqual([]);
    expect(disallowed(BROWSER_CALLS)).toEqual([]);
  });

  it("allows every path handed to useCursorList", () => {
    // The path is an argument here rather than a literal in the caller's own
    // `apiFetch`, so it needs its own pass: the hook requests
    // `${basePath}?cursor=…`, and an unlisted basePath 404s one page in.
    expect(unreadable(CURSOR_CALLS)).toEqual([]);
    expect(disallowed(CURSOR_CALLS)).toEqual([]);
  });

  it("knows about every path it cannot read statically", () => {
    // The one interpolation is the pass-through in `useCursorList`, whose
    // callers the test above covers. Pinned by count rather than skipped,
    // because a second one appearing anywhere else is a real hole.
    const interpolated = BROWSER_CALLS.filter(isInterpolated);

    expect(interpolated.map(({ file }) => file)).toEqual([
      "lib/hooks/use-cursor-list.ts",
    ]);
    expect(CURSOR_CALLS.filter(isInterpolated)).toEqual([]);
  });

  it("reads the files it exists to guard", () => {
    // Without this, a walker that silently stopped descending — a renamed
    // directory, a changed extension — would leave both tests above passing
    // over an empty list.
    const scanned = new Set(FILES.map(({ path }) => path));

    expect(scanned.has("lib/realtime/use-notifications.ts")).toBe(true);
    expect(scanned.has("components/study/study-session.tsx")).toBe(true);
    expect(BROWSER_CALLS.length).toBeGreaterThanOrEqual(20);
    expect(CURSOR_CALLS.length).toBeGreaterThanOrEqual(4);
  });

  it("keeps the root whose absence started this", () => {
    // The regression, named. The bell loads its list over REST so the badge is
    // right on a cold page; all three of its calls sit under this root.
    expect(ALLOWED_ROOTS.has("notifications")).toBe(true);
  });
});
