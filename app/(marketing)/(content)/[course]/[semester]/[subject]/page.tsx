import { Breadcrumbs, type Crumb } from "@/components/content/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { EmptyState } from "@/components/ui/empty-state";
import { collectionPage } from "@/lib/seo/schema";
import { siteUrl } from "@/lib/server/config";
import {
  childrenOf,
  getCurriculumTree,
  listNotes,
  nodeAt,
  noteUrl,
  pathTo,
  urlFor,
} from "@/lib/server/content";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

/**
 * A subject — the page this site is actually for.
 *
 * A student searches for a subject by name or by code ("data structure and
 * algorithms", "BCA 201"), not for a course and not for a semester, so this is
 * the page that has to rank and the page that has to be worth landing on. Unit
 * headings appear only when notes have been filed under them; until then the
 * subject holds its notes directly, and inventing an empty unit list would put
 * structure on the page that the syllabus data does not actually have.
 */
export const revalidate = 3600;

/** Enough to fill a subject page without turning it into an archive. */
const NOTES_PER_SUBJECT = 50;

export async function generateStaticParams() {
  const tree = await getCurriculumTree();

  return tree
    .filter((node) => node.kind === "SUBJECT")
    .map((node) => {
      const [course, semester, subject] = node.path.split("/");
      return { course, semester, subject };
    });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ course: string; semester: string; subject: string }>;
}): Promise<Metadata> {
  const { course, semester, subject } = await params;
  const node = nodeAt(await getCurriculumTree(), `${course}/${semester}/${subject}`);

  if (!node) return {};

  const code = node.code ? ` (${node.code})` : "";

  return {
    title: node.seoTitle ?? `${node.title}${code} — notes and questions`,
    description:
      node.seoDescription ??
      node.description ??
      `Notes, past questions and revision material for ${node.title}${code}.`,
    alternates: { canonical: urlFor(node.path) },
    ...(node.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function SubjectPage({
  params,
}: {
  params: Promise<{ course: string; semester: string; subject: string }>;
}) {
  const { course, semester, subject } = await params;
  const tree = await getCurriculumTree();
  const path = `${course}/${semester}/${subject}`;
  const node = nodeAt(tree, path);

  if (!node || node.kind !== "SUBJECT") notFound();

  const [notes, units] = await Promise.all([
    listNotes(node.path, NOTES_PER_SUBJECT),
    Promise.resolve(childrenOf(tree, node.path)),
  ]);

  const trail: Crumb[] = pathTo(tree, node.path).map((ancestor) => ({
    title: ancestor.title,
    url: urlFor(ancestor.path),
  }));

  return (
    <div className="flex flex-col gap-10">
      <Breadcrumbs trail={trail} />

      <header className="flex flex-col gap-4">
        {node.code ? (
          <p className="text-sm text-ink-subtle">{node.code}</p>
        ) : null}
        <h1 className="text-3xl text-balance sm:text-4xl">{node.title}</h1>
        {node.description ? (
          <p className="max-w-prose text-lg text-ink-muted">
            {node.description}
          </p>
        ) : null}
      </header>

      {units.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl">Units</h2>
          <ul className="flex flex-wrap gap-2">
            {units.map((unit) => (
              <li key={unit.id}>
                <Link
                  href={urlFor(unit.path)}
                  className="inline-block rounded-md border border-line bg-surface px-3 py-1.5 text-sm transition-colors hover:border-line-strong hover:bg-surface-2"
                >
                  {unit.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="text-xl">Notes</h2>

        {notes.length === 0 ? (
          <EmptyState
            title="Nothing published here yet"
            description={`Notes for ${node.title} are being written. When they are published they will appear here, organised by unit and readable without signing in.`}
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {notes.map((note) => (
              <li key={note.id}>
                <Link
                  href={noteUrl(note)}
                  className="flex flex-col rounded-md border border-line bg-surface px-4 py-3.5 transition-colors hover:border-line-strong hover:bg-surface-2"
                >
                  <span className="text-lg text-ink">{note.title}</span>
                  {note.excerpt ? (
                    <span className="mt-1 line-clamp-2 text-ink-muted">
                      {note.excerpt}
                    </span>
                  ) : null}
                  {note.readingMinutes ? (
                    <span className="mt-2 text-sm text-ink-subtle">
                      {note.readingMinutes} min read
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <JsonLd
        data={collectionPage({
          url: siteUrl(urlFor(node.path)),
          title: node.title,
          description: node.description,
          items: notes.map((note) => ({
            url: siteUrl(noteUrl(note)),
            title: note.title,
          })),
        })}
      />
    </div>
  );
}
