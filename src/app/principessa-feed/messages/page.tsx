import { PrincipessaFeedRoutePage } from "@/components/PrincipessaFeedRoutePage";

export default async function PrincipessaFeedMessagesPage({ searchParams }: { searchParams: Promise<{ to?: string | string[] }> }) {
  const params = await searchParams;
  const recipientId = Array.isArray(params.to) ? params.to[0] : params.to;
  return <PrincipessaFeedRoutePage initialRecipientId={recipientId ?? ""} view="messages" />;
}
