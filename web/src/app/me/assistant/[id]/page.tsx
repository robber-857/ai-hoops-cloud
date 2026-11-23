import { AssistantChat } from "../AssistantChat";

export default async function SavedChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AssistantChat conversationId={id} />;
}
