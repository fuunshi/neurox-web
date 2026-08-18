import Link from "next/link";
import { KnowledgeMap } from "@/components/map/knowledge-map";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { buttonStyles } from "@/components/ui/button";
import { getKnowledgeGraph } from "@/lib/server/queries";

export const metadata = { title: "Knowledge map" };

/**
 * How the reader's material connects.
 *
 * Deliberately explicit about which parts of the picture are real. The source
 * and deck nodes, and the lines between them, come from `generation_job` —
 * they have been in the database since the first generation ran. The term layer
 * is a stand-in until the extraction work lands, and the page says so rather
 * than letting a reader infer that the app has analysed their material. Drawing
 * a dashed line and labelling it is cheaper than a wrong belief.
 */
export default async function MapPage() {
  const graph = await getKnowledgeGraph();

  if (graph.nodes.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Header />
        <EmptyState
          title="Nothing to map yet"
          description="The map is built from your sources and decks. Add something to read, or write a deck, and it will appear here."
          action={
            <Link href="/sources" className={buttonStyles({ size: "sm" })}>
              Add a source
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <Header />

      <Panel>
        <PanelHeader
          title="Your material"
          description="Sources on the left, the decks they became, and what each deck covers."
        />
        <PanelBody>
          <KnowledgeMap nodes={graph.nodes} edges={graph.edges} />
        </PanelBody>
      </Panel>

      <Legend placeholder={graph.placeholder} />
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl">Knowledge map</h1>
      <p className="mt-1 max-w-prose text-ink-muted">
        Where your material came from, what it turned into, and what it covers —
        a picture of the same records the rest of the app is built on.
      </p>
    </div>
  );
}

function Legend({ placeholder }: { placeholder: boolean }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5">
      <h2 className="text-sm font-medium">Reading this</h2>

      <ul className="flex flex-col gap-2 text-sm text-ink-muted">
        <li className="flex items-center gap-3">
          <svg width="28" height="8" aria-hidden>
            <line
              x1="0"
              y1="4"
              x2="28"
              y2="4"
              className="stroke-accent"
              strokeWidth="1.75"
              opacity="0.75"
            />
          </svg>
          A deck whose cards were drafted from that source.
        </li>
        <li className="flex items-center gap-3">
          <svg width="28" height="8" aria-hidden>
            <line
              x1="0"
              y1="4"
              x2="28"
              y2="4"
              strokeDasharray="4 4"
              className="stroke-line-strong"
            />
          </svg>
          What a deck is about.
        </li>
      </ul>

      {placeholder ? (
        <p className="border-t border-line pt-3 text-sm text-ink-subtle">
          The sources, the decks and the lines between them are your own records.
          The <strong className="font-medium">terms</strong> are placeholders —
          real ones need the extraction work, which is not built yet.
        </p>
      ) : null}
    </div>
  );
}
