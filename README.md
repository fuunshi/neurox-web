# neurox — web

The front end for **neurox**: bring your own study material, review the cards
drafted from it, keep the ones worth remembering.

Next.js 16 (App Router) on port **3001**, talking to the NestJS API in
`../flash-cards-backend` on port **3232**.

## Running it

Both processes are needed for the full loop: the API serves requests, and the
**worker** is what actually sends email and runs card generation.

```bash
# backend (two terminals)
cd ../flash-cards-backend
pnpm run migrate:up         # first time, or after schema changes
pnpm run start:dev          # API on :3232
pnpm run start:worker:dev   # worker — required for email and generation

# front end
pnpm install
pnpm dev                    # http://localhost:3001
```

`pnpm dev` is pinned to 3001 because the API owns 3232 and the machine's 3000 is
in use elsewhere.

### Reading the emails it sends

Verification and password-reset links are real emails over SMTP. Locally they go
to **Mailpit** at <http://localhost:8025>. The API's `.env` points at it
(`SMTP_HOST=localhost`, `SMTP_PORT=1025`); the container is published on
`localhost:1025` and `localhost:8025`.

Note that Mailpit is shared with other local projects, so filter by recipient.

### The one piece of coupling worth knowing

The backend builds the links in those emails from **its own** `FRONTEND_URL`:

```
${FRONTEND_URL}/auth/verify-email?token=…     (in /auth)
${FRONTEND_URL}/reset-password?token=…        (at the root)
```

So the front end's route tree is dictated by the backend's config, not chosen
here — which is why `verify-email` sits under `/auth` and `reset-password` does
not. If `FRONTEND_URL` is wrong, both flows dead-end with a link to nowhere.

## How it talks to the API

The browser never calls the API and never sees a token. It calls this app's own
route handlers, which hold the session in `httpOnly` cookies and attach the
Bearer header server-side.

```
browser → /api/auth/*  (login, logout, step-up)   → BFF → API
        → /api/proxy/* (everything else)          → BFF → API
        → /api/decks/:id/export  (a file, not JSON) → BFF → API
server components / hooks → lib/server/api.ts     → API
```

`proxy.ts` is the only place a token refresh happens. It has to be: server
components cannot set cookies, so a refresh anywhere else could not persist the
rotated pair — and the API rotates and single-uses refresh tokens.

The export route is the one request that is neither JSON nor a session handler.
It forwards the file rather than re-encoding it, which lets the download be a
plain `<a href>` — no fetch, no blob, no JavaScript — so it works with the
browser's own download handling and survives a middle-click.

## Layout

```
app/
  (marketing)/        public home page; statically rendered
  (auth)/             signed-out screens, one layout over /auth/* and /reset-password
  (app)/              signed-in shell: decks, sources, generate, activity, settings
  api/auth/*          session handlers (cookies are set here)
  api/proxy/[...path] one authenticated forwarder for client-side calls
  api/decks/[deckId]/export   the one route that answers a file, not JSON
components/           ui/ theme/ auth/ app/ marketing/
lib/
  api-types.ts        hand-written DTOs
  errors.ts           one error shape, envelope + wire serialisation
  token-expiry.ts     pure JWT-expiry maths, testable without next/headers
  server/             api, session, refresh, throttle, queries
styles/
  themes.css          the three schemes — the only file holding colour literals
proxy.ts              token refresh + optimistic redirects
```

## Themes

Three schemes — **Daylight**, **Nightlab**, **Paper** — over one layout.
`styles/themes.css` is the only file allowed to contain hex; everything else
names a role (`bg-surface`, `text-ink`, `text-due-fg`), which is why switching
schemes needs no component change. `pnpm lint` enforces that with
`scripts/check-no-hex.mjs`.

Amber (`--due`) is a meaning, not decoration: it marks anything needing
attention — a draft, a source that failed, a locked account.

## Checks

```bash
pnpm typecheck   # next typegen && tsc --noEmit
pnpm lint        # eslint && the colour-literal guard
pnpm test        # vitest — error handling, token expiry, throttle keying
pnpm shots <email> <password> [deckId]   # signs in and screenshots the app to /tmp/shots
```

