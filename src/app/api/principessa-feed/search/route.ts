import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { loadCommunityProfiles } from "@/lib/prestige-server";
import { isTrustedAdminUserId } from "@/lib/admin-identity";

export async function GET(request: Request) {
  if (!isSupabaseAdminConfigured) return Response.json({ error: "Supabase admin is not configured." }, { status: 500 });
  const query = (new URL(request.url).searchParams.get("q") ?? "").trim().toLocaleLowerCase();
  if (query.length < 2 || query.length > 80) return Response.json({ accounts: [], posts: [] });
  const usernameQuery = query.replace(/^@+/, "");

  const authSupabase = await createSupabaseServerClient();
  const { data: authData } = await authSupabase.auth.getUser();
  const supabase = createSupabaseAdminClient();
  const [{ data: postRows, error: postError }, usernameResult, displayNameResult] = await Promise.all([
    supabase.from("principessa_posts")
      .select("id, author_id, title, description, channel, post_type, created_at")
      .eq("status", "published").order("created_at", { ascending: false }).limit(250),
    supabase.from("profiles").select("id, username, display_name").ilike("username", `%${usernameQuery}%`).order("username").limit(12),
    supabase.from("profiles").select("id, username, display_name").ilike("display_name", `%${query}%`).order("display_name").limit(12),
  ]);
  if (postError || usernameResult.error || displayNameResult.error) return Response.json({ error: postError?.message ?? usernameResult.error?.message ?? displayNameResult.error?.message }, { status: 500 });

  const matchingPosts = (postRows ?? []).filter((post) => `${post.title}\n${post.description}`.toLocaleLowerCase().includes(query)).slice(0, 20);
  const accountRows = [...(usernameResult.data ?? []), ...(displayNameResult.data ?? [])];
  const matchingAccountIds = Array.from(new Set(accountRows.map((profile) => profile.id))).slice(0, 12);
  const profileIds = Array.from(new Set([...matchingAccountIds, ...matchingPosts.map((post) => post.author_id)]));
  const profiles = await loadCommunityProfiles(supabase, profileIds);

  return Response.json({
    accounts: matchingAccountIds.map((id) => profiles.get(id)).filter(Boolean),
    posts: matchingPosts.map((post) => {
      const hiddenConfession = post.post_type === "confession" && post.author_id !== authData.user?.id && !isTrustedAdminUserId(authData.user?.id);
      return {
        author: hiddenConfession ? null : profiles.get(post.author_id) ?? null,
        channel: post.channel,
        createdAt: post.created_at,
        description: post.description,
        id: post.id,
        postType: post.post_type,
        title: post.title,
      };
    }),
  });
}
