"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { SourceYield } from "@/components/analytics/source-yield";
import { FormBanner } from "@/components/auth/form-banner";
import { Button, buttonStyles } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LoadMore } from "@/components/ui/load-more";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api/client";
import type { CursorPage, GenerationAnalytics, Source } from "@/lib/api-types";
import {
  ACCEPTED_EXTENSIONS,
  formatBytes,
  formatCount,
  MAX_PASTED_CHARS,
  MAX_UPLOAD_BYTES,
  relativeTime,
  sourceStatusLabel,
  sourceTypeLabel,
} from "@/lib/format";
import { useCursorList } from "@/lib/hooks/use-cursor-list";
import { useSubmit } from "@/lib/hooks/use-submit";

export function SourcesView({
  initialSources,
  analytics,
}: {
  initialSources: CursorPage<Source>;
  analytics: GenerationAnalytics;
}) {
  const [tab, setTab] = useState<"paste" | "upload">("paste");
  const {
    items: sources,
    setItems: setSources,
    hasMore,
    loading: loadingMore,
    loadMore,
  } = useCursorList<Source>(initialSources, "sources?limit=24");

  /*
   * Adding and deleting are applied to the list in place rather than by
   * refreshing the route. A refresh would re-render the server component with
   * a fresh first page, while this component's state holds every page loaded so
   * far — so the reader would silently lose the pages they had loaded.
   *
   * Newest first, which is the order the API returns a list in.
   */
  function addSource(source: Source) {
    setSources((current) => [source, ...current]);
  }

  function removeSource(sourceId: string) {
    setSources((current) => current.filter((item) => item.id !== sourceId));
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div>
        <h1 className="text-2xl">Sources</h1>
        <p className="mt-1 max-w-prose text-ink-muted">
          The material cards get written from. A source is read once, when you
          add it, and kept so you can generate again without uploading twice.
        </p>
      </div>

      <Panel>
        <PanelHeader
          title="Add material"
          action={
            <div
              role="tablist"
              aria-label="How to add material"
              className="flex items-center gap-0.5 rounded-lg border border-line p-0.5"
            >
              {(
                [
                  ["paste", "Paste text"],
                  ["upload", "Upload a file"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  role="tab"
                  type="button"
                  aria-selected={tab === value}
                  onClick={() => setTab(value)}
                  className={
                    tab === value
                      ? "cursor-pointer rounded-md bg-accent-soft px-3 py-1.5 text-sm text-accent"
                      : "cursor-pointer rounded-md px-3 py-1.5 text-sm text-ink-muted hover:text-ink"
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          }
        />
        <PanelBody>
          {tab === "paste" ? (
            <PasteForm onAdded={addSource} />
          ) : (
            <UploadForm onAdded={addSource} />
          )}
        </PanelBody>
      </Panel>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg">
          Your material
          {sources.length > 0 ? (
            <span className="ml-2 font-normal text-ink-subtle">
              {formatCount(sources.length, "source")}
              {/* A lower bound while more remain unloaded, rather than a total
                  the page cannot actually vouch for. */}
              {hasMore ? "+" : ""}
            </span>
          ) : null}
        </h2>

        {sources.length === 0 ? (
          <EmptyState
            title="Nothing here yet"
            description="Paste a page of notes or upload a PDF above. You will see what was read from it before generating any cards."
          />
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {sources.map((source) => (
                <SourceRow
                  key={source.id}
                  source={source}
                  onRemoved={() => removeSource(source.id)}
                />
              ))}
            </ul>

            <LoadMore
              shown={sources.length}
              hasMore={hasMore}
              loading={loadingMore}
              onLoadMore={loadMore}
              noun="source"
            />
          </>
        )}
      </section>

      <Panel>
        <PanelHeader
          title="What these produced"
          description="Counts from generation, not from studying — a source that yields nothing is worth knowing about before you add three more like it."
        />
        <PanelBody>
          <SourceYield analytics={analytics} />
        </PanelBody>
      </Panel>
    </div>
  );
}

function PasteForm({ onAdded }: { onAdded: (source: Source) => void }) {
  const { pending, error, fieldErrors, submit, setFieldErrors } = useSubmit();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    const fields: Record<string, string> = {};
    if (!title.trim()) fields.title = "Give it a name you will recognise.";
    if (!text.trim()) fields.text = "Paste the material first.";
    if (text.length > MAX_PASTED_CHARS) {
      fields.text = `That is ${text.length.toLocaleString()} characters — over the ${MAX_PASTED_CHARS.toLocaleString()} limit.`;
    }

    if (Object.keys(fields).length > 0) {
      setFieldErrors(fields);
      return;
    }

    const outcome = await submit(() =>
      apiFetch<Source>("sources/text", {
        method: "POST",
        body: { title: title.trim(), text },
      }),
    );

    if (outcome.ok) {
      setTitle("");
      setText("");
      onAdded(outcome.value);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormBanner error={error} />

      <Field label="Name" required error={fieldErrors.title}>
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Lecture 3 — Memory and retention"
          required
        />
      </Field>

      <Field
        label="Text"
        required
        error={fieldErrors.text}
        hint={
          text.length > 0
            ? `${text.length.toLocaleString()} characters`
            : "Markdown headings work especially well — the heuristic reader makes one card per heading."
        }
      >
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={10}
          placeholder={"## Spaced repetition\nReviewing material at increasing intervals…"}
          required
        />
      </Field>

      <Button type="submit" loading={pending} className="self-start">
        Read this text
      </Button>
    </form>
  );
}

function UploadForm({ onAdded }: { onAdded: (source: Source) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const { pending, error, submit, setFieldErrors, fieldErrors } = useSubmit();

  function choose(next: File | null) {
    if (!next) return;

    // Checked here so an obvious mistake is answered immediately rather than by
    // a rejected upload.
    const extension = `.${next.name.split(".").pop()?.toLowerCase() ?? ""}`;
    if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(extension)) {
      setFieldErrors({
        file: `That file type is not read. Accepted: ${ACCEPTED_EXTENSIONS.join(", ")}.`,
      });
      return;
    }
    if (next.size > MAX_UPLOAD_BYTES) {
      setFieldErrors({
        file: `That file is ${formatBytes(next.size)} — over the 10 MB limit.`,
      });
      return;
    }

    setFieldErrors({});
    setFile(next);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setFieldErrors({ file: "Choose a file first." });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const outcome = await submit(() =>
      apiFetch<Source>(
        `sources/upload?title=${encodeURIComponent(file.name)}`,
        { method: "POST", formData },
      ),
    );

    if (outcome.ok) {
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      onAdded(outcome.value);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormBanner error={error} />

      {/* A label wrapping the input: the whole area is the control, and it stays
          keyboard reachable without extra handlers. */}
      <label
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          choose(event.dataTransfer.files[0] ?? null);
        }}
        className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed px-6 py-8 text-center transition-colors ${
          dragging
            ? "border-accent bg-accent-soft"
            : "border-line-strong bg-surface-2"
        }`}
      >
        <span className="font-medium">
          {file ? file.name : "Drop a file here, or choose one"}
        </span>
        <span className="text-sm text-ink-muted">
          {file
            ? formatBytes(file.size)
            : `${ACCEPTED_EXTENSIONS.join(", ")} · up to 10 MB`}
        </span>
        <input
          ref={inputRef}
          type="file"
          name="file"
          className="sr-only"
          accept={ACCEPTED_EXTENSIONS.join(",")}
          onChange={(event) => choose(event.target.files?.[0] ?? null)}
        />
      </label>

      {fieldErrors.file ? (
        <p className="text-sm text-danger-fg">{fieldErrors.file}</p>
      ) : null}

      <Button type="submit" loading={pending} className="self-start">
        Read this file
      </Button>
    </form>
  );
}

function SourceRow({
  source,
  onRemoved,
}: {
  source: Source;
  onRemoved: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const { pending, submit } = useSubmit();

  const failed = source.status === "FAILED";

  async function remove() {
    const outcome = await submit(() =>
      apiFetch<void>(`sources/${source.id}`, { method: "DELETE" }),
    );
    if (outcome.ok) {
      setConfirming(false);
      // The list owns its own state, so the row takes itself out of it rather
      // than asking the route to re-render.
      onRemoved();
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="truncate font-medium">{source.title}</p>
          <p className="text-sm text-ink-subtle">
            {sourceTypeLabel(source.type)}
            {source.sizeBytes ? ` · ${formatBytes(source.sizeBytes)}` : ""}
            {source.characterCount
              ? ` · ${source.characterCount.toLocaleString()} characters`
              : ""}
            {" · "}
            {relativeTime(source.createdAt)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Chip tone={failed ? "danger" : source.status === "READY" ? "success" : "due"}>
            {sourceStatusLabel(source.status)}
          </Chip>
          {source.status === "READY" ? (
            <>
              <Link
                href={`/sources/${source.id}`}
                className={buttonStyles({ variant: "secondary", size: "sm" })}
              >
                Read
              </Link>
              <Link
                href={`/generate?source=${source.id}`}
                className={buttonStyles({ variant: "secondary", size: "sm" })}
              >
                Generate
              </Link>
            </>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirming(true)}
            aria-label={`Delete ${source.title}`}
          >
            Delete
          </Button>
        </div>
      </div>

      {/* The API answers 201 even when extraction failed, so the row is driven
          by `status`, and the reason is shown rather than hidden. */}
      {failed && source.error ? (
        <p className="rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger-fg">
          {source.error}
        </p>
      ) : null}

      {!failed && source.excerpt ? (
        <p className="line-clamp-2 text-sm text-ink-muted">{source.excerpt}</p>
      ) : null}

      <ConfirmDialog
        open={confirming}
        title="Delete this source?"
        description={
          <>
            Cards already generated from it stay in their deck. The source and
            its extracted text are removed.
          </>
        }
        confirmLabel="Delete"
        destructive
        pending={pending}
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      />
    </li>
  );
}
