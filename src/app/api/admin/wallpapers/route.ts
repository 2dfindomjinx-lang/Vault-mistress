import { requireAdminProfile } from "@/lib/admin-guard";
import { PRINCIPESSA_WALLPAPER_APP_KEY } from "@/lib/app-licenses";
import { prepareWallpaperUpload } from "@/lib/r2-wallpapers";
import {
  sendWallpaperLiveMessagePush,
  sendWallpaperSyncPush,
} from "@/lib/wallpaper-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  action?: "prepare-upload" | "assign" | "reuse" | "send-message" | "clear-message";
  activationId?: string | null;
  assignmentId?: string;
  contentType?: string;
  message?: string;
  objectKey?: string;
  version?: string;
  wallpaperUrl?: string;
};

async function loadWallpaperAdminState(supabase: SupabaseClient) {
  const [
    { data: devices, error: devicesError },
    { data: assignments, error: assignmentsError },
    { data: messages, error: messagesError },
    { data: events, error: eventsError },
    { data: history, error: historyError },
  ] = await Promise.all([
    supabase
      .from("app_activation_codes")
      .select(
        "id, activation_code, status, owner_name, bound_installation_id, bound_device_label, bound_at, last_validated_at, favorite_kink",
      )
      .eq("app_key", PRINCIPESSA_WALLPAPER_APP_KEY)
      .not("bound_installation_id", "is", null)
      .order("owner_name", { ascending: true }),
    supabase
      .from("wallpaper_assignments")
      .select("id, activation_id, scope, wallpaper_url, version, created_at")
      .eq("app_key", PRINCIPESSA_WALLPAPER_APP_KEY)
      .eq("active", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("wallpaper_live_messages")
      .select("id, activation_id, scope, message, version, sender_role, active, created_at")
      .eq("app_key", PRINCIPESSA_WALLPAPER_APP_KEY)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("wallpaper_device_events")
      .select("id, activation_id, event_type, changed_scopes, system_wallpaper_id, lock_wallpaper_id, created_at")
      .eq("app_key", PRINCIPESSA_WALLPAPER_APP_KEY)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("wallpaper_assignments")
      .select("id, object_key, wallpaper_url, version, created_at")
      .eq("app_key", PRINCIPESSA_WALLPAPER_APP_KEY)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  if (devicesError) throw devicesError;
  if (assignmentsError) throw assignmentsError;
  if (messagesError) throw messagesError;
  if (eventsError) throw eventsError;
  if (historyError) throw historyError;

  const library = Array.from(
    new Map((history ?? []).map((item) => [item.object_key, item])).values(),
  );

  return {
    devices: devices ?? [],
    assignments: assignments ?? [],
    messages: messages ?? [],
    events: events ?? [],
    library,
  };
}

async function validateTarget(supabase: SupabaseClient, activationId: string | null) {
  if (!activationId) return;
  const { data: target, error } = await supabase
    .from("app_activation_codes")
    .select("id")
    .eq("id", activationId)
    .eq("app_key", PRINCIPESSA_WALLPAPER_APP_KEY)
    .eq("status", "active")
    .not("bound_installation_id", "is", null)
    .maybeSingle();
  if (error) throw error;
  if (!target) throw new Error("Wallpaper target device was not found.");
}

export async function GET() {
  const admin = await requireAdminProfile();
  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  try {
    return Response.json(await loadWallpaperAdminState(admin.supabase));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Wallpaper admin state failed." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const admin = await requireAdminProfile();
  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  const body = (await request.json()) as Body;

  try {
    if (body.action === "prepare-upload") {
      return Response.json(await prepareWallpaperUpload(body.contentType?.trim() ?? ""));
    }

    if (body.action === "assign") {
      const activationId = body.activationId?.trim() || null;
      const objectKey = body.objectKey?.trim() ?? "";
      const wallpaperUrl = body.wallpaperUrl?.trim() ?? "";
      const version = body.version?.trim() ?? "";

      if (!objectKey || !wallpaperUrl || !version) {
        return Response.json({ error: "Missing uploaded wallpaper metadata." }, { status: 400 });
      }

      if (activationId) {
        await validateTarget(admin.supabase, activationId);
      }

      const { error } = await admin.supabase.rpc("assign_wallpaper", {
        p_app_key: PRINCIPESSA_WALLPAPER_APP_KEY,
        p_activation_id: activationId,
        p_object_key: objectKey,
        p_wallpaper_url: wallpaperUrl,
        p_version: version,
        p_created_by: admin.adminUser.id,
      });
      if (error) throw error;
      await sendWallpaperSyncPush({
        activationId,
        wallpaperVersion: version,
      });

      return Response.json({
        ok: true,
        ...(await loadWallpaperAdminState(admin.supabase)),
      });
    }

    if (body.action === "reuse") {
      const activationId = body.activationId?.trim() || null;
      const assignmentId = body.assignmentId?.trim() ?? "";
      if (!assignmentId) {
        return Response.json({ error: "Choose a wallpaper from the library." }, { status: 400 });
      }
      await validateTarget(admin.supabase, activationId);

      const { data: stored, error: storedError } = await admin.supabase
        .from("wallpaper_assignments")
        .select("object_key, wallpaper_url")
        .eq("id", assignmentId)
        .eq("app_key", PRINCIPESSA_WALLPAPER_APP_KEY)
        .maybeSingle();
      if (storedError) throw storedError;
      if (!stored) {
        return Response.json({ error: "Stored wallpaper was not found." }, { status: 404 });
      }

      const wallpaperVersion = randomUUID();
      const { error } = await admin.supabase.rpc("assign_wallpaper", {
        p_app_key: PRINCIPESSA_WALLPAPER_APP_KEY,
        p_activation_id: activationId,
        p_object_key: stored.object_key,
        p_wallpaper_url: stored.wallpaper_url,
        p_version: wallpaperVersion,
        p_created_by: admin.adminUser.id,
      });
      if (error) throw error;
      await sendWallpaperSyncPush({
        activationId,
        wallpaperVersion,
      });

      return Response.json({
        ok: true,
        ...(await loadWallpaperAdminState(admin.supabase)),
      });
    }

    if (body.action === "send-message") {
      const activationId = body.activationId?.trim() || null;
      const message = body.message?.trim() ?? "";
      if (!message || message.length > 240) {
        return Response.json({ error: "Live message must contain 1 to 240 characters." }, { status: 400 });
      }
      await validateTarget(admin.supabase, activationId);

      let deactivate = admin.supabase
        .from("wallpaper_live_messages")
        .update({ active: false })
        .eq("app_key", PRINCIPESSA_WALLPAPER_APP_KEY)
        .eq("active", true);
      deactivate = activationId
        ? deactivate.eq("activation_id", activationId)
        : deactivate.eq("scope", "global");
      const { error: deactivateError } = await deactivate;
      if (deactivateError) throw deactivateError;

      const messageVersion = randomUUID();
      const { error: insertError } = await admin.supabase
        .from("wallpaper_live_messages")
        .insert({
          app_key: PRINCIPESSA_WALLPAPER_APP_KEY,
          activation_id: activationId,
          scope: activationId ? "device" : "global",
          message,
          version: messageVersion,
          sender_role: "admin",
          active: true,
          created_by: admin.adminUser.id,
        });
      if (insertError) throw insertError;
      await sendWallpaperLiveMessagePush({
        activationId,
        messageVersion,
      });

      return Response.json({
        ok: true,
        ...(await loadWallpaperAdminState(admin.supabase)),
      });
    }

    if (body.action === "clear-message") {
      const activationId = body.activationId?.trim() || null;
      let clear = admin.supabase
        .from("wallpaper_live_messages")
        .update({ active: false })
        .eq("app_key", PRINCIPESSA_WALLPAPER_APP_KEY)
        .eq("active", true);
      clear = activationId
        ? clear.eq("activation_id", activationId)
        : clear.eq("scope", "global");
      const { error } = await clear;
      if (error) throw error;
      await sendWallpaperLiveMessagePush({
        activationId,
        messageVersion: `cleared-${randomUUID()}`,
      });

      return Response.json({
        ok: true,
        ...(await loadWallpaperAdminState(admin.supabase)),
      });
    }

    return Response.json({ error: "Invalid wallpaper action." }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Wallpaper action failed." },
      { status: 500 },
    );
  }
}
