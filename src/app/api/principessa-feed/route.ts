import { listPrincipessaFeedPosts } from "@/lib/principessa-feed";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { isTrustedAdminUserId } from "@/lib/admin-identity";

export async function GET(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return Response.json(
      { error: `Supabase admin is not configured: ${getSupabaseAdminConfigErrors().join(", ")}` },
      { status: 500 },
    );
  }

  try {
    const channel = new URL(request.url).searchParams.get("channel") === "sub" ? "sub" : "principessa";
    const authSupabase = await createSupabaseServerClient();
    const { data: authData } = await authSupabase.auth.getUser();
    const posts = await listPrincipessaFeedPosts(createSupabaseAdminClient(), {
      channel: channel === "sub" ? "all" : "principessa",
      viewerId: authData.user?.id,
      viewerIsAdmin: isTrustedAdminUserId(authData.user?.id),
    });
    return Response.json(
      { posts },
      { headers: { "Cache-Control": authData.user ? "private, no-store" : "public, s-maxage=10, stale-while-revalidate=20" } },
    );
  } catch (error) {
    console.error("Principessa feed list failed", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Principessa feed could not be loaded." },
      { status: 500 },
    );
  }
}
