import { readFile } from "node:fs/promises";
import { getTodaysWorshipImage, getWorshipFilePath } from "@/lib/pet-worship";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

const CONTENT_TYPES: Record<string, string> = {
  avif: "image/avif",
  gif: "image/gif",
  jfif: "image/jpeg",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

async function getAuthedUserId() {
  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();

  if (authError || !authData.user) {
    return { error: Response.json({ error: authError?.message ?? "Authentication required." }, { status: 401 }), userId: null };
  }

  return { error: null, userId: authData.user.id };
}

// Serves today's worship image only through this authenticated route - the
// files live outside `public/` on purpose, so there is no static URL to
// find/share/guess. Normal viewing (no `download` param) always returns the
// real image, free. Only `?download=1` (the actual file-save action) is
// gated: it requires this exact image to already be unlocked via the paid
// POST /api/user/pet-worship {action:"download"} flow.
export async function GET(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return Response.json({ error: `Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}` }, { status: 500 });
  }

  const authResult = await getAuthedUserId();
  if (authResult.error) return authResult.error;
  const userId = authResult.userId!;

  const { category, fileName, imageKey } = await getTodaysWorshipImage();
  if (!category || !fileName || !imageKey) {
    return Response.json({ error: "No worship image available today." }, { status: 404 });
  }

  const wantsDownload = new URL(request.url).searchParams.get("download") === "1";

  if (wantsDownload) {
    const supabase = createSupabaseAdminClient();
    const { data: unlockRow } = await supabase
      .from("user_worship_unlocks")
      .select("image_key")
      .eq("user_id", userId)
      .eq("image_key", imageKey)
      .maybeSingle();

    if (!unlockRow) {
      return Response.json({ error: "Unlock this image before downloading." }, { status: 402 });
    }
  }

  const filePath = getWorshipFilePath(category, fileName);
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "jpg";

  try {
    const original = await readFile(filePath);
    const headers: Record<string, string> = {
      "Cache-Control": "private, no-store",
      "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
    };
    if (wantsDownload) {
      headers["Content-Disposition"] = `attachment; filename="worship-${category}.${ext}"`;
    }
    return new Response(new Uint8Array(original), { headers });
  } catch (error) {
    console.error("[pet-worship] image read failed", error);
    return Response.json({ error: "Image unavailable." }, { status: 500 });
  }
}
