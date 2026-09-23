import { ArticleHeader } from "@/components/content/article-header";
import { Breadcrumbs, type Crumb } from "@/components/content/breadcrumbs";
import { Prose } from "@/components/content/prose";
import { JsonLd } from "@/components/seo/json-ld";
import { ApiError } from "@/lib/errors";
import { breadcrumbList, learningResource } from "@/lib/seo/schema";
import { siteUrl } from "@/lib/server/config";
import { getNote, urlFor } from "@/lib/server/content";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

/**
 * A note: the reading surface, and the thing this site is made of.
 *
 * **The URL must agree with the note's own node path.** A note is reachable at
 * exactly one address, because the alternative is the same text served under
 * two URLs and a search engine choosing between them — a note filed under
 * `bca/semester-3/...` but linked as `bca/semester-4/...` would compete with
 * itself. Rather than 404, a mismatch redirects permanently to the canonical
 * path: the reader followed a stale link, and the note they wanted exists.
 *
 * No `generateStaticParams`, deliberately. It would need to enumerate every
 * published note at build time, which is a limit-capped listing that silently
 * stops being complete once the site outgrows it — and the failure would be
 * invisible. Notes render on first request and are cached from then on, and
 * `revalidate` expires them hourly.
 */
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{
    course: string;
    semester: string;
    subject: string;
    slug: string;
  }>;
}): Promise<Metadata> {
  const { course, semester, subject, slug } = await params;

  let note;
  try {
    note = await getNote(slug);
  } catch {
    return {};
  }

  // A note reached at the wrong path has a canonical somewhere else; describing
  // this URL would be describing a duplicate.
  if (note.nodePath !== `${course}/${semester}/${subject}`) return {};

  const description =
    note.seoDescription ?? note.excerpt ?? undefined;

  return {
    title: note.seoTitle ?? note.title,
    ...(description ? { description } : {}),
    alternates: { canonical: siteUrl(`/${note.nodePath}/notes/${note.slug}`) },
    openGraph: {
      type: "article",
      title: note.title,
      ...(description ? { description } : {}),
      url: siteUrl(`/${note.nodePath}/notes/${note.slug}`),
      ...(note.publishedAt ? { publishedTime: note.publishedAt } : {}),
      modifiedTime: note.updatedAt,
    },
    // A note can carry its own `noindex` — imported material that arrived thin
    // gets it set at publish time, and this is what honours it.
    ...(note.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function NotePage({
  params,
}: {
  params: Promise<{
    course: string;
    semester: string;
    subject: string;
    slug: string;
  }>;
}) {
  const { course, semester, subject, slug } = await params;

  let note;
  try {
    note = await getNote(slug);
  } catch (error) {
    // A note that does not exist and one that is not published both answer 404
    // from the API, and both should look the same here.
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const expected = `${course}/${semester}/${subject}`;

  if (note.nodePath !== expected) {
    permanentRedirect(`/${note.nodePath}/notes/${note.slug}`);
  }

  const trail: Crumb[] = [
    ...note.breadcrumbs.map((crumb) => ({
      title: crumb.title,
      url: urlFor(crumb.path),
    })),
    { title: note.title, url: `/${note.nodePath}/notes/${note.slug}` },
  ];

  return (
    <article className="flex flex-col gap-8">
      <Breadcrumbs trail={trail} />

      <ArticleHeader note={note} />

      <Prose markdown={note.bodyMarkdown} />

      <JsonLd
        data={learningResource({
          url: siteUrl(`/${note.nodePath}/notes/${note.slug}`),
          title: note.title,
          description: note.seoDescription ?? note.excerpt,
          publishedAt: note.publishedAt,
          updatedAt: note.updatedAt,
          resourceType: "Notes",
          isPartOf: {
            url: siteUrl(`/${note.nodePath}`),
            title: note.nodeTitle,
          },
          breadcrumbs: breadcrumbList(
            trail.map((crumb) => ({
              title: crumb.title,
              url: siteUrl(crumb.url),
            })),
          ),
        })}
      />
    </article>
  );
}
