import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * `standalone` is for the container build.
   *
   * Without it `next start` needs the entire `node_modules` tree at runtime —
   * several hundred megabytes of compilers and type definitions that a running
   * server never touches — because it resolves modules per request. Standalone
   * traces what the server actually imports and emits that beside a minimal
   * `server.js`, which is the difference between an image worth shipping and
   * one that is mostly build tooling.
   *
   * It is inert on Vercel, which bundles the app its own way and ignores this.
   */
  output: "standalone",

  async headers() {
    return [
      {
        /**
         * The verification and reset links carry their token in the query
         * string. `no-referrer` stops that URL travelling to any third party the
         * page later loads — without it, a font or image request would hand the
         * token to someone else in a `Referer` header.
         */
        source: "/auth/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
      {
        // Reset lives at the root, not under /auth, because that is the path the
        // backend's email template builds.
        source: "/reset-password",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
      /*
       * The signed-in app tells crawlers to stay out at the HTTP layer.
       *
       * This is the third of three layers, and deliberately redundant:
       * `app/robots.ts` asks, `proxy.ts` redirects, and this header applies
       * whether or not the first was read and whether or not the second
       * matched. Each is individually ignorable, which is the argument for
       * having all three.
       *
       * The prefixes are written out rather than imported from
       * `lib/server/routes.ts`. A config file is loaded outside the app's
       * module graph, so the import is not reliable here — and robots.ts, which
       * *can* import it, is the layer that stays in step automatically.
       */
      ...["/home", "/decks", "/sources", "/generate", "/quizzes", "/stats", "/map", "/activity", "/settings"].map(
        (prefix) => ({
          source: `${prefix}/:path*`,
          headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
        }),
      ),
    ];
  },
};

export default nextConfig;
