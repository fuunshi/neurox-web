/**
 * A table, and the only one on the page. Naming the limits — including the one
 * case that fails — is worth more than a fifth benefit card, because the
 * failure is the thing a reader would otherwise discover at 2am.
 *
 * Limits are the real ones: 10 MB per upload and 500,000 characters of pasted
 * text are enforced by the API.
 */
const FORMATS = [
  {
    ext: ".pdf",
    read: "Text layer extracted",
    limit: "10 MB",
  },
  {
    ext: ".docx",
    read: "Body text extracted",
    limit: "10 MB",
  },
  {
    ext: ".md .markdown",
    read: "Read as-is",
    limit: "10 MB",
  },
  {
    ext: ".txt .text",
    read: "Read as-is",
    limit: "10 MB",
  },
  {
    ext: "pasted text",
    read: "Typed or pasted straight in",
    limit: "500,000 characters",
  },
];

// Three short columns fit a phone if they are allowed to wrap. Forcing a
// min-width and scrolling would push the limits off-screen, and the limits are
// the reason this table exists.
export function FormatTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">
          File formats neurox can read, how each is handled, and the size limit
          for each.
        </caption>
        <thead>
          <tr className="border-b border-line-strong">
            <th scope="col" className="py-2.5 pr-4 text-sm font-medium text-ink">
              Format
            </th>
            <th scope="col" className="py-2.5 pr-4 text-sm font-medium text-ink">
              How it is read
            </th>
            <th scope="col" className="py-2.5 text-sm font-medium text-ink">
              Limit
            </th>
          </tr>
        </thead>
        <tbody>
          {FORMATS.map((format) => (
            <tr key={format.ext} className="border-b border-line">
              <th
                scope="row"
                className="py-3 pr-4 text-sm font-normal text-ink"
              >
                {/* Monospace is for the file extensions, where a fixed pitch is
                    genuinely how people read them. "pasted text" is not a
                    filename and does not get the treatment. */}
                {format.ext.startsWith(".") ? (
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>
                    {format.ext}
                  </span>
                ) : (
                  format.ext
                )}
              </th>
              <td className="py-3 pr-4 text-ink-muted">{format.read}</td>
              <td className="py-3 text-ink-muted tabular-nums">
                {format.limit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-5 max-w-prose text-ink-muted">
        A scanned PDF is the case worth knowing about. With no text layer there
        is nothing to read, so the source is marked{" "}
        <span className="text-due-fg">failed</span> and tells you why — rather
        than quietly producing an empty deck and leaving you to wonder.
      </p>
    </div>
  );
}
