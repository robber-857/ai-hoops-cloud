import { AssistantHistory } from "./AssistantHistory";

export default async function HistoryPage({ searchParams }: {
  searchParams: Promise<{ view?: string; page?: string }>;
}) {
  const params = await searchParams;
  const requested = Number(params.page);
  const page = Number.isSafeInteger(requested) && requested > 0 ? requested : 1;
  return <AssistantHistory archived={params.view === "archived"} page={page} />;
}
