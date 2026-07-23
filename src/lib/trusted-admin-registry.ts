import type { SupabaseClient } from "@supabase/supabase-js";
import { getTrustedAdminUserIds } from "@/lib/admin-identity";

// Database triggers cannot access Vercel environment variables. Keep their
// recipient list synchronized from the only authority: ADMIN_USER_IDS.
export async function syncTrustedAdminRegistry(supabase: SupabaseClient) {
  const userIds = Array.from(getTrustedAdminUserIds());
  if (userIds.length === 0) return;

  const { error } = await supabase
    .from("trusted_admin_accounts")
    .upsert(userIds.map((user_id) => ({ user_id })), { onConflict: "user_id" });

  if (error) throw error;
}
