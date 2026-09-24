import { listSources } from "@/lib/server/queries";
import { SourcesView } from "./sources-view";

export const metadata = { title: "Sources" };

export default async function SourcesPage() {
  const { data: sources } = await listSources();

  return <SourcesView initialSources={sources} />;
}
