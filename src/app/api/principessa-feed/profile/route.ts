import { isTrustedAdminUserId } from "@/lib/admin-identity";
import { listPrincipessaFeedPosts } from "@/lib/principessa-feed";
import { getPrincipessaFeedSignedUrlMap } from "@/lib/principessa-feed-media";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (!isSupabaseAdminConfigured) return Response.json({ error: "Supabase admin is not configured." }, { status: 500 });
  const userId = new URL(request.url).searchParams.get("userId")?.trim() ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return Response.json({ error: "Invalid profile id." }, { status: 400 });

  const authSupabase = await createSupabaseServerClient();
  const { data: authData } = await authSupabase.auth.getUser();
  const viewerId = authData.user?.id;
  const supabase = createSupabaseAdminClient();
  const [identityResult, feedProfileResult, posts] = await Promise.all([
    supabase.from("profiles").select("username, display_name").eq("id", userId).maybeSingle(),
    supabase.from("principessa_feed_profiles").select("avatar_path, header_path").eq("user_id", userId).maybeSingle(),
    listPrincipessaFeedPosts(supabase, {
      authorId: userId,
      channel: "all",
      status: "published",
      viewerId,
      viewerIsAdmin: isTrustedAdminUserId(viewerId),
    }),
  ]);
  if (identityResult.error) return Response.json({ error: identityResult.error.message }, { status: 500 });
  if (!identityResult.data) return Response.json({ error: "Profile not found." }, { status: 404 });

  const feedProfile = feedProfileResult.error ? null : feedProfileResult.data;
  const paths = [feedProfile?.avatar_path, feedProfile?.header_path].filter((path): path is string => Boolean(path));
  const signedMap = await getPrincipessaFeedSignedUrlMap(supabase, paths);
  return Response.json({
    posts,
    profile: {
      avatarUrl: feedProfile?.avatar_path ? signedMap.get(feedProfile.avatar_path) ?? null : null,
      displayName: identityResult.data.display_name?.trim() || identityResult.data.username,
      headerUrl: feedProfile?.header_path ? signedMap.get(feedProfile.header_path) ?? null : null,
      username: identityResult.data.username,
    },
  });
}
