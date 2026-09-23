import { siteUrl } from "@/lib/server/config";
import { getCurriculumTree, listNotes, noteUrl, urlFor } from "@/lib/server/content";
import type { MetadataRoute } from "next";

/**
 * Every public page, for a crawler.
 *
 * Built from the same cached loaders the pages use, so it cannot list a URL
 * that 404s or omit one that exists — a sitemap that disagrees with the site is
 * worse than none, because it spends crawl budget on dead ends.
 *
 * **Known ceiling.** `listNotes` is capped by the API's own page size, so this
 * lists the most recent notes rather than all of them. That is correct today
 * and wrong the moment the site has more notes than one page: the sitemap would
 * quietly stop mentioning the older ones, with no error anywhere. The fix is a
 * paginated sitemap (`generateSitemaps`) or a dedicated endpoint — noted here
 * rather than discovered later.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [tree, notes] = await Promise.all([
    getCurriculumTree(),
    listNotes(null, 50),
  ]);

  const taxonomy: MetadataRoute.Sitemap = tree
    .filter((node) => !node.noindex)
    .map((node) => ({
      url: siteUrl(urlFor(node.path)),
      lastModified: node.updatedAt,
      changeFrequency: "weekly",
      // The deeper the node, the less it is the entry point — but a subject is
      // the page most searches land on, so it outranks its own semester.
      priority: node.kind === "COURSE" ? 1 : node.kind === "SUBJECT" ? 0.8 : 0.6,
    }));

  const notePages: MetadataRoute.Sitemap = notes
    .filter((note) => note.publishedAt !== null)
    .map((note) => ({
      url: siteUrl(noteUrl(note)),
      lastModified: note.updatedAt,
      changeFrequency: "monthly",
      priority: 0.7,
    }));

  return [
    { url: siteUrl("/"), changeFrequency: "daily", priority: 1 },
    ...taxonomy,
    ...notePages,
  ];
}
