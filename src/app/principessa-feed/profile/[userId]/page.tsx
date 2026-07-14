import { PrincipessaFeedRoutePage } from "@/components/PrincipessaFeedRoutePage";

export default async function PrincipessaPublicFeedProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return <PrincipessaFeedRoutePage initialProfileUserId={userId} view="profile" />;
}
