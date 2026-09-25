/**
 * A `JSON-LD` block.
 *
 * A plain `<script>`, not `next/script`: this is not a script to load, it is
 * data a crawler reads, and `next/script` would add scheduling and loading
 * concerns that do not apply. The project's own Next docs say the same.
 *
 * **The `<` escape is the point.** `JSON.stringify` leaves `<` alone, so a note
 * whose body contains `</script>` would close this tag early and everything
 * after it would be parsed as markup — an injection reachable from ordinary
 * content, on a public page. Escaping every `<` to `<` is valid JSON and
 * cannot terminate the element. The one other `dangerouslySetInnerHTML` in this
 * codebase does the same thing for the same reason: both are data, and neither
 * is markup.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
