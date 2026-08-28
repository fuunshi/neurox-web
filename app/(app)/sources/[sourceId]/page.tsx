import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonStyles } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import type { SourceDetail, TextChunk } from "@/lib/api-types";
import { ApiError } from "@/lib/errors";
import {
  formatBytes,
  relativeTime,
  sourceStatusLabel,
  sourceTypeLabel,
} from "@/lib/format";
import { getSource, getSourceChunks } from "@/lib/server/queries";

export const metadata = { title: "Source" };

/**
 * One source, and the text that came out of it.
 *
 * The list shows a two-line excerpt, which is enough to recognise a document
 * and not enough to check one. This is where the extracted text is readable —
 * the difference between "the app has my PDF" and "the app has my PDF's text,
 * and it is not garbage", which is the question a failed generation actually
 * raises.
 *
 * Chunks are shown because they are what the generator reads. A document whose
 * definitions sit inside one enormous paragraph still chunks into that
 * paragraph, and seeing the split is what explains a run that found nothing.
 */
async function loadSource(sourceId: string): Promise<{
  source: SourceDetail;
  chunks: TextChunk[] | null;
}> {
  try {
    const source = await getSource(sourceId);

    // The chunks endpoint refuses anything that is not READY, so it is only
    // asked when there is text to split.
    const chunks =
      source.status === "READY" ? await getSourceChunks(sourceId) : null;

    return { source, chunks };
  } catch (error) {
    // A source that does not exist and one belonging to someone else both
    // answer 404, so both become this page's not-found.
    if (error instanceof ApiError && error.kind === "not_found") notFound();
    throw error;
  }
}

export default async function SourcePage({
  params,
}: {
  params: Promise<{ sourceId: string }>;
}) {
  const { sourceId } = await params;
  const { source, chunks } = await loadSource(sourceId);

  const failed = source.status === "FAILED";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl">{source.title}</h1>
          <p className="mt-1 text-sm text-ink-subtle">
            {sourceTypeLabel(source.type)}
            {source.fileName ? ` · ${source.fileName}` : ""}
            {source.sizeBytes ? ` · ${formatBytes(source.sizeBytes)}` : ""}
            {source.characterCount
              ? ` · ${source.characterCount.toLocaleString()} characters`
              : ""}
            {" · added "}
            {relativeTime(source.createdAt)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={failed ? "danger" : source.status === "READY" ? "success" : "due"}>
            {sourceStatusLabel(source.status)}
          </Chip>
          {source.status === "READY" ? (
            <Link
              href={`/generate?source=${source.id}`}
              className={buttonStyles({ size: "sm" })}
            >
              Generate cards
            </Link>
          ) : null}
          <Link
            href="/sources"
            className={buttonStyles({ variant: "quiet", size: "sm" })}
          >
            All sources
          </Link>
        </div>
      </div>

      {/* The API answers 201 even when extraction failed, so the reason lives on
          the record rather than in the status code. */}
      {failed && source.error ? (
        <p className="rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger-fg">
          {source.error}
        </p>
      ) : null}

      <Panel>
        <PanelHeader
          title="Extracted text"
          description="What the app read out of this source. Everything below is taken from here."
        />
        <PanelBody>
          {source.text ? (
            <div className="max-h-[32rem] overflow-auto rounded-md border border-line bg-surface-2 p-4">
              {/* `whitespace-pre-wrap` because the line breaks are the
                  document's own: a PDF's paragraphs and a Markdown file's
                  headings are the structure the chunker reads. */}
              <p className="text-sm whitespace-pre-wrap text-ink">
                {source.text}
              </p>
            </div>
          ) : (
            <p className="text-ink-muted">
              {failed
                ? "Nothing could be read from this source. The reason is above."
                : "The text has not been extracted yet. This page will show it once the source is ready."}
            </p>
          )}
        </PanelBody>
      </Panel>

      {chunks ? (
        <Panel>
          <PanelHeader
            title="How it will be read"
            description={`Split into ${chunks.length} ${
              chunks.length === 1 ? "chunk" : "chunks"
            } for generation. Cards are drafted from these, one at a time.`}
          />
          <PanelBody>
            <ol className="flex flex-col gap-3">
              {chunks.map((chunk) => (
                <li
                  key={chunk.index}
                  className="rounded-md border border-line px-3.5 py-2.5"
                >
                  <p className="text-sm text-ink-subtle">
                    Chunk {chunk.index + 1}
                  </p>
                  <p className="mt-1 line-clamp-4 text-sm whitespace-pre-wrap text-ink-muted">
                    {chunk.text}
                  </p>
                </li>
              ))}
            </ol>
          </PanelBody>
        </Panel>
      ) : null}
    </div>
  );
}