## Studying

Study is **scheduled**, not just displayed. Cards are graded with four buttons
(Again / Hard / Good / Easy, or keys 1–4) and the API reschedules them.

- **Swipe** — one card at a time. Reveal with a tap or space, then grade. Swipe
  right for Good, left for Again; the buttons and keys do the same. Grading is
  refused until the answer is showing — grading something you have not checked
  is guessing at your own memory, and the schedule would learn from noise.
- **Grid** — every card at once, each flipping on its own. For scanning a deck.
  **It does not grade**, and says so: a tile has no honest way to ask "how well
  did you know that?" between two other tiles.

`Again` returns the card **within the session** — it moves to the back of the
queue rather than leaving it, and progress is `done / (done + remaining)`, so the
bar does not shrink when a card is failed.

**A grade can be taken back.** The banner under the card carries an `Undo`, which
reverses the grade just made. The API does not run the schedule backwards — it
restores the card from a snapshot stored *with the review* and deletes the review
itself, because a mis-click is not a review that happened; keeping the row and
filtering it out everywhere would mean every statistics query has to remember a
predicate, and one omission silently corrupts the numbers. Only the newest review
of a card can be undone, since reversing an older one would leave every review
after it describing a schedule that no longer exists. Rows written before the
snapshot existed are refused rather than guessed at.

Both modes render `components/study/card-surface.tsx` rather than their own
markup, so a third mode (a list, a quiz, audio) is a component plus an entry in
`lib/study/modes.ts` — nothing else. Modes are presenters; the session owns the
cards and the position.

The scheduling itself is a pure function on the backend
(`src/application/study/scheduling.ts`) with 22 tests, because a scheduling bug
is invisible for weeks — cards keep coming back, or quietly stop.

**Progress** (`/stats`) shows a streak, a 30-day review history, retention and
the fortnight's forecast, all read from the review log rather than estimated.
Its chart colours were checked with a contrast/CVD validator per theme rather
than picked by eye — see `--chart-1`/`--chart-2` in `styles/themes.css`.

**A card you keep forgetting** gets a `Suggest a rewrite` action: the API hands a
model the card and its lapse count and returns a rewrite plus the reason for it.
Nothing is written — accepting goes through the ordinary edit endpoint, so there
is one path that changes a card and one place its schedule resets. Needs
`GEMINI_API_KEY`; without one it says so rather than failing obscurely.

## Exporting

A deck downloads from the bottom of its own page. CSV for a spreadsheet, TSV for
Anki, which prefers tabs because card text contains commas far more often than
tabs. Every card is included — questions, answers, hints, and where each one is
in its schedule — and the export deliberately does not page: one that silently
stopped at fifty cards would be worse than none, because the reader would not
know to check.

The escaping is the whole feature. Card text routinely contains the delimiter, a
quote, and newlines, and a `join(",")` produces a file that looks fine until it
is opened, at which point the columns have shifted and the rows no longer line up
with the cards — silent corruption of exactly the data someone exports because
they care about it. Fields are quoted per RFC 4180, and the API's tests parse the
output back rather than comparing it against strings the same code produced.

## Not built yet

- **Automated end-to-end tests.** `scripts/shots*.mjs` drive a real sign-in, the
  study gestures, a pointer drag, the stats page, a download and an undo, and
  fail on console errors — but they are a look rather than a suite. The plan is a
  Playwright run covering register → Mailpit → verify → login → deck → upload →
  generate → review.
- **Email verification and MFA are reachable but not exercised by a test.** The
  screens handle the states; nothing asserts them.
- **Only the first 50 cards** load into review or study. `Load more` covers the
  review screen; study does not page yet.
- **Undo is unreachable on the last card of a session.** Grading the final card
  finishes the session and swaps in the summary, which has no `Undo` on it — so
  the one grade you cannot take back is the one that ended the session.
- **Import.** Decks can be exported as CSV or TSV, but not brought in — there is
  no CSV or Anki import.
