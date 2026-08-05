import { PRINCIPESSA_WALLPAPER_APP_KEY } from "@/lib/app-licenses";
import { prepareWallpaperUpload } from "@/lib/r2-wallpapers";
import { sendWallpaperLiveMessagePush, sendWallpaperSyncPush } from "@/lib/wallpaper-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

/**
 * Shared wallpaper admin logic. The browser panel (/api/admin/wallpapers, cookie session)
 * and the companion app (/api/admin/mobile/wallpapers, bearer JWT) authenticate differently
 * but drive exactly the same actions, so everything below is auth-agnostic.
 */

export type WallpaperAdminAction =
  | "prepare-upload"
  | "assign"
  | "reuse"
  | "reset-to-default"
  | "send-message"
  | "clear-message";

export type WallpaperAdminBody = {
  action?: WallpaperAdminAction;
  activationId?: string | null;
  assignmentId?: string;
  contentType?: string;
  message?: string;
  objectKey?: string;
  version?: string;
  wallpaperUrl?: string;
};

export type WallpaperActionResult =
  | { kind: "state" }
  | { kind: "payload"; payload: Record<string, unknown> }
  | { kind: "error"; error: string; status: number };

export async function loadWallpaperAdminState(supabase: SupabaseClient) {
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

/**
 * Runs one wallpaper admin action. Returns `{ kind: "state" }` when the caller should
 * answer with the refreshed panel state, which is what every mutating action does.
 */
export async function runWallpaperAdminAction(
  supabase: SupabaseClient,
  adminUserId: string,
  body: WallpaperAdminBody,
): Promise<WallpaperActionResult> {
  if (body.action === "prepare-upload") {
    return { kind: "payload", payload: await prepareWallpaperUpload(body.contentType?.trim() ?? "") };
  }

  if (body.action === "assign") {
    const activationId = body.activationId?.trim() || null;
    const objectKey = body.objectKey?.trim() ?? "";
    const wallpaperUrl = body.wallpaperUrl?.trim() ?? "";
    const version = body.version?.trim() ?? "";

    if (!objectKey || !wallpaperUrl || !version) {
      return { kind: "error", error: "Missing uploaded wallpaper metadata.", status: 400 };
    }

    if (activationId) {
      await validateTarget(supabase, activationId);
    }

    const { error } = await supabase.rpc("assign_wallpaper", {
      p_app_key: PRINCIPESSA_WALLPAPER_APP_KEY,
      p_activation_id: activationId,
      p_object_key: objectKey,
      p_wallpaper_url: wallpaperUrl,
      p_version: version,
      p_created_by: adminUserId,
    });
    if (error) throw error;
    await sendWallpaperSyncPush({ activationId, wallpaperVersion: version });

    return { kind: "state" };
  }

  if (body.action === "reuse") {
    const activationId = body.activationId?.trim() || null;
    const assignmentId = body.assignmentId?.trim() ?? "";
    if (!assignmentId) {
      return { kind: "error", error: "Choose a wallpaper from the library.", status: 400 };
    }
    await validateTarget(supabase, activationId);

    const { data: stored, error: storedError } = await supabase
      .from("wallpaper_assignments")
      .select("object_key, wallpaper_url")
      .eq("id", assignmentId)
      .eq("app_key", PRINCIPESSA_WALLPAPER_APP_KEY)
      .maybeSingle();
    if (storedError) throw storedError;
    if (!stored) {
      return { kind: "error", error: "Stored wallpaper was not found.", status: 404 };
    }

    const wallpaperVersion = randomUUID();
    const { error } = await supabase.rpc("assign_wallpaper", {
      p_app_key: PRINCIPESSA_WALLPAPER_APP_KEY,
      p_activation_id: activationId,
      p_object_key: stored.object_key,
      p_wallpaper_url: stored.wallpaper_url,
      p_version: wallpaperVersion,
      p_created_by: adminUserId,
    });
    if (error) throw error;
    await sendWallpaperSyncPush({ activationId, wallpaperVersion });

    return { kind: "state" };
  }

  if (body.action === "reset-to-default") {
    const activationId = body.activationId?.trim() || null;
    if (!activationId) {
      return { kind: "error", error: "Select a device first - global has no default to reset to.", status: 400 };
    }
    await validateTarget(supabase, activationId);

    const { error } = await supabase
      .from("wallpaper_assignments")
      .update({ active: false })
      .eq("app_key", PRINCIPESSA_WALLPAPER_APP_KEY)
      .eq("activation_id", activationId)
      .eq("scope", "device")
      .eq("active", true);
    if (error) throw error;

    const { data: globalAssignment, error: globalError } = await supabase
      .from("wallpaper_assignments")
      .select("version")
      .eq("app_key", PRINCIPESSA_WALLPAPER_APP_KEY)
      .eq("scope", "global")
      .eq("active", true)
      .maybeSingle();
    if (globalError) throw globalError;

    await sendWallpaperSyncPush({
      activationId,
      wallpaperVersion: globalAssignment?.version ?? `no-wallpaper-${randomUUID()}`,
    });

    return { kind: "state" };
  }

  if (body.action === "send-message") {
    const activationId = body.activationId?.trim() || null;
    const message = body.message?.trim() ?? "";
    if (!message || message.length > 240) {
      return { kind: "error", error: "Live message must contain 1 to 240 characters.", status: 400 };
    }
    await validateTarget(supabase, activationId);

    let deactivate = supabase
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
    const { error: insertError } = await supabase
      .from("wallpaper_live_messages")
      .insert({
        app_key: PRINCIPESSA_WALLPAPER_APP_KEY,
        activation_id: activationId,
        scope: activationId ? "device" : "global",
        message,
        version: messageVersion,
        sender_role: "admin",
        active: true,
        created_by: adminUserId,
      });
    if (insertError) throw insertError;
    await sendWallpaperLiveMessagePush({ activationId, messageVersion });

    return { kind: "state" };
  }

  if (body.action === "clear-message") {
    const activationId = body.activationId?.trim() || null;
    let clear = supabase
      .from("wallpaper_live_messages")
      .update({ active: false })
      .eq("app_key", PRINCIPESSA_WALLPAPER_APP_KEY)
      .eq("active", true);
    clear = activationId
      ? clear.eq("activation_id", activationId)
      : clear.eq("scope", "global");
    const { error } = await clear;
    if (error) throw error;
    await sendWallpaperLiveMessagePush({ activationId, messageVersion: `cleared-${randomUUID()}` });

    return { kind: "state" };
  }

  return { kind: "error", error: "Invalid wallpaper action.", status: 400 };
}
