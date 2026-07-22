import { galleryMoodRequirements, visibleGalleryCosts } from "@/lib/server-game-rules";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { SACRIFICE_COST, SACRIFICE_ITEM_IDS, SACRIFICE_UNLOCK_CHANCE } from "@/lib/server-game-rules";

type Body = {
  action?: "unlock" | "sacrifice";
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

  const rateLimit = await checkRateLimit(supabase, `gallery-unlock:${userId}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_SECONDS);
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfterSeconds);
  }

  const body = (await request.json().catch(() => null)) as Body | null;

  if (body?.action === "sacrifice") {
    const { data, error } = await supabase.rpc("roll_sacrifice_unlock", {
      p_user_id: userId,
      p_cost: SACRIFICE_COST,
      p_chance: SACRIFICE_UNLOCK_CHANCE,
      p_candidate_ids: SACRIFICE_ITEM_IDS,
    });

    if (error) {
      console.error("[gallery-unlocks] sacrifice roll failed", error);
      return jsonError("Sacrifice could not be processed.", 500);
    }

    const result = data as
      | { error: "profile_not_found" | "insufficient_funds"; coins?: number; required?: number }
      | { completed: true; coins: number }
      | { won: boolean; itemId: string | null; coins: number };

    if ("error" in result) {
      if (result.error === "insufficient_funds") {
        return jsonError(`The sacrifice requires ${SACRIFICE_COST} coins.`, 402);
      }
      return jsonError("Profile not found.", 404);
    }

    if ("completed" in result) {
      return Response.json({ completed: true, coins: result.coins });
    }

    return Response.json({ won: result.won, itemId: result.itemId, coins: result.coins });
  }

  const itemIds = Array.from(new Set(body?.itemIds ?? []));

  if (itemIds.length === 0 || itemIds.some((id) => typeof id !== "string")) {
    return jsonError("Invalid gallery unlock payload.");
  }

  const allowedIds = new Set([
    ...visibleGalleryCosts.keys(),
    ...galleryMoodRequirements.keys(),
  ]);

  if (itemIds.some((id) => !allowedIds.has(id))) {
    return jsonError("Unknown gallery item.", 422);
  }

  // Skip anything the user already owns - keeps the request idempotent and
  // means a retried/duplicated request never charges coins twice.
  const { data: existingRows, error: existingError } = await supabase
    .from("user_gallery")
    .select("item_id")
    .eq("user_id", userId)
    .in("item_id", itemIds);

  if (existingError) {
    return jsonError(existingError.message, 500);
  }

  const alreadyUnlocked = new Set((existingRows ?? []).map((row) => row.item_id as string));
  const toUnlock = itemIds.filter((id) => !alreadyUnlocked.has(id));

  if (toUnlock.length === 0) {
    return Response.json({ itemIds });
  }

  // Mood-gated items require the caller's current affection to already meet
  // the threshold - verified against the DB row, not anything client-supplied.
  const moodItemIds = toUnlock.filter((id) => galleryMoodRequirements.has(id));
  if (moodItemIds.length > 0) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("affection")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile) {
      return jsonError(profileError?.message ?? "Profile not found.", 404);
    }

    const affection = Number(profile.affection ?? 0);
    const unmet = moodItemIds.find((id) => affection < (galleryMoodRequirements.get(id) ?? Infinity));

    if (unmet) {
      return jsonError("Affection requirement not met for this item.", 403);
    }
  }

  const commonItems = toUnlock
    .filter((id) => visibleGalleryCosts.has(id))
    .map((id) => ({ item_id: id, cost: visibleGalleryCosts.get(id) ?? 0 }));
  const freeItems = toUnlock.filter((id) => !visibleGalleryCosts.has(id));

  const { data: result, error: rpcError } = await supabase.rpc("unlock_gallery_items_atomic", {
    p_user_id: userId,
    p_common_items: commonItems,
    p_free_items: freeItems,
    p_reason: "spend:gallery-unlock",
  });

  if (rpcError) {
    console.error("[gallery-unlocks] atomic unlock failed", rpcError);
    return jsonError("Gallery unlock failed.", 500);
  }

  const outcome = result as { error?: string; coins?: number; required?: number };

  if (outcome?.error === "insufficient_funds") {
    return jsonError("Not enough coins for this unlock.", 402);
  }

  if (outcome?.error) {
    return jsonError("Gallery unlock failed.", 404);
  }

  return Response.json({ itemIds, coins: outcome.coins });
}
