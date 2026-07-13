import { requireAdminProfile } from "@/lib/admin-guard";
import { listPrincipessaFeedPosts } from "@/lib/principessa-feed";

const BUCKET = "principessa-feed";

export async function GET() {
  const admin = await requireAdminProfile();
  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  return Response.json({
    posts: await listPrincipessaFeedPosts(admin.supabase, { channel: "sub", status: "pending", viewerId: admin.adminUser.id, viewerIsAdmin: true }),
  });
}

export async function POST(request: Request) {
  const admin = await requireAdminProfile();
  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  const body = (await request.json()) as { action?: "approve" | "reject"; postId?: string };
  const postId = String(body.postId ?? "").trim();
  if (!postId || (body.action !== "approve" && body.action !== "reject")) {
    return Response.json({ error: "Invalid moderation request." }, { status: 400 });
  }

  const { data: post, error: postError } = await admin.supabase
    .from("principessa_posts")
    .select("id")
    .eq("id", postId)
    .eq("channel", "sub")
    .eq("status", "pending")
    .maybeSingle();
  if (postError || !post) {
    return Response.json({ error: postError?.message ?? "Pending post not found." }, { status: postError ? 500 : 404 });
  }

  if (body.action === "approve") {
    const { error: approveError } = await admin.supabase
      .from("principessa_posts")
      .update({
        reviewed_at: new Date().toISOString(),
        reviewed_by: admin.adminUser.id,
        status: "published",
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId)
      .eq("status", "pending");
    if (approveError) {
      return Response.json({ error: approveError.message }, { status: 500 });
    }
  } else {
    const { data: images, error: imagesError } = await admin.supabase
      .from("principessa_post_images")
      .select("storage_path")
      .eq("post_id", postId);
    if (imagesError) {
      return Response.json({ error: imagesError.message }, { status: 500 });
    }

    const { error: rejectError } = await admin.supabase.from("principessa_posts").delete().eq("id", postId);
    if (rejectError) {
      return Response.json({ error: rejectError.message }, { status: 500 });
    }

    const paths = (images ?? []).map((image) => String(image.storage_path));
    if (paths.length > 0) {
      const { error: storageError } = await admin.supabase.storage.from(BUCKET).remove(paths);
      if (storageError) {
        console.error("Rejected sub post image cleanup failed", storageError);
      }
    }
  }

  return Response.json({
    pendingPosts: await listPrincipessaFeedPosts(admin.supabase, { channel: "sub", status: "pending", viewerId: admin.adminUser.id, viewerIsAdmin: true }),
    publishedPosts: await listPrincipessaFeedPosts(admin.supabase, { channel: "all", status: "published", viewerId: admin.adminUser.id, viewerIsAdmin: true }),
  });
}
