import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type UserNotificationKind =
  | "debt_evil_approved"
  | "irl_task_approved"
  | "irl_task_excused"
  | "irl_task_failed"
  | "pet_task_approved"
  | "pet_task_rejected";

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
