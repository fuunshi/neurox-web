import { Breadcrumbs, type Crumb } from "@/components/content/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { collectionPage } from "@/lib/seo/schema";
import { siteUrl } from "@/lib/server/config";
import {
  childrenOf,
  getCurriculumTree,
  nodeAt,
  pathTo,
  shortTitle,
  urlFor,
} from "@/lib/server/content";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

/**
 * One semester of a course.
 *
 * Answers "what subjects are in the third semester", which is a real search
 * and not one the course page answers well — that page has to hold eight
 * semesters at once and so says very little about any one of them.
 */
export const revalidate = 3600;

export async function generateStaticParams() {
  const tree = await getCurriculumTree();

  return tree
    .filter((node) => node.kind === "SEMESTER")
    .map((node) => {
      const [course, semester] = node.path.split("/");
      return { course, semester };
    });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ course: string; semester: string }>;
}): Promise<Metadata> {
  const { course, semester } = await params;
  const tree = await getCurriculumTree();
  const node = nodeAt(tree, `${course}/${semester}`);

  if (!node) return {};

  const courseNode = nodeAt(tree, course);

  return {
    title:
      node.seoTitle ??
      `${courseNode ? shortTitle(courseNode) : ""} ${node.title} subjects`,
    description:
      node.seoDescription ??
      `Every subject in ${node.title} of the ${courseNode?.title ?? "course"}, with notes and past questions.`,
    alternates: { canonical: urlFor(node.path) },
    ...(node.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function SemesterPage({
  params,
}: {
  params: Promise<{ course: string; semester: string }>;
}) {
  const { course, semester } = await params;
  const tree = await getCurriculumTree();
  const path = `${course}/${semester}`;
  const node = nodeAt(tree, path);

  if (!node || node.kind !== "SEMESTER") notFound();

  const courseNode = nodeAt(tree, course);
  const subjects = childrenOf(tree, node.path);
  const trail: Crumb[] = pathTo(tree, node.path).map((ancestor) => ({
    title: ancestor.title,
    url: urlFor(ancestor.path),
  }));

  return (
    <div className="flex flex-col gap-10">
      <Breadcrumbs trail={trail} />

      <header className="flex flex-col gap-4">
        <h1 className="text-3xl text-balance sm:text-4xl">
          {courseNode ? `${shortTitle(courseNode)} ` : ""}
          {node.title}
        </h1>
        <p className="max-w-prose text-lg text-ink-muted">
          {subjects.length} subjects. Each one has its own notes, and its own
          past questions as they are added.
        </p>
      </header>

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {subjects.map((subject) => (
          <li key={subject.id}>
            <Link
              href={urlFor(subject.path)}
              className="flex h-full flex-col rounded-md border border-line bg-surface px-3.5 py-3 transition-colors hover:border-line-strong hover:bg-surface-2"
            >
              {subject.code ? (
                <span className="text-xs text-ink-subtle">{subject.code}</span>
              ) : null}
              <span className="text-ink">{subject.title}</span>
              {subject.description ? (
                <span className="mt-1 line-clamp-2 text-sm text-ink-muted">
                  {subject.description}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>

      <JsonLd
        data={collectionPage({
          url: siteUrl(urlFor(node.path)),
          title: node.title,
          description: node.description,
          items: subjects.map((subject) => ({
            url: siteUrl(urlFor(subject.path)),
            title: subject.title,
          })),
        })}
      />
    </div>
  );
}
