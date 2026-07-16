import { PrincipessaSocialFeed, type PrincipessaFeedView } from "@/components/PrincipessaSocialFeed";
import { TopLevelNav } from "@/components/TopLevelNav";
import { isTrustedAdminUserId } from "@/lib/admin-identity";
import { createClient } from "@/lib/supabase/server";

export async function PrincipessaFeedRoutePage({ initialProfileUserId = "", initialRecipientId = "", view }: { initialProfileUserId?: string; initialRecipientId?: string; view: PrincipessaFeedView }) {
  const hasSupabaseEnvironment = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const user = hasSupabaseEnvironment
    ? (await (await createClient()).auth.getUser()).data.user
    : null;

  return <main className="min-h-screen bg-[#050507] text-white">
    <div className="sticky top-0 z-[100]"><TopLevelNav active="feed" /></div>
    <PrincipessaSocialFeed currentUserId={user?.id ?? ""} initialProfileUserId={initialProfileUserId} initialRecipientId={initialRecipientId} initialView={view} isAdmin={isTrustedAdminUserId(user?.id)} isLoggedIn={Boolean(user)} />
  </main>;
}
