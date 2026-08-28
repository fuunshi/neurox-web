import { EmptyState } from "@/components/ui/empty-state";
import type { Activity } from "@/lib/api-types";
import { getViewer, listActivity } from "@/lib/server/queries";
import { ActivityFeed } from "./activity-feed";

export const metadata = { title: "Activity" };

export default async function ActivityPage() {
  // The API requires `contextType=USER` with the caller's own id and refuses
  // anything else, so the id comes from the session rather than a query string —
  // it never appears in a URL a reader could edit.
  const viewer = await getViewer();
  const activities = await listActivity(viewer.id);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl">Activity</h1>
        <p className="mt-1 max-w-prose text-ink-muted">
          What you have added, generated and changed, newest first.
        </p>
      </div>

      {activities.data.length === 0 ? (
        <EmptyState
          title="Nothing recorded yet"
          description="Adding a source, generating cards and editing a deck all show up here."
        />
      ) : (
        <ActivityFeed initial={activities} viewerId={viewer.id} />
      )}
    </div>
  );
}

export type { Activity };
