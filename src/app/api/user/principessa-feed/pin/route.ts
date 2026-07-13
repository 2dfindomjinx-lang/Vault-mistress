import { listPrincipessaFeedPosts } from "@/lib/principessa-feed";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) return Response.json({ error: "Supabase admin is not configured." }, { status: 500 });
  const authSupabase = await createSupabaseServerClient(); const { data: authData } = await authSupabase.auth.getUser();
  if (!authData.user) return Response.json({ error: "Sign in to pin a post." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { postId?: string } | null; const postId = String(body?.postId ?? "").trim();
  if (!postId) return Response.json({ error: "Missing post id." }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  const { data: post, error: postError } = await supabase.from("principessa_posts").select("id, pinned_at").eq("id", postId).eq("author_id", authData.user.id).maybeSingle();
  if (postError || !post) return Response.json({ error: postError?.message ?? "Post not found." }, { status: postError ? 500 : 404 });
  const pinned = !post.pinned_at; const now = new Date().toISOString();
  if (pinned) await supabase.from("principessa_posts").update({ pinned_at: null, pinned_by: null }).eq("author_id", authData.user.id).neq("id", postId);
  const { error } = await supabase.from("principessa_posts").update({ pinned_at: pinned ? now : null, pinned_by: pinned ? authData.user.id : null, updated_at: now }).eq("id", postId).eq("author_id", authData.user.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ pinned, posts: await listPrincipessaFeedPosts(supabase, { authorId: authData.user.id, channel: "all", status: "all", viewerId: authData.user.id }) });
}
