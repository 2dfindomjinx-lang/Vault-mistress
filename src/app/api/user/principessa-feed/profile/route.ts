import { listPrincipessaFeedPosts } from "@/lib/principessa-feed";
import { getPrincipessaFeedSignedUrlMap } from "@/lib/principessa-feed-media";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { isTrustedAdminUserId } from "@/lib/admin-identity";

const BUCKET = "principessa-feed";
const MIME_EXTENSIONS: Record<string, string> = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

async function requireUser() {
  if (!isSupabaseAdminConfigured) return { error: "Supabase admin is not configured.", status: 500 } as const;
  const authSupabase = await createSupabaseServerClient();
  const { data, error } = await authSupabase.auth.getUser();
  if (error || !data.user) return { error: "Sign in to open your feed profile.", status: 401 } as const;
  return { supabase: createSupabaseAdminClient(), user: data.user } as const;
}

async function buildProfileResponse(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
) {
  const [identityResult, feedProfileResult, posts] = await Promise.all([
    supabase.from("profiles").select("username, display_name").eq("id", userId).maybeSingle(),
    supabase.from("principessa_feed_profiles").select("avatar_path, header_path").eq("user_id", userId).maybeSingle(),
    listPrincipessaFeedPosts(supabase, { authorId: userId, channel: "all", status: "all", viewerId: userId, viewerIsAdmin: isTrustedAdminUserId(userId) }),
  ]);

  if (identityResult.error) throw identityResult.error;
  const feedProfile = feedProfileResult.error ? null : feedProfileResult.data;
  const paths = [feedProfile?.avatar_path, feedProfile?.header_path].filter((path): path is string => Boolean(path));
  const signedMap = await getPrincipessaFeedSignedUrlMap(supabase, paths);

  return {
    profile: {
      avatarUrl: feedProfile?.avatar_path ? signedMap.get(feedProfile.avatar_path) ?? null : null,
      displayName: identityResult.data?.display_name?.trim() || identityResult.data?.username || "Unknown",
      headerUrl: feedProfile?.header_path ? signedMap.get(feedProfile.header_path) ?? null : null,
      username: identityResult.data?.username || "@unknown",
    },
    posts,
  };
}

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  try {
    return Response.json(await buildProfileResponse(auth.supabase, auth.user.id));
  } catch (error) {
    console.error("Feed profile optional data could not be loaded", error);
    const username = String(auth.user.user_metadata?.username ?? auth.user.email?.split("@")[0] ?? "unknown");
    return Response.json({
      posts: [],
      profile: {
        avatarUrl: null,
        displayName: String(auth.user.user_metadata?.display_name ?? username),
        headerUrl: null,
        username,
      },
    });
  }
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  const formData = await request.formData();
  const avatar = formData.get("avatar");
  const header = formData.get("header");
  const avatarFile = avatar instanceof File && avatar.size > 0 ? avatar : null;
  const headerFile = header instanceof File && header.size > 0 ? header : null;
  if (!avatarFile && !headerFile) return Response.json({ error: "Choose a profile or header image." }, { status: 422 });
  if (avatarFile && (!MIME_EXTENSIONS[avatarFile.type] || avatarFile.size > 4 * 1024 * 1024)) {
    return Response.json({ error: "Profile image must be JPG, PNG, WEBP or GIF up to 4MB." }, { status: 422 });
  }
  if (headerFile && (!MIME_EXTENSIONS[headerFile.type] || headerFile.size > 8 * 1024 * 1024)) {
    return Response.json({ error: "Header image must be JPG, PNG, WEBP or GIF up to 8MB." }, { status: 422 });
  }

  const { data: current, error: currentError } = await auth.supabase
    .from("principessa_feed_profiles")
    .select("avatar_path, header_path")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (currentError) return Response.json({ error: currentError.message }, { status: 500 });

  const uploadedPaths: string[] = [];
  let avatarPath = current?.avatar_path ?? null;
  let headerPath = current?.header_path ?? null;
  try {
    for (const [kind, file] of [["avatar", avatarFile], ["header", headerFile]] as const) {
      if (!file) continue;
      const path = `profiles/${auth.user.id}/${kind}-${crypto.randomUUID()}.${MIME_EXTENSIONS[file.type]}`;
      const { error: uploadError } = await auth.supabase.storage.from(BUCKET).upload(
        path,
        Buffer.from(await file.arrayBuffer()),
        { cacheControl: "3600", contentType: file.type, upsert: false },
      );
      if (uploadError) throw uploadError;
      uploadedPaths.push(path);
      if (kind === "avatar") avatarPath = path;
      else headerPath = path;
    }

    const { error: upsertError } = await auth.supabase.from("principessa_feed_profiles").upsert({
      avatar_path: avatarPath,
      header_path: headerPath,
      updated_at: new Date().toISOString(),
      user_id: auth.user.id,
    }, { onConflict: "user_id" });
    if (upsertError) throw upsertError;
  } catch (error) {
    if (uploadedPaths.length > 0) await auth.supabase.storage.from(BUCKET).remove(uploadedPaths);
    return Response.json({ error: error instanceof Error ? error.message : "Feed profile could not be updated." }, { status: 500 });
  }

  const stalePaths = [
    avatarFile ? current?.avatar_path : null,
    headerFile ? current?.header_path : null,
  ].filter((path): path is string => Boolean(path));
  if (stalePaths.length > 0) {
    const { error: cleanupError } = await auth.supabase.storage.from(BUCKET).remove(stalePaths);
    if (cleanupError) console.error("Feed profile old media cleanup failed", cleanupError);
  }

  return Response.json(await buildProfileResponse(auth.supabase, auth.user.id));
}
