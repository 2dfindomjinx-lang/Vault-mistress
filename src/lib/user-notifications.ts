import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type UserNotificationKind =
  | "principessa_feed_admin_like"
  | "principessa_feed_like"
  | "principessa_feed_mention"
  | "principessa_feed_new_post"
  | "principessa_feed_reply"
  | "principessa_feed_repost"
  | "principessa_feed_dm"
  | "debt_evil_approved"
  | "debt_closed_by_admin"
  | "debt_timeout_applied"
  | "irl_task_approved"
  | "irl_task_excused"
  | "irl_task_failed"
  | "pet_task_approved"
  | "pet_task_rejected"
  | "throne_debt_approved"
  | "throne_debt_changes_requested"
  | "throne_debt_payment_approved"
  | "throne_debt_payment_rejected"
  | "throne_debt_rejected"
  | "throne_debt_timeout_applied";

export type UserNotificationRecord = {
  body: string;
  created_at: string;
  id: string;
  kind: UserNotificationKind;
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  title: string;
};

type UserNotificationPayload = {
  body: string;
  kind: UserNotificationKind;
  metadata?: Record<string, unknown>;
  title: string;
  userId: string;
};

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

export async function createUserNotification(
  supabase: SupabaseAdminClient,
  payload: UserNotificationPayload,
) {
  const { error } = await supabase.from("user_notifications").insert({
    body: payload.body,
    kind: payload.kind,
    metadata: payload.metadata ?? {},
    title: payload.title,
    user_id: payload.userId,
  });

  if (error) {
    throw error;
  }
}
