import { markAdminMobileChatRead } from "@/lib/admin-mobile-push";
import { requireMobileAdmin } from "@/lib/mobile-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type MessageRow = {
  coin_cost: number | null;
  created_at: string;
  id: string;
  is_deleted: boolean | null;
  message: string;
  message_type: string | null;
  user_id: string;
};

async function listMessages(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("live_chat_messages")
    .select("id, user_id, message, created_at, is_deleted, message_type, coin_cost")
    .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false }).limit(75);
  if (error) throw error;
  const rows = ((data ?? []) as MessageRow[]).reverse();
  const userIds = Array.from(new Set(rows.map((row) => row.user_id)));
  const profiles = userIds.length > 0
    ? await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", userIds)
    : { data: [], error: null };
  if (profiles.error) throw profiles.error;
  const profileMap = new Map((profiles.data ?? []).map((profile) => [String(profile.id), profile]));
  return rows.map((row) => ({ ...row, profiles: profileMap.get(row.user_id) ?? null }));
}

export async function GET(request: Request) {
  const admin = await requireMobileAdmin(request);
  if ("error" in admin) return Response.json({ error: admin.error }, { status: admin.status });
  try {
    const messages = await listMessages(admin.supabase);
    await markAdminMobileChatRead(admin.adminUser.id);
    return Response.json({ messages });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Live Chat could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const admin = await requireMobileAdmin(request);
  if ("error" in admin) return Response.json({ error: admin.error }, { status: admin.status });
  const body = (await request.json().catch(() => null)) as { action?: "delete" | "read" | "send"; message?: string; messageId?: string } | null;
  try {
    if (body?.action === "read") {
      await markAdminMobileChatRead(admin.adminUser.id);
      return Response.json({ ok: true });
    }
    if (body?.action === "delete" && body.messageId) {
      const now = new Date().toISOString();
      const { error } = await admin.supabase.from("live_chat_messages").update({ deleted_at: now, deleted_by: admin.adminUser.id, is_deleted: true }).eq("id", body.messageId);
      if (error) throw error;
      return Response.json({ messages: await listMessages(admin.supabase) });
    }
    const message = String(body?.message ?? "").replace(/\s+/g, " ").trim().slice(0, 250);
    if (body?.action !== "send" || !message) return Response.json({ error: "Message cannot be empty." }, { status: 422 });
    const { error } = await admin.supabase.from("live_chat_messages").insert({ coin_cost: 0, message, message_type: "normal", user_id: admin.adminUser.id });
    if (error) throw error;
    await markAdminMobileChatRead(admin.adminUser.id);
    return Response.json({ messages: await listMessages(admin.supabase) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Live Chat action failed." }, { status: 500 });
  }
}
import type { SupabaseClient } from "@supabase/supabase-js";
