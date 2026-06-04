import { visibleGalleryCosts } from "@/lib/server-game-rules";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  itemIds?: string[];
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();

  if (authError || !authData.user) {
    return jsonError(authError?.message ?? "Authentication required.", 401);
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const itemIds = Array.from(new Set(body?.itemIds ?? []));

  if (itemIds.length === 0 || itemIds.some((id) => typeof id !== "string")) {
    return jsonError("Invalid gallery unlock payload.");
  }

  const allowedIds = new Set([
    ...visibleGalleryCosts.keys(),
    "rare-loyal-glimpse",
    "rare-private-smile",
    "rare-purple-obsession",
    "rare-golden-approval",
    "divine-throne-room",
    "divine-goddess-mood",
    "divine-final-favor",
    "divine-velvet-throne",
    "secret-defnes-final-favor",
    ...Array.from({ length: 10 }, (_, index) => `sacrifice-${index + 1}`),
  ]);

  if (itemIds.some((id) => !allowedIds.has(id))) {
    return jsonError("Unknown gallery item.", 422);
  }

  const rows = itemIds.map((itemId) => ({ item_id: itemId, user_id: authData.user.id }));
  const supabase = createSupabaseAdminClient();
  const { error: galleryError } = await supabase.from("user_gallery").upsert(rows, {
    onConflict: "user_id,item_id",
  });

  if (galleryError) {
    return jsonError(galleryError.message, 500);
  }

  const { error: legacyGalleryError } = await supabase.from("unlocked_gallery_items").upsert(rows, {
    onConflict: "user_id,item_id",
  });

  if (legacyGalleryError) {
    console.warn("Legacy gallery upsert failed", legacyGalleryError);
  }

  return Response.json({ itemIds });
}
