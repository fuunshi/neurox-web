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

### The one exception: the realtime socket

Everything above routes through this app. **The socket does not**, and it cannot:
a WebSocket needs a connection held open, and a Next.js route handler is
request-scoped — the framework's own docs say handlers "won't work because the
connection closes on timeout, or after the response is generated".

So the browser opens one WebSocket to the API directly, and two things change
with it:

- It learns the API's address. It is handed over per connection by
  `/api/auth/realtime-ticket` rather than compiled into the bundle, so it stays
  server configuration — but it is in the page's JavaScript while a socket is
  open, and pretending otherwise would be wrong.
- It holds a credential. Not the session: the BFF mints a **ticket** that is
  typed `realtime`, carries nothing but the user id, expires in a minute, and is
  refused by every REST route because `AuthGuard` only admits the token types a
  route declares. The httpOnly cookie still never leaves the server.

A socket that cannot be opened costs latency and nothing else. Every screen that
uses one also works without it — the notification list loads over REST and the
generation screen falls back to polling — which is why nothing in
`lib/realtime` throws to its callers.

## Notifications

A bell in the header, and a panel behind it. What arrives there is a **template
key and its parameters**, stored that way and rendered server-side: the database
never holds a sentence, so rewording a message rewords the history rather than
only the future, and a row cannot carry text of its own into the UI.

The list is fetched over the ordinary route handlers and the socket only adds to
it, so the badge is correct on a cold page load with no socket at all. Pushes
are deduplicated by id, and the unread count is always the server's — the list
is capped and the count is not, so inferring one from the other would drift.

The socket carries more than notifications. `lib/realtime/client.ts` is one
connection shared by every consumer, with named **topics** a screen can
subscribe to; the generation screen uses `deck:<id>` to hear about a run the
moment it finishes instead of asking every 1.5 seconds. Topics are authorized
server-side per subscriber, so the same mechanism can carry another stream
without a second connection or a second handshake.

## Layout

```
app/
  (marketing)/        public home page; statically rendered
  (auth)/             signed-out screens, one layout over /auth/* and /reset-password
  (app)/              signed-in shell: home, decks, sources, generate,
                      quizzes, stats, map, activity, settings
  api/auth/*          session handlers (cookies are set here)
  api/proxy/[...path] one authenticated forwarder for client-side calls
  api/decks/[deckId]/export   the one route that answers a file, not JSON
components/           ui/ theme/ auth/ app/ marketing/ study/ quiz/ analytics/
lib/
  api-types.ts        hand-written DTOs
  errors.ts           one error shape, envelope + wire serialisation
  token-expiry.ts     pure JWT-expiry maths, testable without next/headers
  hooks/
    use-cursor-list.ts  cursor paging for the client-side lists
    use-job-poll.ts     follows a generation job to a terminal status
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
pnpm test        # vitest — pure functions, the cursor-paging hook, the study session
pnpm shots <email> <password> [deckId]   # signs in and screenshots the app to /tmp/shots
```

## Decks, cards and sources

A deck is created from the decks screen and renamed or deleted from the bottom of
its own page — below the export, because both are things you do to a deck once
you are finished with it. Deleting is confirmed, and takes the deck's cards and
their review history with it.

Cards arrive three ways: drafted from a source, written by hand, or imported. All
three land as **drafts**, so nothing reaches the study queue without being looked
at once. Amber marks a draft, as it marks anything else needing attention.

A source keeps the text that was read out of it. Opening one from the sources
list shows that text in full, and the chunks the generator actually reads — which
is the honest answer to "why did generation find nothing in my PDF?".

Cards and decks page rather than stopping at a round number, and each list says
how many it is showing. A count that is a lower bound says so with a `+`.

## Signing in

Settings carries the password link and the state of two-factor authentication.
Enrolling an authenticator happens on its own screen, because it needs a QR code
and a confirmation step; turning it **off** is inline, because it is one field and
one decision, and sending someone to a screen to remove a security measure makes
removing it feel like the considered path. It asks for a current code either way,
so a borrowed session cannot quietly drop the second factor. Disabling clears the
secret, so re-enrolling issues a fresh one.

The bottom of the page deletes the account. It is soft: the account stops being
served, every device is signed out, and it can be restored for a short while
afterwards from the recovery screen with the email and password. It asks for the
password despite the reader already being signed in, because unlike changing a
password this is not undone by signing in again — it starts a clock.

