import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return Response.json({ error: "Supabase admin is not configured." }, { status: 500 });
  }

  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();
  if (authError || !authData.user) {
    return Response.json({ error: "Sign in to comment." }, { status: 401 });
  }

  const body = (await request.json()) as { body?: string; postId?: string };
  const postId = String(body.postId ?? "").trim();
  const commentBody = String(body.body ?? "").trim();
  if (!postId || commentBody.length < 1 || commentBody.length > 500) {
    return Response.json({ error: "Comment must be 1-500 characters." }, { status: 422 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: post, error: postError } = await supabase
    .from("principessa_posts")
    .select("id")
    .eq("id", postId)
    .eq("status", "published")
    .maybeSingle();
  if (postError || !post) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }

  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count, error: rateError } = await supabase
    .from("principessa_post_comments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", authData.user.id)
    .gte("created_at", oneMinuteAgo);
  if (rateError) {
    return Response.json({ error: rateError.message }, { status: 500 });
  }
  if ((count ?? 0) >= 5) {
    return Response.json({ error: "Please wait before posting more comments." }, { status: 429 });
  }

  const { error: insertError } = await supabase.from("principessa_post_comments").insert({
    body: commentBody,
    post_id: postId,
    user_id: authData.user.id,
  });
  if (insertError) {
    console.error("Principessa feed comment insert failed", insertError);
    return Response.json({ error: insertError.message }, { status: 500 });
  }

  return Response.json({ ok: true }, { status: 201 });
}
