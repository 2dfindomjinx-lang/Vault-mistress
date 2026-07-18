import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { notifyPrincipessaFeedMentions } from "@/lib/principessa-feed-notifications";
import { createUserNotification } from "@/lib/user-notifications";

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) return Response.json({ error: "Supabase admin is not configured." }, { status: 500 });

  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();
  if (authError || !authData.user) return Response.json({ error: "Sign in to comment." }, { status: 401 });

  const body = (await request.json()) as { body?: string; parentCommentId?: string; postId?: string };
  const postId = String(body.postId ?? "").trim();
  const parentCommentId = String(body.parentCommentId ?? "").trim();
  const commentBody = String(body.body ?? "").trim();
  if (!postId || commentBody.length < 1 || commentBody.length > 500) return Response.json({ error: "Comment must be 1-500 characters." }, { status: 422 });

  const supabase = createSupabaseAdminClient();
  const { data: post, error: postError } = await supabase.from("principessa_posts").select("id, title, author_id").eq("id", postId).eq("status", "published").maybeSingle();
  if (postError || !post) return Response.json({ error: postError?.message ?? "Post not found." }, { status: postError ? 500 : 404 });

  let parentComment: { id: string; user_id: string } | null = null;
  if (parentCommentId) {
    const { data, error } = await supabase.from("principessa_post_comments").select("id, user_id").eq("id", parentCommentId).eq("post_id", postId).maybeSingle();
    if (error || !data) return Response.json({ error: error?.message ?? "Reply target not found." }, { status: error ? 500 : 404 });
    parentComment = data;
  }

  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count, error: rateError } = await supabase.from("principessa_post_comments").select("id", { count: "exact", head: true }).eq("user_id", authData.user.id).gte("created_at", oneMinuteAgo);
  if (rateError) return Response.json({ error: rateError.message }, { status: 500 });
  if ((count ?? 0) >= 5) return Response.json({ error: "Please wait before posting more comments." }, { status: 429 });

  const { data: insertedComment, error: insertError } = await supabase
    .from("principessa_post_comments")
    .insert({ body: commentBody, parent_comment_id: parentCommentId || null, post_id: postId, user_id: authData.user.id })
    .select("id, body, created_at, parent_comment_id")
    .single();
  if (insertError) return Response.json({ error: insertError.message }, { status: 500 });

  await notifyPrincipessaFeedMentions(supabase, { actorId: authData.user.id, postId, postTitle: post.title, text: commentBody })
    .catch((error) => console.error("Principessa feed comment mention notification failed", error));

  const { data: actor } = await supabase.from("profiles").select("display_name, username").eq("id", authData.user.id).maybeSingle();
  const actorName = actor?.display_name?.trim() || `@${String(actor?.username ?? "unknown").replace(/^@/, "")}`;
  const replyRecipientId = parentComment?.user_id ?? post.author_id;
  if (replyRecipientId !== authData.user.id) {
    await createUserNotification(supabase, {
      body: `${actorName} replied to "${post.title}".`,
      kind: "principessa_feed_reply",
      metadata: { commentId: insertedComment.id, postId, source: "principessa_feed" },
      title: parentComment ? "New reply to your comment" : "New reply to your post",
      userId: replyRecipientId,
    }).catch((error) => console.error("Principessa feed reply notification failed", error));
  }

  return Response.json({ comment: { body: insertedComment.body, createdAt: insertedComment.created_at, id: insertedComment.id, parentCommentId: insertedComment.parent_comment_id }, ok: true }, { status: 201 });
}
