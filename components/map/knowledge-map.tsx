import type { GraphEdge, GraphNode, GraphNodeType } from "@/lib/api-types";

/**
 * The knowledge graph, drawn.
 *
 * A **layered** layout rather than a force-directed one, and that is the
 * important decision here. A force simulation produces a different picture on
 * every render for the same data — which makes it impossible to say whether the
 * graph changed because the material changed or because the physics settled
 * differently — and it needs a client component, a physics library and a
 * frame loop to draw a few dozen nodes.
 *
 * Three columns is enough to show the one thing the graph is for: material
 * flows left to right, from where it came from, to the deck it became, to what
 * it is about. Position carries that meaning, so nothing has to be explained.
 *
 * Rendered on the server as plain SVG. There is no state to keep and no
 * interaction that would need any.
 */

const COLUMN_X: Record<GraphNodeType, number> = {
  SOURCE: 110,
  DECK: 400,
  TERM: 690,
};

const COLUMN_ORDER: GraphNodeType[] = ["SOURCE", "DECK", "TERM"];

const COLUMN_LABEL: Record<GraphNodeType, string> = {
  SOURCE: "Sources",
  DECK: "Decks",
  TERM: "Terms",
};

const WIDTH = 800;
const ROW_HEIGHT = 62;
const TOP = 64;

interface Placed extends GraphNode {
  x: number;
  y: number;
  radius: number;
}

function place(nodes: GraphNode[]): Placed[] {
  return COLUMN_ORDER.flatMap((type) => {
    const column = nodes.filter((node) => node.type === type);
    // Centre each column vertically so a short column does not hug the top and
    // leave the graph looking lopsided.
    const offset = Math.max(0, (maxRows(nodes) - column.length) / 2);

    return column.map((node, index) => ({
      ...node,
      x: COLUMN_X[type],
      y: TOP + (index + offset) * ROW_HEIGHT,
      // Radius from weight, bounded so a heavy node cannot swallow its column.
      radius: 7 + Math.round(node.weight * 9),
    }));
  });
}

function maxRows(nodes: GraphNode[]): number {
  return Math.max(
    1,
    ...COLUMN_ORDER.map((type) => nodes.filter((n) => n.type === type).length),
  );
}

export function KnowledgeMap({
  nodes,
  edges,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
}) {
  if (nodes.length === 0) return null;

  const placed = place(nodes);
  const byId = new Map(placed.map((node) => [node.id, node]));
  const height = TOP + maxRows(nodes) * ROW_HEIGHT + 24;

  const drawn = edges
    .map((edge) => {
      const from = byId.get(edge.source);
      const to = byId.get(edge.target);
      return from && to ? { edge, from, to } : null;
    })
    .filter((entry) => entry !== null);

  return (
    <figure className="m-0 flex flex-col gap-3">
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        role="img"
        aria-label={`Knowledge graph: ${nodes.length} nodes and ${edges.length} connections, listed in full below.`}
        className="w-full"
      >
        {COLUMN_ORDER.map((type) => (
          <text
            key={type}
            x={COLUMN_X[type]}
            y={28}
            textAnchor="middle"
            className="fill-ink-subtle text-xs"
          >
            {COLUMN_LABEL[type]}
          </text>
        ))}

        {drawn.map(({ edge, from, to }) => (
          <path
            key={`${edge.source}-${edge.target}`}
            d={curve(from, to)}
            fill="none"
            strokeWidth={edge.type === "GENERATED_FROM" ? 1.75 : 1}
            // A solid line for a relationship the database holds, dashed for the
            // one that is still a stand-in. The distinction is drawn, not left
            // to the legend.
            strokeDasharray={edge.type === "GENERATED_FROM" ? undefined : "4 4"}
            className={
              edge.type === "GENERATED_FROM" ? "stroke-accent" : "stroke-line-strong"
            }
            opacity={edge.type === "GENERATED_FROM" ? 0.75 : 0.6}
          />
        ))}

        {placed.map((node) => (
          <g key={node.id}>
            <circle
              cx={node.x}
              cy={node.y}
              r={node.radius}
              className={
                node.type === "TERM"
                  ? "fill-surface stroke-line-strong"
                  : "fill-accent-soft stroke-accent"
              }
              strokeWidth={1.5}
            />
            <text
              x={node.x}
              y={node.y + node.radius + 15}
              textAnchor="middle"
              className="fill-ink text-xs"
            >
              {truncate(node.label)}
            </text>
          </g>
        ))}
      </svg>

      {/*
        The graph is a picture of a list, so the list is here too. A reader who
        cannot see the drawing gets the same information rather than a summary
        of it — the same reason the charts carry table views.
      */}
      <figcaption className="sr-only">
        <ul>
          {placed.map((node) => (
            <li key={node.id}>
              {COLUMN_LABEL[node.type]}: {node.label}
              {edges
                .filter((edge) => edge.source === node.id)
                .map((edge) => `, connects to ${byId.get(edge.target)?.label ?? "unknown"}`)
                .join("")}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

/** A horizontal cubic curve, so edges leave and arrive flat rather than angled. */
function curve(from: Placed, to: Placed): string {
  const midpoint = (from.x + to.x) / 2;

  return `M ${from.x + from.radius} ${from.y} C ${midpoint} ${from.y}, ${midpoint} ${to.y}, ${to.x - to.radius} ${to.y}`;
}

function truncate(label: string, max = 22): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}
