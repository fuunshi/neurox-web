import type { CurriculumNode, NoteDetail } from "@/lib/api-types";

/**
 * schema.org builders, as plain functions returning plain objects.
 *
 * Kept apart from the components that render them so the shapes can be tested
 * without a DOM, and so the vocabulary lives in one place rather than being
 * spelled out at each call site.
 *
 * The `@context` is repeated in every builder rather than being added by the
 * caller. A structured-data block that is a fragment of a graph is valid
 * through `@graph`, but a bare node missing its context is silently ignored by
 * every consumer — a failure that is invisible until someone checks Rich
 * Results, which is exactly the kind of thing that never gets checked.
 */

type Schema = Record<string, unknown>;

/**
 * A learning resource rather than a plain article.
 *
 * `LearningResource` is schema.org's actual education vocabulary and is far
 * less used than `Article` on course sites, which makes it a small advantage.
 * `Article` is kept alongside it because that is what general search surfaces
 * look for, and a document can honestly be both.
 */
export function learningResource(input: {
  url: string;
  title: string;
  description: string | null;
  publishedAt: string | null;
  updatedAt: string;
  /** "Notes", "Exam paper", "Syllabus". */
  resourceType: string;
  /** The subject or unit this belongs to. */
  isPartOf: { url: string; title: string };
  breadcrumbs?: Schema;
}): Schema {
  return {
    "@context": "https://schema.org",
    "@type": ["Article", "LearningResource"],
    headline: input.title,
    ...(input.description ? { description: input.description } : {}),
    ...(input.publishedAt ? { datePublished: input.publishedAt } : {}),
    dateModified: input.updatedAt,
    mainEntityOfPage: { "@type": "WebPage", "@id": input.url },
    learningResourceType: input.resourceType,
    educationalLevel: "Undergraduate",
    inLanguage: "en",
    isPartOf: {
      "@type": "CollectionPage",
      "@id": input.isPartOf.url,
      name: input.isPartOf.title,
    },
    ...(input.breadcrumbs ? { breadcrumb: input.breadcrumbs } : {}),
  };
}

/** A course, as an educational programme rather than a course listing. */
export function course(input: {
  url: string;
  title: string;
  description: string | null;
  /** Subject names, in order, so a consumer sees what the year covers. */
  subjects: string[];
}): Schema {
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: input.title,
    ...(input.description ? { description: input.description } : {}),
    url: input.url,
    inLanguage: "en",
    educationalLevel: "Undergraduate",
    provider: {
      "@type": "CollegeOrUniversity",
      name: "Tribhuvan University",
    },
    ...(input.subjects.length
      ? {
          hasCourseInstance: input.subjects.map((name) => ({
            "@type": "CourseInstance",
            name,
            courseMode: "online",
          })),
        }
      : {}),
  };
}

/** A listing page: a subject, a semester, a unit. */
export function collectionPage(input: {
  url: string;
  title: string;
  description: string | null;
  /** Titles and URLs of what it lists, in order. */
  items: { url: string; title: string }[];
}): Schema {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: input.title,
    ...(input.description ? { description: input.description } : {}),
    url: input.url,
    inLanguage: "en",
    ...(input.items.length
      ? {
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: input.items.length,
            itemListElement: input.items.map((item, index) => ({
              "@type": "ListItem",
              position: index + 1,
              url: item.url,
              name: item.title,
            })),
          },
        }
      : {}),
  };
}

/**
 * The trail a search result shows instead of a bare URL.
 *
 * Built from the same nodes the visible breadcrumb renders, so the two cannot
 * disagree — a structured-data breadcrumb that does not match the page is worse
 * than none.
 */
export function breadcrumbList(
  nodes: { title: string; url: string }[],
): Schema {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: nodes.map((node, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: node.title,
      item: node.url,
    })),
  };
}

/**
 * The site itself, for the homepage.
 *
 * The `SearchAction` is what lets a search engine offer the site's own search
 * box, and it only applies because this site has a real search page to point
 * at — a `SearchAction` aimed at a page that ignores `q` is a false claim.
 */
export function website(input: {
  url: string;
  name: string;
  description: string;
}): Schema {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: input.name,
    description: input.description,
    url: input.url,
    inLanguage: "en",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${input.url}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/** Convenience: the resource type a note is, for `learningResource`. */
export function noteResourceType(note: Pick<NoteDetail, "title">): string {
  return note.title.toLowerCase().includes("question") ? "Exam paper" : "Notes";
}

/** Convenience: the node a page is about, as a schema.org reference. */
export function nodeReference(
  node: Pick<CurriculumNode, "path" | "title">,
  url: string,
): { url: string; title: string } {
  return { url, title: node.title };
}
