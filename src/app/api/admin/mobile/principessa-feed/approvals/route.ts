import { requireMobileAdmin } from "@/lib/mobile-admin";
import { listPendingPrincipessaPosts, moderatePrincipessaPost } from "@/lib/principessa-feed-moderation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const admin = await requireMobileAdmin(request);
  if ("error" in admin) return Response.json({ error: admin.error }, { status: admin.status });
  return Response.json({ posts: await listPendingPrincipessaPosts(admin.supabase, admin.adminUser.id) });
}

export async function POST(request: Request) {
  const admin = await requireMobileAdmin(request);
  if ("error" in admin) return Response.json({ error: admin.error }, { status: admin.status });
  const body = (await request.json().catch(() => null)) as { action?: "approve" | "reject"; postId?: string } | null;
  const postId = String(body?.postId ?? "").trim();
  if (!postId || (body?.action !== "approve" && body?.action !== "reject")) return Response.json({ error: "Invalid moderation request." }, { status: 400 });
  try {
    const result = await moderatePrincipessaPost(admin.supabase, admin.adminUser.id, postId, body.action);
    return Response.json({ posts: result.pendingPosts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Moderation failed.";
    return Response.json({ error: message }, { status: message === "Pending post not found." ? 404 : 500 });
  }
}
