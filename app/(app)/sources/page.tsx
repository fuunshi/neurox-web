import { getGenerationAnalytics, listSources } from "@/lib/server/queries";
import { SourcesView } from "./sources-view";

export const metadata = { title: "Sources" };

export default async function SourcesPage() {
  // Both at once: the list and its yield are two reads of the same material,
  // and the page is useless until it has the list anyway.
  const [{ data: sources }, analytics] = await Promise.all([
    listSources(),
    getGenerationAnalytics(),
  ]);

  return <SourcesView initialSources={sources} analytics={analytics} />;
}
