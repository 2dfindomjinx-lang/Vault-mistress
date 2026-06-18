import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendAdminMobilePush } from "@/lib/admin-mobile-push";

export type PendingCoinCommand = "add" | "give";

export async function createPendingCoinAction(params: {
  requestedByUserId: string;
  command: PendingCoinCommand;
  targetUserId: string;
  targetUsername: string;
  amount: number;
  originalCommand?: string;
}) {
  const supabase = createSupabaseAdminClient();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("pending_admin_actions")
    .insert({
      action_type: "coin_grant",
      command: params.command,
      requested_by_user_id: params.requestedByUserId,
      target_user_id: params.targetUserId,
      target_username_snapshot: params.targetUsername,
      amount: params.amount,
      reason: params.command === "give" ? "throne_tribute" : "admin_add",
      metadata: {
        originalCommand: params.originalCommand ?? `/${params.command} ${params.amount} @${params.targetUsername}`,
        requestedAt: nowIso,
      },
      status: "pending",
      expires_at: expiresAt,
    })
    .select("id, command, amount, target_username_snapshot, expires_at")
    .single();

  if (error) {
    console.error("Failed to create pending admin action", error);
    throw error;
  }

  // Notify companion app immediately
  await sendAdminMobilePush({
    title: "Pending Vault Action",
    body: `/${params.command} ${params.amount} @${params.targetUsername} — approve in Companion App`,
    type: "admin",
    important: true,
  }).catch((e) => console.warn("Pending push failed (non-fatal)", e));

  return data;
}
