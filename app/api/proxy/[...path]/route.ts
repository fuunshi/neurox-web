import { ApiError } from "@/lib/errors";
import {
  assertSameOrigin,
  clientIp,
  jsonError,
  jsonOk,
} from "@/lib/server/handler";
import { ALLOWED_ROOTS } from "@/lib/server/proxy-roots";
import { readSession } from "@/lib/server/session";
import { readEnvelope, upstreamFetch } from "@/lib/server/upstream";

/**
 * The single forwarder the browser uses for anything not covered by a dedicated
 * auth handler.
 *
 * One generic route rather than ~15 near-identical ones. It is not an open
 * proxy: the upstream path is restricted to an allow-list of API roots, the only
 * credential attached is the caller's own session token, and the upstream origin
 * comes from server config, never from the request.
 *
 * Bodies are forwarded verbatim, unlike the auth handlers, which rebuild theirs
 * field by field. That is acceptable here because the only caller is this app's
 * own client code and the API validates regardless — an unknown property is a
 * 400 from the API, not a silent write.
 */

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

function resolvePath(segments: string[], search: string): string {
  if (segments.length === 0) {
    throw new ApiError({
      kind: "not_found",
      status: 404,
      messages: ["No such endpoint."],
    });
  }

  // Reject traversal outright rather than relying on URL normalisation.
  if (segments.some((segment) => segment === ".." || segment.includes("/"))) {
    throw new ApiError({
      kind: "forbidden",
      status: 403,
      messages: ["No such endpoint."],
    });
  }

  if (!ALLOWED_ROOTS.has(segments[0])) {
    throw new ApiError({
      kind: "not_found",
      status: 404,
      messages: ["No such endpoint."],
    });
  }

  return `/${segments.join("/")}${search}`;
}

async function forward(
  request: Request,
  method: Method,
  segments: string[],
  search: string,
): Promise<Response> {
  try {
    if (method !== "GET") assertSameOrigin(request);

    const path = resolvePath(segments, search);
    const { accessToken } = await readSession();

    const contentType = request.headers.get("content-type") ?? "";
    const isMultipart = contentType.includes("multipart/form-data");

    // FormData is passed through untouched so the browser's own boundary header
    // survives; anything else goes as JSON.
    const rawBody =
      method === "GET" || method === "DELETE" || !request.body
        ? undefined
        : isMultipart
          ? await request.formData()
          : ((await request.json().catch(() => undefined)) as unknown);

    const response = await upstreamFetch(path, {
      method,
      token: accessToken,
      clientIp: clientIp(request),
      rawBody: rawBody instanceof FormData ? rawBody : undefined,
      body: rawBody instanceof FormData ? undefined : rawBody,
    });

    const payload = await readEnvelope<unknown>(response);

    // Deletes answer 204 with no body; echoing that keeps the client's
    // "nothing to parse" path exercised on both sides.
    if (payload === undefined) {
      return new Response(null, { status: 204 });
    }

    return jsonOk(payload);
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return forward(request, "GET", path, new URL(request.url).search);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return forward(request, "POST", path, new URL(request.url).search);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return forward(request, "PATCH", path, new URL(request.url).search);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return forward(request, "PUT", path, new URL(request.url).search);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return forward(request, "DELETE", path, new URL(request.url).search);
}
