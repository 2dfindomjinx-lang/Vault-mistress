import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

const allowedPetGalleryIds = new Set(Array.from({ length: 30 }, (_, index) => `pet-gallery-${index + 1}`));

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

  if (itemIds.length === 0 || itemIds.some((itemId) => !allowedPetGalleryIds.has(itemId))) {
    return jsonError("Invalid Pet gallery unlock payload.");
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("user_pet_gallery")
    .upsert(
      itemIds.map((itemId) => ({ item_id: itemId, user_id: authData.user.id })),
      { onConflict: "user_id,item_id" },
    );

  if (error) {
    return jsonError(error.message, 500);
  }

  return Response.json({ itemIds });
}
