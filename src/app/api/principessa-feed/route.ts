import { listPrincipessaFeedPosts } from "@/lib/principessa-feed";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";

export async function GET(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return Response.json(
      { error: `Supabase admin is not configured: ${getSupabaseAdminConfigErrors().join(", ")}` },
      { status: 500 },
    );
  }

  try {
    const channel = new URL(request.url).searchParams.get("channel") === "sub" ? "sub" : "principessa";
    const posts = await listPrincipessaFeedPosts(createSupabaseAdminClient(), { channel });
    return Response.json({ posts });
  } catch (error) {
    console.error("Principessa feed list failed", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Principessa feed could not be loaded." },
      { status: 500 },
    );
  }
}
