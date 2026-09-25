import { Breadcrumbs } from "@/components/content/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { course } from "@/lib/seo/schema";
import { siteUrl } from "@/lib/server/config";
import {
  childrenOf,
  getCurriculumTree,
  nodeAt,
  shortTitle,
  urlFor,
} from "@/lib/server/content";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

/**
 * A course: BCA, and everything it is taught in.
 *
 * This is the page that answers "what subjects are in BCA", which is one of the
 * two things a student searches for before they search for a subject. The other
 * is a subject itself, which is why the semesters here link straight through
 * rather than stopping at a year page.
 *
 * **`dynamicParams` is deliberately left at its default.** The plan called for
 * `false`, to stop a non-course slug rendering an empty hub — but that is
 * already handled below by `notFound()`, and `false` has a failure mode that
 * matters more: with an empty `generateStaticParams` (which is what the tree
 * loader returns when the API is unreachable at build time) it would make every
 * course URL 404 until the next successful build. Relying on the explicit check
 * is both safer and no less correct.
 */
export const revalidate = 3600;

export async function generateStaticParams() {
  const tree = await getCurriculumTree();

  return tree
    .filter((node) => node.kind === "COURSE")
    .map((node) => ({ course: node.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ course: string }>;
}): Promise<Metadata> {
  const { course: slug } = await params;
  const node = nodeAt(await getCurriculumTree(), slug);

  if (!node) return {};

  /** The title tag is the single highest-leverage string on the page, and the
   *  root template appends "— neurox", so this stays inside the useful width. */
  const title = node.seoTitle ?? `${shortTitle(node)} — semesters and subjects`;

  return {
    title,
    description:
      node.seoDescription ??
      node.description ??
      `The full ${node.title} syllabus: every semester, every subject.`,
    alternates: { canonical: urlFor(node.path) },
    ...(node.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function CoursePage({
  params,
}: {
  params: Promise<{ course: string }>;
}) {
  const { course: slug } = await params;
  const tree = await getCurriculumTree();
  const node = nodeAt(tree, slug);

  // A slug that is not a course is a 404, not an empty page. Rendering nothing
  // under a valid-looking URL is how a site accumulates soft-404s.
  if (!node || node.kind !== "COURSE") notFound();

  const semesters = childrenOf(tree, node.path);
  const subjects = semesters.flatMap((semester) =>
    childrenOf(tree, semester.path),
  );

  const trail = [{ title: node.title, url: urlFor(node.path) }];

  return (
    <div className="flex flex-col gap-10">
      <Breadcrumbs trail={trail} />

      <header className="flex flex-col gap-4">
        <h1 className="text-3xl text-balance sm:text-4xl">{node.title}</h1>
        {node.description ? (
          <p className="max-w-prose text-lg text-ink-muted">
            {node.description}
          </p>
        ) : null}
      </header>

      <div className="flex flex-col gap-12">
        {semesters.map((semester) => {
          const semesterSubjects = childrenOf(tree, semester.path);

          return (
            <section key={semester.id} className="flex flex-col gap-4">
              <div className="flex items-baseline justify-between gap-4 border-b border-line pb-2">
                <h2 className="text-xl">
                  <Link
                    href={urlFor(semester.path)}
                    className="transition-colors hover:text-accent"
                  >
                    {semester.title}
                  </Link>
                </h2>
                <span className="text-sm text-ink-subtle">
                  {semesterSubjects.length} subjects
                </span>
              </div>

              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {semesterSubjects.map((subject) => (
                  <li key={subject.id}>
                    <Link
                      href={urlFor(subject.path)}
                      className="flex flex-col rounded-md border border-line bg-surface px-3.5 py-3 transition-colors hover:border-line-strong hover:bg-surface-2"
                    >
                      {subject.code ? (
                        <span className="text-xs text-ink-subtle">
                          {subject.code}
                        </span>
                      ) : null}
                      <span className="text-ink">{subject.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <JsonLd
        data={course({
          url: siteUrl(urlFor(node.path)),
          title: node.title,
          description: node.description,
          subjects: subjects.map((subject) => subject.title),
        })}
      />
    </div>
  );
}
