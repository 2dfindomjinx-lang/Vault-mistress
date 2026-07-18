import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { isTrustedAdminUserId } from "@/lib/admin-identity";
import { createUserNotification } from "@/lib/user-notifications";

type Interaction = "like" | "repost";

const TABLES: Record<Interaction, string> = {
  like: "principessa_post_likes",
  repost: "principessa_post_reposts",
};

export async function POST(request: Request) {
  try {
    if (!isSupabaseAdminConfigured) return Response.json({ error: "Supabase admin is not configured." }, { status: 500 });

    const authSupabase = await createSupabaseServerClient();
    const { data: authData, error: authError } = await authSupabase.auth.getUser();
    if (authError || !authData.user) return Response.json({ error: "Sign in to interact with posts." }, { status: 401 });

    const body = (await request.json()) as { action?: Interaction; postId?: string };
    const action = body.action;
    const postId = String(body.postId ?? "").trim();
    if (!postId || (action !== "like" && action !== "repost")) return Response.json({ error: "Invalid feed interaction." }, { status: 400 });

    const supabase = createSupabaseAdminClient();
    const [{ data: post, error: postError }, { data: actorProfile, error: actorError }] = await Promise.all([
      supabase.from("principessa_posts").select("id, author_id, title").eq("id", postId).eq("status", "published").maybeSingle(),
      supabase.from("profiles").select("display_name, username").eq("id", authData.user.id).maybeSingle(),
    ]);
    if (postError || !post) return Response.json({ error: postError?.message ?? "Post not found." }, { status: postError ? 500 : 404 });
    if (actorError) return Response.json({ error: actorError.message }, { status: 500 });
    const actorName = actorProfile?.display_name?.trim() || `@${String(actorProfile?.username ?? "unknown").replace(/^@/, "")}`;

    const table = TABLES[action];
    const { data: existing, error: existingError } = await supabase.from(table).select("post_id").eq("post_id", postId).eq("user_id", authData.user.id).maybeSingle();
    if (existingError) return Response.json({ error: existingError.message }, { status: 500 });

    const { error: mutationError } = existing
      ? await supabase.from(table).delete().eq("post_id", postId).eq("user_id", authData.user.id)
      : await supabase.from(table).insert({ post_id: postId, user_id: authData.user.id });
    if (mutationError) return Response.json({ error: mutationError.message }, { status: 500 });

    const { count, error: countError } = await supabase.from(table).select("post_id", { count: "exact", head: true }).eq("post_id", postId);
    if (countError) return Response.json({ error: countError.message }, { status: 500 });

    let likedByAdmin: boolean | undefined;
    if (action === "like") {
      const { data: likeRows, error: likesError } = await supabase.from("principessa_post_likes").select("user_id").eq("post_id", postId);
      if (likesError) return Response.json({ error: likesError.message }, { status: 500 });
      likedByAdmin = (likeRows ?? []).some((like) => isTrustedAdminUserId(like.user_id));
    }

    if (!existing && post.author_id !== authData.user.id) {
      const adminLike = action === "like" && isTrustedAdminUserId(authData.user.id);
      await createUserNotification(supabase, {
        body: adminLike ? `Principessa liked "${post.title}".` : `${actorName} ${action === "like" ? "liked" : "reposted"} "${post.title}".`,
        kind: adminLike ? "principessa_feed_admin_like" : action === "like" ? "principessa_feed_like" : "principessa_feed_repost",
        metadata: { postId, source: "principessa_feed" },
        title: adminLike ? "Principessa noticed your post" : action === "like" ? "New like" : "New repost",
        userId: post.author_id,
      }).catch((error) => console.error("Principessa feed interaction notification failed", error));
    }

    return Response.json({ active: !existing, action, count: count ?? 0, likedByAdmin, postId });
  } catch (error) {
    console.error("Principessa feed interaction failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "Interaction failed." }, { status: 500 });
  }
}
