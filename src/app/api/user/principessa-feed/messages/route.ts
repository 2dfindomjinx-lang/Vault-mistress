import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { loadCommunityProfiles } from "@/lib/prestige-server";
import { createUserNotification } from "@/lib/user-notifications";

async function requireUser() {
  if (!isSupabaseAdminConfigured) return { error: "Supabase admin is not configured.", status: 500 } as const;
  const authSupabase = await createSupabaseServerClient();
  const { data } = await authSupabase.auth.getUser();
  if (!data.user) return { error: "Sign in to use Direct Messages.", status: 401 } as const;
  return { supabase: createSupabaseAdminClient(), user: data.user } as const;
}

async function listMessages(supabase: ReturnType<typeof createSupabaseAdminClient>, userId: string) {
  const { data, error } = await supabase.from("principessa_direct_messages")
    .select("id, sender_id, recipient_id, body, read_at, sender_deleted_at, recipient_deleted_at, created_at")
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("created_at", { ascending: true }).limit(500);
  if (error) throw error;
  const rows = (data ?? []).filter((message) => message.sender_id === userId ? !message.sender_deleted_at : !message.recipient_deleted_at);
  const otherIds = Array.from(new Set(rows.map((message) => message.sender_id === userId ? message.recipient_id : message.sender_id)));
  const profiles = await loadCommunityProfiles(supabase, otherIds);
  const unreadIds = rows.filter((message) => message.recipient_id === userId && !message.read_at).map((message) => message.id);
  if (unreadIds.length > 0) await supabase.from("principessa_direct_messages").update({ read_at: new Date().toISOString() }).in("id", unreadIds).eq("recipient_id", userId);
  return rows.map((message) => {
    const otherId = message.sender_id === userId ? message.recipient_id : message.sender_id;
    return {
      body: message.body,
      createdAt: message.created_at,
      id: message.id,
      mine: message.sender_id === userId,
      other: profiles.get(otherId) ?? null,
      otherId,
      readAt: message.read_at,
    };
  });
}

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  try { return Response.json({ messages: await listMessages(auth.supabase, auth.user.id) }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Messages could not be loaded." }, { status: 500 }); }
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  const body = (await request.json().catch(() => null)) as { body?: string; recipientId?: string } | null;
  const messageBody = String(body?.body ?? "").trim();
  const recipientId = String(body?.recipientId ?? "").trim();
  if (!recipientId || recipientId === auth.user.id || messageBody.length < 1 || messageBody.length > 2000) return Response.json({ error: "Choose a recipient and enter a 1-2000 character message." }, { status: 422 });
  const { data: recipient, error: recipientError } = await auth.supabase.from("profiles").select("id").eq("id", recipientId).maybeSingle();
  if (recipientError || !recipient) return Response.json({ error: recipientError?.message ?? "Recipient not found." }, { status: recipientError ? 500 : 404 });
  const { error } = await auth.supabase.from("principessa_direct_messages").insert({ body: messageBody, recipient_id: recipientId, sender_id: auth.user.id });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  await createUserNotification(auth.supabase, {
    body: "You received a new private message in Principessa Feed.", kind: "principessa_feed_dm",
    metadata: { senderId: auth.user.id, source: "principessa_feed" }, title: "New Direct Message", userId: recipientId,
  }).catch((notificationError) => console.error("DM notification failed", notificationError));
  return Response.json({ messages: await listMessages(auth.supabase, auth.user.id) }, { status: 201 });
}
