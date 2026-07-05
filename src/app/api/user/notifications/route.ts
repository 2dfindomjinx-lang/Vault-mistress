import { createSupabaseAdminClient, getSupabaseAdminConfigErrors, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import type { UserNotificationRecord } from "@/lib/user-notifications";

type NotificationAction = "delete" | "markRead" | "markReadAll";

type NotificationBody = {
  action?: NotificationAction;
  notificationId?: string;
};

async function getCurrentUserId() {
  const authSupabase = await createSupabaseServerClient();
  const { data, error } = await authSupabase.auth.getUser();

  if (error || !data.user) {
    return { error: error?.message ?? "Authentication required.", userId: null };
  }

  return { error: null, userId: data.user.id };
}

async function listNotifications(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_notifications")
    .select("id, kind, title, body, metadata, read_at, created_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    throw error;
  }

  const notifications = ((data ?? []) as UserNotificationRecord[]).map((item) => ({
    ...item,
    metadata:
      item.metadata && typeof item.metadata === "object"
        ? (item.metadata as Record<string, unknown>)
        : null,
  }));

  return {
    notifications,
    unreadCount: notifications.filter((item) => !item.read_at).length,
  };
}

export async function GET() {
  if (!isSupabaseAdminConfigured) {
    return Response.json(
      { error: `Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}` },
      { status: 500 },
    );
  }

  const { error: authError, userId } = await getCurrentUserId();

  if (authError || !userId) {
    return Response.json({ error: authError ?? "Authentication required." }, { status: 401 });
  }

  try {
    return Response.json(await listNotifications(userId));
  } catch (error) {
    console.error("User notification list failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "Notification list failed." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return Response.json(
      { error: `Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}` },
      { status: 500 },
    );
  }

  const { error: authError, userId } = await getCurrentUserId();

  if (authError || !userId) {
    return Response.json({ error: authError ?? "Authentication required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as NotificationBody | null;
  const action = body?.action;
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  if (!action) {
    return Response.json({ error: "Missing notification action." }, { status: 400 });
  }

  if (action === "markReadAll") {
    const { error } = await supabase
      .from("user_notifications")
      .update({ read_at: now })
      .eq("user_id", userId)
      .is("deleted_at", null)
      .is("read_at", null);

    if (error) {
      console.error("User notification mark all read failed", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(await listNotifications(userId));
  }

  const notificationId = body?.notificationId?.trim();

  if (!notificationId) {
    return Response.json({ error: "Missing notification id." }, { status: 400 });
  }

  if (action === "markRead") {
    const { error } = await supabase
      .from("user_notifications")
      .update({ read_at: now })
      .eq("id", notificationId)
      .eq("user_id", userId)
      .is("deleted_at", null);

    if (error) {
      console.error("User notification mark read failed", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(await listNotifications(userId));
  }

  const { error } = await supabase
    .from("user_notifications")
    .update({ deleted_at: now })
    .eq("id", notificationId)
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (error) {
    console.error("User notification delete failed", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(await listNotifications(userId));
}
