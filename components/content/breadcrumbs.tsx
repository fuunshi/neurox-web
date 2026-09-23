import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbList } from "@/lib/seo/schema";
import Link from "next/link";

export interface Crumb {
  title: string;
  url: string;
}

/**
 * The trail down to the current page.
 *
 * The last crumb is text rather than a link — it is where the reader already
 * is, and a link to the current page is a control that does nothing.
 *
 * It also emits `BreadcrumbList`, from the same array it renders. That is
 * deliberate rather than tidy: a structured-data breadcrumb that disagrees with
 * the visible one is a worse signal than having none, and the only way to
 * guarantee they agree is for one to be derived from the other.
 */
export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  if (trail.length === 0) return null;

  return (
    <>
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {trail.map((crumb, index) => {
            const current = index === trail.length - 1;

            return (
              <li key={crumb.url} className="flex items-center gap-2">
                {index > 0 ? (
                  <span aria-hidden className="text-ink-subtle/70">
                    /
                  </span>
                ) : null}

                {current ? (
                  <span aria-current="page" className="text-ink-muted">
                    {crumb.title}
                  </span>
                ) : (
                  <Link
                    href={crumb.url}
                    className="text-ink-subtle transition-colors hover:text-accent hover:underline"
                  >
                    {crumb.title}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <JsonLd data={breadcrumbList(trail)} />
    </>
  );
}
