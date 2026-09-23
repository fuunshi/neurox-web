import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders a note's markdown.
 *
 * **`react-markdown` rather than a string renderer** (`marked`, `markdown-it`)
 * because it produces React elements rather than an HTML string. There is no
 * `dangerouslySetInnerHTML` step anywhere in this path, and material imported
 * from a PDF or a DOCX can contain arbitrary `<script>`-shaped text.
 *
 * **There is no `rehype-raw`, and no `rehype-sanitize` either.** The first is
 * the plugin that would make this path dangerous: without it, react-markdown
 * emits raw HTML as *escaped text* rather than parsing it, so
 * `<script>alert(1)</script>` in a note is displayed to the reader and never
 * executed. The second was the obvious belt-and-braces addition, and measuring
 * it showed it does the wrong thing here: with `rehype-sanitize` in the
 * pipeline the same string is **deleted** — the output is empty — because
 * sanitising strips the raw node rather than escaping it.
 *
 * That would be a silent content loss in exactly the subjects this site
 * covers. "Web Technology" and "Cyber Security and Ethical Hacking" are BCA
 * subjects whose notes contain HTML on purpose, and a lesson about `<script>`
 * is not an attack. Showing it escaped is both safe and correct; deleting it
 * is neither. `prose.test.tsx` holds both halves of that — nothing is ever
 * executable, and the text is still there.
 *
 * **`urlTransform` is not optional.** A markdown link is not raw HTML, so
 * `[x](javascript:alert(1))` is exploitable regardless of `rehype-raw` — it is
 * a plain link with a hostile scheme, and nothing above defends against it.
 * `defaultUrlTransform` already blocks that class, but the allow-list is stated
 * here so the rule is visible and so relative links — which this site depends
 * on for cross-linking subjects and notes — are deliberately kept.
 */

/** Schemes a note may link to. Everything else becomes an empty href. */
const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

function safeUrl(url: string): string {
  const trimmed = url.trim();

  // In-site links and fragments. These are the links this site writes itself,
  // and they have no scheme to check — `/bca/semester-3`, `#worked-examples`.
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) return trimmed;

  try {
    const { protocol } = new URL(trimmed);
    return SAFE_PROTOCOLS.has(protocol) ? trimmed : "";
  } catch {
    // Not an absolute URL, so it is a relative path like `diagrams/tree.png`.
    return trimmed;
  }
}

function isExternal(href: string | undefined): boolean {
  return href !== undefined && /^https?:/i.test(href);
}

const COMPONENTS: Components = {
  /**
   * A table gets a scrolling wrapper rather than the page scrolling.
   *
   * Comparison tables are common in study notes and are the element most
   * likely to overflow a phone; letting the body scroll sideways to read one
   * makes every other paragraph scroll too.
   */
  table: ({ children }) => (
    <div className="table-scroll">
      <table>{children}</table>
    </div>
  ),

  /**
   * External links open in a new tab; in-site links do not.
   *
   * `noopener` is set for the same reason `next.config.ts` sets
   * `Referrer-Policy: no-referrer` on the auth routes — a page this one links
   * to should not get anything about this one for free. `nofollow` is *not*
   * set: an ordinary reference link is an editorial choice, and only paid
   * links need that (the sponsor slot handles its own).
   */
  a: ({ href, title, children }) =>
    isExternal(href) ? (
      <a
        href={href}
        title={title}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ) : (
      <a href={href} title={title}>
        {children}
      </a>
    ),
};

export function Prose({ markdown }: { markdown: string }) {
  return (
    <div className="prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={safeUrl}
        components={COMPONENTS}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
