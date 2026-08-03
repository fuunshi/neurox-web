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
server components / hooks → lib/server/api.ts     → API
```

`proxy.ts` is the only place a token refresh happens. It has to be: server
components cannot set cookies, so a refresh anywhere else could not persist the
rotated pair — and the API rotates and single-uses refresh tokens.

## Layout

```
app/
  (marketing)/        public home page; statically rendered
  (auth)/             signed-out screens, one layout over /auth/* and /reset-password
  (app)/              signed-in shell: decks, sources, generate, activity, settings
  api/auth/*          session handlers (cookies are set here)
  api/proxy/[...path] one authenticated forwarder for client-side calls
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

## Study modes

Two presentations of the same cards, switchable from the study screen and
remembered in a cookie:

- **Swipe** — one card at a time. Drag it, or use the arrow keys, to move
  between cards; tap it, or press space, to reveal the answer. Swiping moves
  rather than rating: rating would be a review action, and nothing can record
  one yet.
- **Grid** — every card at once, each flipping on its own. For scanning a deck
  and spotting the ones you keep getting wrong.

Both render `components/study/card-surface.tsx` rather than their own markup, so
a third mode (a list, a quiz, audio) is a component plus an entry in
`lib/study/modes.ts` — nothing else. Modes are presenters: the session owns the
cards and the position, and a mode reports nothing back but a position.

**Nothing about a session is saved.** `FlashCard` has no scheduling fields and
the API has no review endpoint, so there is nowhere to record that a card was
seen. The screen says so rather than implying progress that would vanish on
reload. This is the missing piece between "can show you cards" and "can teach
you": it needs a review endpoint, an interval and a due date on the card, and a
review log — a migration plus three endpoints.

## Not built yet

- **Persisted study progress** — see above. The seam is ready: the session
  already knows which card is showing and when it was revealed.
- **Automated end-to-end tests.** `scripts/shots.mjs` and
  `scripts/shots-study.mjs` drive a real sign-in, the study gestures and a
  pointer drag, and fail on console errors — but they are a look rather than a
  suite. The plan is a Playwright run covering register → Mailpit → verify →
  login → deck → upload → generate → review.
- **Email verification and MFA are reachable but not exercised by a test.** The
  screens handle the states; nothing asserts them.
- **Only the first 50 cards** load into review or study. `Load more` covers the
  review screen; study does not page yet.
