import { listDecks } from "@/lib/server/queries";
import { DecksView } from "./decks-view";

export const metadata = { title: "Decks" };

export default async function DecksPage() {
  // The whole page, cursor included, rather than just its rows: the list keeps
  // loading client-side, and the cursor is the API's to issue.
  const decks = await listDecks();

  return <DecksView initialDecks={decks} />;
}
