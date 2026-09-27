# syntax=docker/dockerfile:1
#
# neurox-web — the Next.js frontend, as a container.
#
# Three stages, and the split is chosen so the expensive ones cache. `deps`
# installs and changes only when the lockfile does; `builder` compiles and
# changes whenever source does; `runner` is what ships and contains neither pnpm
# nor the source tree.

FROM node:22-alpine AS base
WORKDIR /app
# pnpm comes from corepack, pinned by the `packageManager` field in
# package.json. Installing it globally instead would let the image and a
# developer's machine disagree about the version without anyone noticing.
RUN corepack enable


FROM base AS deps
# Only the manifests, so a source change does not invalidate the install layer.
COPY package.json pnpm-lock.yaml ./
# `--frozen-lockfile` fails rather than resolving something new: a container
# build that quietly upgrades a dependency is a build that cannot be reproduced.
#
# `--ignore-scripts` because the root `prepare` script runs `husky`, which is a
# devDependency and is absent under `--prod`. Its guard does not work as written
# — `node -e "if (!process.env.CI) process.exit(0)"` succeeds either way, so
# `&& husky` always runs — so the flag is what actually stops it.
RUN pnpm install --frozen-lockfile --ignore-scripts


FROM deps AS builder
COPY . .

# `NEXT_PUBLIC_*` values are inlined at build time, not read at runtime — that
# is what the prefix means. This app deliberately has none: every address it
# needs is server-side (`BACKEND_BASE_URL`, `SITE_URL`, below), so the build is
# environment-independent and the same image runs anywhere. If a
# `NEXT_PUBLIC_*` is ever added, it has to become a build argument and this
# comment stops being true.
#
# Placeholders so the build does not fail on a missing variable. Next reads
# these while prerendering; the real values arrive at runtime, and a
# prerendered page that baked in a placeholder is regenerated on first request.
ENV BACKEND_BASE_URL=http://neurox-backend:3000
ENV SITE_URL=http://localhost:3001

RUN pnpm build


FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Not root. The build artefact is read-only at runtime, so there is no reason to
# hand it more privilege than it needs.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# `standalone` emits a server with only the modules it actually imports, so
# pnpm and the full dependency tree stop here rather than in the final image.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Static assets sit outside the traced tree, so they are copied explicitly —
# this is the documented standalone layout, and forgetting either of these gives
# a server that starts and then serves 404s for every asset.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

# `node server.js`, not `next start`: the standalone output is its own minimal
# server, and `next` is not installed in this stage.
CMD ["node", "server.js"]
