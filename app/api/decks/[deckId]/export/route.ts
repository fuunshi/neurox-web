import { isExportFormat } from "@/lib/export-format";
import { jsonError } from "@/lib/server/handler";
import { readSession } from "@/lib/server/session";
import { upstreamFetch } from "@/lib/server/upstream";

/**
 * Downloads a deck as a file.
 *
 * A dedicated route rather than the generic `/api/proxy`, for one reason: the
 * proxy speaks JSON, and this answers a CSV. It also lets the download be a
 * plain `<a href>` — no fetch, no blob, no JavaScript — which means it works
 * with the browser's own download handling and survives a middle-click.
 *
 * Nothing about the API's response is parsed, only forwarded. An export is
 * whatever the server says it is, and re-encoding it here would be a second
 * place for the escaping to go wrong.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ deckId: string }> },
) {
  try {
    const { deckId } = await params;

    const raw = new URL(request.url).searchParams.get("format");
    // An unknown format falls back rather than erroring: this is reached by a
    // link, and a broken one should still produce a file.
    const format = isExportFormat(raw) ? raw : "csv";

    const { accessToken } = await readSession();

    const upstream = await upstreamFetch(
      `/decks/${encodeURIComponent(deckId)}/export?format=${format}`,
      { token: accessToken },
    );

    if (!upstream.ok) {
      // Errors are JSON even here, so the client's normal error handling works.
      const text = await upstream.text();
      return new Response(text, {
        status: upstream.status,
        headers: { "content-type": "application/json" },
      });
    }

    const body = await upstream.arrayBuffer();

    return new Response(body, {
      status: 200,
      headers: {
        // Forwarded verbatim: the filename, including its UTF-8 form, is the
        // API's business.
        "content-type":
          upstream.headers.get("content-type") ?? "text/csv; charset=utf-8",
        "content-disposition":
          upstream.headers.get("content-disposition") ??
          `attachment; filename="deck.${format}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
