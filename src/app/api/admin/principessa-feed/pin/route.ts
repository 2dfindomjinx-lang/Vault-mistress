import { requireAdminProfile } from "@/lib/admin-guard";
import { listPrincipessaFeedPosts } from "@/lib/principessa-feed";

export async function POST(request: Request) {
  const admin = await requireAdminProfile();
  if ("error" in admin) return Response.json({ error: admin.error }, { status: admin.status });
  const body = (await request.json().catch(() => null)) as { postId?: string } | null;
  const postId = String(body?.postId ?? "").trim();
  if (!postId) return Response.json({ error: "Missing post id." }, { status: 400 });

  const { data: post, error: postError } = await admin.supabase
    .from("principessa_posts")
    .select("id, channel, pinned_at")
    .eq("id", postId)
    .eq("status", "published")
    .maybeSingle();
  if (postError || !post) return Response.json({ error: postError?.message ?? "Post not found." }, { status: postError ? 500 : 404 });

  const pinned = !post.pinned_at;
  const { error } = await admin.supabase.from("principessa_posts").update({
    pinned_at: pinned ? new Date().toISOString() : null,
    pinned_by: pinned ? admin.adminUser.id : null,
    updated_at: new Date().toISOString(),
  }).eq("id", postId);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({
    pinned,
    posts: await listPrincipessaFeedPosts(admin.supabase, {
      channel: post.channel === "sub" ? "sub" : "principessa",
      viewerId: admin.adminUser.id,
      viewerIsAdmin: true,
    }),
  });
}
