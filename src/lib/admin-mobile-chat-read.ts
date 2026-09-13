import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function markAdminMobileChatRead(adminUserId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("admin_mobile_device_tokens")
    .update({ chat_last_read_at: new Date().toISOString(), chat_notification_pending: false })
    .eq("admin_user_id", adminUserId)
    .is("revoked_at", null);
  if (error) throw error;
}