A verification link that expired or was cut in half by a mail client no longer
leaves the reader stuck: the screen that reports the problem offers to send a new
one. Previously the only way to trigger a resend was to attempt a sign-in that
would be refused for being unverified.

## Studying

Study is **scheduled**, not just displayed. Cards are graded with the two
controls the gesture can reach (Again / Good) or with keys 1–4, and the API
reschedules them. Hard and Easy are keys 2 and 4 — present, but not competing
for attention on every card. The full four-way mix, "How you grade yourself", is
on **Progress**, which is the page built to answer that question.

- **Swipe** — one card at a time. Reveal with a tap or space, then grade. Swipe
  right for Good, left for Again; the buttons and keys do the same. Grading is
  refused until the answer is showing — grading something you have not checked
  is guessing at your own memory, and the schedule would learn from noise.

  Released past the threshold, the card **holds where you put it**, leans
  further and takes a colour while the review is saved. The save is never held
  behind the animation: it starts on release, and the movement runs alongside it.
  The colour is the part that matters, because `prefers-reduced-motion` flattens
  the movement and leaves the meaning intact — see `styles/motion.css`.
- **Grid** — every card at once, each flipping on its own. For scanning a deck.
  **It does not grade**, and says so: a tile has no honest way to ask "how well
  did you know that?" between two other tiles.
- **Read** — both sides of every card, in order, as a page. For material that is
  new, for checking a deck is coherent, or for simply reading it. **It does not
  grade** either, and says so on the screen.

`Again` returns the card **within the session** — it moves to the back of the
queue rather than leaving it, and progress is `done / (done + remaining)`, so the
bar does not shrink when a card is failed.

**A session continues across pages.** The API serves the pool a page at a time,
so when the queue empties and another page exists the session pulls it in and
carries on, rather than stopping at fifty cards and calling itself finished. The
summary appears only once the cursor is exhausted. If that next page cannot be
fetched the session ends where it got to and says so, rather than retrying
against a failing API for ever.

**A grade can be taken back.** The banner under the card carries an `Undo`, which
reverses the grade just made. The API does not run the schedule backwards — it
restores the card from a snapshot stored *with the review* and deletes the review
itself, because a mis-click is not a review that happened; keeping the row and
filtering it out everywhere would mean every statistics query has to remember a
predicate, and one omission silently corrupts the numbers. Only the newest review
of a card can be undone, since reversing an older one would leave every review
after it describing a schedule that no longer exists. Rows written before the
snapshot existed are refused rather than guessed at.

Every mode renders `components/study/card-surface.tsx` rather than its own
markup, so a new mode (a list, a quiz, audio) is a component plus an entry in
`lib/study/modes.ts` — and an arm in `study-session.tsx`'s dispatch, which is an
exhaustive switch with a `never` guard, so a mode with no arm fails the
typecheck rather than silently rendering nothing. Modes are presenters; the
session owns the cards and the position.

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

## Exporting and importing

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

Cards come back in from the deck's card list. It reads the columns the export
writes, so a deck exported and imported elsewhere arrives with its questions,
answers, hints and schedule intact. The delimiter is read from the file name and
otherwise sniffed from the header line, and a file with no header is read
positionally as question, answer, hint.

It reports what it did. "Added 12" on its own hides the case worth knowing
about, so the rows it skipped are named rather than counted — a blank line at the
end of a spreadsheet is normal, and a reader should be able to see that that is
all it was. A file over the size limit is refused rather than imported in part:
an import that quietly stopped halfway would leave someone believing a deck was
complete when it was not.

## Not built yet

- **Automated end-to-end tests.** `scripts/shots*.mjs` sign in for real and
  screenshot their way through a study session, the stats page, a download and
  an undo, failing on console errors — but they are a look rather than a suite.
  They print `FAILED` and still exit 0, so they cannot fail a CI run, six of the
  seven have no npm alias, and none of them performs a pointer drag: the swipe
  gesture is only ever driven by keyboard. The plan is a Playwright run covering
  register → Mailpit → verify → login → deck → upload → generate → review.
- **Email verification and MFA are reachable but not exercised by a test.** The
  screens handle the states; nothing asserts them.
- **The knowledge map's term layer is synthetic** — the backend derives terms
  from deck titles and says so through `graph.placeholder`, which the page
  shows rather than hiding. Real extraction is the unbuilt NLP work.
