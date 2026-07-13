import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

const FEED_KINDS = [
  "principessa_feed_admin_like",
  "principessa_feed_like",
  "principessa_feed_mention",
  "principessa_feed_reply",
  "principessa_feed_repost",
  "principessa_feed_dm",
];

async function requireUser() {
  if (!isSupabaseAdminConfigured) return { error: "Supabase admin is not configured.", status: 500 } as const;
  const authSupabase = await createSupabaseServerClient();
  const { data } = await authSupabase.auth.getUser();
  if (!data.user) return { error: "Sign in to view Feed notifications.", status: 401 } as const;
  return { supabase: createSupabaseAdminClient(), userId: data.user.id } as const;
}

async function listNotifications(supabase: ReturnType<typeof createSupabaseAdminClient>, userId: string) {
  const { data, error } = await supabase.from("user_notifications")
    .select("id, kind, title, body, metadata, read_at, created_at")
    .eq("user_id", userId).in("kind", FEED_KINDS).is("deleted_at", null)
    .order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  return { notifications: data ?? [], unreadCount: (data ?? []).filter((item) => !item.read_at).length };
}

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  try { return Response.json(await listNotifications(auth.supabase, auth.userId)); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Feed notifications could not be loaded." }, { status: 500 }); }
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  const body = (await request.json().catch(() => null)) as { action?: "delete" | "markRead" | "markReadAll"; notificationId?: string } | null;
  const now = new Date().toISOString();
  if (body?.action === "markReadAll") {
    const { error } = await auth.supabase.from("user_notifications").update({ read_at: now })
      .eq("user_id", auth.userId).in("kind", FEED_KINDS).is("deleted_at", null).is("read_at", null);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json(await listNotifications(auth.supabase, auth.userId));
  }
  const notificationId = String(body?.notificationId ?? "").trim();
  if (!notificationId || (body?.action !== "markRead" && body?.action !== "delete")) return Response.json({ error: "Invalid notification action." }, { status: 400 });
  const update = body.action === "markRead" ? { read_at: now } : { deleted_at: now };
  const { error } = await auth.supabase.from("user_notifications").update(update)
    .eq("id", notificationId).eq("user_id", auth.userId).in("kind", FEED_KINDS).is("deleted_at", null);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(await listNotifications(auth.supabase, auth.userId));
}
