import { SITE_URL } from "@/lib/server/config";
import { PROTECTED_PREFIXES } from "@/lib/server/routes";
import type { MetadataRoute } from "next";

/**
 * What a crawler may index.
 *
 * The signed-in application is disallowed from `PROTECTED_PREFIXES` rather than
 * from a list written out here, so the two cannot drift — the same reason
 * `proxy.ts` reads that constant instead of repeating it. A page added to the
 * app is then disallowed automatically, which is the safe direction for a
 * mistake to point.
 *
 * This is a request, not an enforcement: a crawler that ignores it still meets
 * the redirect in `proxy.ts`, and the `X-Robots-Tag` header set in
 * `next.config.ts`. The three layers are deliberately redundant, because each
 * one is individually ignorable.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          ...PROTECTED_PREFIXES,
          // Auth screens are guest-only and redirect a signed-in reader, so a
          // crawler that reached one would be indexed on a page it cannot use.
          "/auth/",
          "/reset-password",
          // The click counter. Disallowed as well as `nofollow`ed below: these
          // are redirects, and there is nothing at the other end for a crawler.
          "/go/",
          // Search results, which are a view of content that is already indexed
          // at its own URL. Indexing them adds thin duplicates and nothing else.
          "/search",
          // The primitive gallery. Public and crawlable today, which it should
          // not be — it is a development surface and says so itself.
          "/kitchen-sink",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
