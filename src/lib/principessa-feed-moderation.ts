import type { SupabaseClient } from "@supabase/supabase-js";
import { listPrincipessaFeedPosts } from "@/lib/principessa-feed";

const BUCKET = "principessa-feed";

export async function listPendingPrincipessaPosts(supabase: SupabaseClient, adminUserId: string) {
  return listPrincipessaFeedPosts(supabase, { channel: "sub", status: "pending", viewerId: adminUserId, viewerIsAdmin: true });
}

export async function moderatePrincipessaPost(supabase: SupabaseClient, adminUserId: string, postId: string, action: "approve" | "reject") {
  const { data: post, error: postError } = await supabase
    .from("principessa_posts")
    .select("id")
    .eq("id", postId)
    .eq("channel", "sub")
    .eq("status", "pending")
    .maybeSingle();
  if (postError) throw postError;
  if (!post) throw new Error("Pending post not found.");

  if (action === "approve") {
    const { error } = await supabase.from("principessa_posts").update({
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminUserId,
      status: "published",
      updated_at: new Date().toISOString(),
    }).eq("id", postId).eq("status", "pending");
    if (error) throw error;
  } else {
    const { data: images, error: imagesError } = await supabase.from("principessa_post_images").select("storage_path").eq("post_id", postId);
    if (imagesError) throw imagesError;
    const { error } = await supabase.from("principessa_posts").delete().eq("id", postId).eq("status", "pending");
    if (error) throw error;
    const paths = (images ?? []).map((image) => String(image.storage_path));
    if (paths.length > 0) {
      const { error: storageError } = await supabase.storage.from(BUCKET).remove(paths);
      if (storageError) console.error("Rejected Sub post image cleanup failed", storageError);
    }
  }

  return {
    pendingPosts: await listPendingPrincipessaPosts(supabase, adminUserId),
    publishedPosts: await listPrincipessaFeedPosts(supabase, { channel: "all", status: "published", viewerId: adminUserId, viewerIsAdmin: true }),
  };
}
