import { PrincipessaSocialFeed, type PrincipessaFeedView } from "@/components/PrincipessaSocialFeed";
import { TopLevelNav } from "@/components/TopLevelNav";
import { isTrustedAdminUserId } from "@/lib/admin-identity";
import { createClient } from "@/lib/supabase/server";

export async function PrincipessaFeedRoutePage({ initialRecipientId = "", view }: { initialRecipientId?: string; view: PrincipessaFeedView }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  return <main className="min-h-screen bg-[#050507] text-white">
    <div className="sticky top-0 z-[100]"><TopLevelNav active="feed" /></div>
    <PrincipessaSocialFeed initialRecipientId={initialRecipientId} initialView={view} isAdmin={isTrustedAdminUserId(user?.id)} isLoggedIn={Boolean(user)} />
  </main>;
}
