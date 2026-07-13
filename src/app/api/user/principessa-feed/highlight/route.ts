import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

const HIGHLIGHT_COST = 2000;
const HIGHLIGHT_DURATION_MS = 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) return Response.json({ error: "Supabase admin is not configured." }, { status: 500 });
  const authSupabase = await createSupabaseServerClient();
  const { data: authData } = await authSupabase.auth.getUser();
  if (!authData.user) return Response.json({ error: "Sign in to highlight a post." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { postId?: string } | null;
  const postId = String(body?.postId ?? "").trim();
  if (!postId) return Response.json({ error: "Missing post id." }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const [{ data: post, error: postError }, { data: profile, error: profileError }] = await Promise.all([
    supabase.from("principessa_posts").select("id, title, author_id, highlighted_until").eq("id", postId).eq("status", "published").maybeSingle(),
    supabase.from("profiles").select("coins").eq("id", authData.user.id).maybeSingle(),
  ]);
  if (postError || !post || post.author_id !== authData.user.id) return Response.json({ error: "You can only highlight your own published post." }, { status: 403 });
  if (profileError || !profile) return Response.json({ error: profileError?.message ?? "Profile not found." }, { status: profileError ? 500 : 404 });
  if (new Date(post.highlighted_until ?? 0).getTime() > Date.now()) return Response.json({ error: "This post is already highlighted." }, { status: 409 });
  const previousCoins = Number(profile.coins ?? 0);
  if (previousCoins < HIGHLIGHT_COST) return Response.json({ error: `You need ${HIGHLIGHT_COST} LP to highlight a post.` }, { status: 422 });
  const nextCoins = previousCoins - HIGHLIGHT_COST;
  const highlightedUntil = new Date(Date.now() + HIGHLIGHT_DURATION_MS).toISOString();

  const { data: updatedProfile, error: spendError } = await supabase.from("profiles")
    .update({ coins: nextCoins, updated_at: new Date().toISOString() })
    .eq("id", authData.user.id).eq("coins", previousCoins).select("id").maybeSingle();
  if (spendError || !updatedProfile) return Response.json({ error: "Your LP balance changed. Please try again." }, { status: 409 });

  const { error: postUpdateError } = await supabase.from("principessa_posts").update({
    highlighted_by: authData.user.id,
    highlighted_until: highlightedUntil,
    updated_at: new Date().toISOString(),
  }).eq("id", postId).eq("author_id", authData.user.id);
  if (postUpdateError) {
    await supabase.from("profiles").update({ coins: previousCoins }).eq("id", authData.user.id).eq("coins", nextCoins);
    return Response.json({ error: postUpdateError.message }, { status: 500 });
  }

  const { error: ledgerError } = await supabase.from("coin_transactions").insert({
    amount: -HIGHLIGHT_COST,
    balance_after: nextCoins,
    balance_before: previousCoins,
    metadata: { highlightedUntil, postId, spendAmount: HIGHLIGHT_COST },
    reason: "spend:principessa-feed-highlight",
    user_id: authData.user.id,
  });
  if (ledgerError) {
    await supabase.from("principessa_posts").update({ highlighted_by: null, highlighted_until: null }).eq("id", postId).eq("highlighted_until", highlightedUntil);
    await supabase.from("profiles").update({ coins: previousCoins }).eq("id", authData.user.id).eq("coins", nextCoins);
    return Response.json({ error: "Highlight spending could not be logged." }, { status: 500 });
  }

  return Response.json({ coins: nextCoins, cost: HIGHLIGHT_COST, highlightedUntil, postId });
}
