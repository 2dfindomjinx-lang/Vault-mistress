import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { isTrustedAdminUserId } from "@/lib/admin-identity";

export const maxDuration = 300;

type DeletionRow = {
  inactive_since: string;
  tribute_total: number;
  user_id: string;
  username: string;
};

type StorageObject = { bucket: string; path: string };

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  return Boolean(cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`);
}

function parseSupabaseStorageUrl(value: unknown): StorageObject | null {
  if (typeof value !== "string" || !value.startsWith("http")) return null;
  try {
    const url = new URL(value);
    const configuredHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host : "";
    if (!configuredHost || url.host !== configuredHost) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    const objectIndex = parts.findIndex((part) => part === "object");
    if (objectIndex < 0) return null;
    const visibility = parts[objectIndex + 1];
    const bucketIndex = visibility === "public" || visibility === "sign" || visibility === "authenticated" ? objectIndex + 2 : objectIndex + 1;
    const bucket = parts[bucketIndex];
    const path = parts.slice(bucketIndex + 1).map(decodeURIComponent).join("/");
    return bucket && path ? { bucket, path } : null;
  } catch { return null; }
}

async function getUserStorageObjects(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
) {
  const [profileResult, feedProfileResult, postsResult, debtResult, debtImageResult] = await Promise.all([
    supabase.from("profiles").select("avatar_url").eq("id", userId).maybeSingle(),
    supabase.from("principessa_feed_profiles").select("avatar_path, header_path").eq("user_id", userId).maybeSingle(),
    supabase.from("principessa_posts").select("id").eq("author_id", userId),
    supabase.from("pet_debt_contracts").select("image_urls").eq("user_id", userId),
    supabase.from("evil_debt_contract_images").select("image_url").eq("user_id", userId),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (feedProfileResult.error) console.warn("Feed profile storage lookup skipped", feedProfileResult.error.message);
  if (postsResult.error) throw postsResult.error;
  if (debtResult.error) throw debtResult.error;
  if (debtImageResult.error) throw debtImageResult.error;
  const postIds = (postsResult.data ?? []).map((post) => String(post.id));
  const imageResult = postIds.length > 0
    ? await supabase.from("principessa_post_images").select("storage_path").in("post_id", postIds)
    : { data: [], error: null };
  if (imageResult.error) throw imageResult.error;

  const objects: StorageObject[] = [
    feedProfileResult.data?.avatar_path ? { bucket: "principessa-feed", path: feedProfileResult.data.avatar_path } : null,
    feedProfileResult.data?.header_path ? { bucket: "principessa-feed", path: feedProfileResult.data.header_path } : null,
    ...(imageResult.data ?? []).map((image) => image.storage_path ? { bucket: "principessa-feed", path: image.storage_path } : null),
    parseSupabaseStorageUrl(profileResult.data?.avatar_url),
    ...(debtImageResult.data ?? []).map((image) => parseSupabaseStorageUrl(image.image_url)),
    ...(debtResult.data ?? []).flatMap((debt) => Array.isArray(debt.image_urls) ? debt.image_urls.map(parseSupabaseStorageUrl) : []),
  ].filter((item): item is StorageObject => Boolean(item));
  return Array.from(new Map(objects.map((item) => [`${item.bucket}:${item.path}`, item])).values());
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return Response.json({ error: "Unauthorized cron request." }, { status: 401 });
  if (!isSupabaseAdminConfigured) return Response.json({ error: "Supabase admin is not configured." }, { status: 500 });

  const supabase = createSupabaseAdminClient();
  const { data: retention, error: retentionError } = await supabase.rpc("run_data_retention");
  if (retentionError) return Response.json({ error: retentionError.message }, { status: 500 });

  const { data: deletionRows, error: deletionError } = await supabase.rpc("get_inactive_user_deletion_batch", { p_limit: 50 });
  if (deletionError) return Response.json({ error: deletionError.message, retention }, { status: 500 });

  const deleted: Array<{ userId: string; username: string }> = [];
  const failed: Array<{ error: string; userId: string; username: string }> = [];
  const skipped: Array<{ reason: string; userId: string; username: string }> = [];

  for (const row of (deletionRows ?? []) as DeletionRow[]) {
    if (isTrustedAdminUserId(row.user_id)) {
      skipped.push({ reason: "trusted_admin", userId: row.user_id, username: row.username });
      continue;
    }
    let storageObjects: StorageObject[] = [];
    try {
      storageObjects = await getUserStorageObjects(supabase, row.user_id);
      const { error: archiveError } = await supabase.rpc("archive_inactive_user_data", {
        p_storage_paths: storageObjects,
        p_user_id: row.user_id,
      });
      if (archiveError) throw archiveError;

      const { data: stillEligible, error: eligibilityError } = await supabase.rpc("is_inactive_user_deletion_eligible", { p_user_id: row.user_id });
      if (eligibilityError) throw eligibilityError;
      if (!stillEligible) {
        await supabase.from("deleted_user_financial_archive").update({ deletion_status: "skipped_policy_change" }).eq("deleted_user_id", row.user_id);
        skipped.push({ reason: "policy_changed", userId: row.user_id, username: row.username });
        continue;
      }

      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(row.user_id);
      if (authDeleteError) throw authDeleteError;

      let storageErrorMessage: string | null = null;
      const objectsByBucket = new Map<string, string[]>();
      for (const object of storageObjects) objectsByBucket.set(object.bucket, [...(objectsByBucket.get(object.bucket) ?? []), object.path]);
      for (const [bucket, paths] of objectsByBucket) {
        const { error: storageError } = await supabase.storage.from(bucket).remove(paths);
        if (storageError) storageErrorMessage = [storageErrorMessage, `${bucket}: ${storageError.message}`].filter(Boolean).join("; ");
      }

      await supabase.from("deleted_user_financial_archive").update({
        deleted_at: new Date().toISOString(),
        deletion_error: storageErrorMessage,
        deletion_status: storageErrorMessage ? "deleted_with_storage_error" : "deleted",
      }).eq("deleted_user_id", row.user_id);
      deleted.push({ userId: row.user_id, username: row.username });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown deletion error";
      await supabase.rpc("mark_inactive_user_deletion_result", { p_error: message, p_success: false, p_user_id: row.user_id });
      failed.push({ error: message, userId: row.user_id, username: row.username });
    }
  }

  await supabase.from("data_retention_audit").insert({
    details: { deleted, failed, skipped, policy: { protectedReasons: ["throne_tribute", "live_gift"], standardDays: 30, tribute5000Days: 90 } },
    run_type: "inactive_user_deletion",
  });

  return Response.json({ deleted, failed, retention, skipped });
}
