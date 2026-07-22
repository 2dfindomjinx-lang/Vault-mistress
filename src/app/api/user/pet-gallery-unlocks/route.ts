import { petGalleryScoreRequirements } from "@/lib/server-game-rules";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

type Body = {
  itemIds?: string[];
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_SECONDS = 60;

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();

  if (authError || !authData.user) {
    return jsonError(authError?.message ?? "Authentication required.", 401);
  }

  const userId = authData.user.id;
  const supabase = createSupabaseAdminClient();

  const rateLimit = await checkRateLimit(supabase, `pet-gallery-unlock:${userId}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_SECONDS);
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfterSeconds);
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const itemIds = Array.from(new Set(body?.itemIds ?? []));

  if (itemIds.length === 0 || itemIds.some((itemId) => !petGalleryScoreRequirements.has(itemId))) {
    return jsonError("Invalid Pet gallery unlock payload.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("pet_score")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    return jsonError(profileError?.message ?? "Profile not found.", 404);
  }

  const petScore = Number(profile.pet_score ?? 0);
  const unmet = itemIds.find((id) => petScore < (petGalleryScoreRequirements.get(id) ?? Infinity));

  if (unmet) {
    return jsonError("Pet score requirement not met for this item.", 403);
  }

  const { data: result, error } = await supabase.rpc("unlock_pet_gallery_items_atomic", {
    p_user_id: userId,
    p_item_ids: itemIds,
  });

  if (error) {
    console.error("[pet-gallery-unlocks] atomic unlock failed", error);
    return jsonError("Pet gallery unlock failed.", 500);
  }

  const outcome = result as { error?: string };

  if (outcome?.error) {
    return jsonError("Profile not found.", 404);
  }

  return Response.json({ itemIds });
}
