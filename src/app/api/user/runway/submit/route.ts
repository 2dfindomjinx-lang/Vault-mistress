import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getItemAvatarSlot,
  isFullSetItem,
  normalizeEquipment,
  type EquippedAvatarSlots,
} from "@/lib/avatar-slots";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { isTrustedAdminUserId } from "@/lib/admin-identity";

type Body = {
  equippedAvatarSlots?: Record<string, unknown>;
  equippedFullSetId?: string | null;
  idempotencyKey?: string;
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

  const userId = authData.user.id;
  const allowMultipleActiveAvatars = isTrustedAdminUserId(userId);
  const supabase = createSupabaseAdminClient();

  const rateLimit = await checkRateLimit(supabase, `runway-submit:${userId}`, 5, 60);
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfterSeconds);
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const idempotencyKey = typeof body?.idempotencyKey === "string" && body.idempotencyKey.length > 0
    ? body.idempotencyKey
    : null;
  if (!idempotencyKey) {
    return jsonError("idempotencyKey is required.", 400);
  }

  const rawSlots = body?.equippedAvatarSlots && typeof body.equippedAvatarSlots === "object"
    ? body.equippedAvatarSlots
    : {};
  const rawFullSetId = typeof body?.equippedFullSetId === "string" ? body.equippedFullSetId : null;

  // Ownership verification, server-side, never trusting the client's claims.
  const { data: inventoryRows, error: inventoryError } = await supabase
    .from("user_crate_inventory")
    .select("item_id, quantity")
    .eq("user_id", userId);

  if (inventoryError) {
    return jsonError("Could not verify inventory.", 500);
  }

  const ownedItemIds = new Set(
    (inventoryRows ?? [])
      .filter((row) => Number(row.quantity ?? 0) >= 1)
      .map((row) => String(row.item_id)),
  );
  const isOwned = (itemId: string) => itemId === "classic" || ownedItemIds.has(itemId);

  const candidateSlots: EquippedAvatarSlots = {};
  for (const [slot, value] of Object.entries(rawSlots)) {
    if (typeof value !== "string" || value.length === 0) continue;
    if (!isOwned(value)) {
      return jsonError(`You do not own "${value}".`, 403);
    }
    if (getItemAvatarSlot(value) !== slot) {
      return jsonError(`"${value}" does not belong in the "${slot}" slot.`, 400);
    }
    (candidateSlots as Record<string, string>)[slot] = value;
  }

  let fullSetId: string | null = null;
  if (rawFullSetId) {
    if (!isOwned(rawFullSetId)) {
      return jsonError(`You do not own "${rawFullSetId}".`, 403);
    }
    if (!isFullSetItem(rawFullSetId)) {
      return jsonError(`"${rawFullSetId}" is not a full-set item.`, 400);
    }
    fullSetId = rawFullSetId;
  }

  const normalizedSlots = normalizeEquipment(candidateSlots);

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("has_uncensored_avatar")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return jsonError("Profile not found.", 404);
  }

  const { data, error } = await supabase.rpc("submit_voting_avatar", {
    p_user_id: userId,
    p_equipped_avatar_slots: fullSetId ? {} : normalizedSlots,
    p_equipped_full_set_id: fullSetId,
    p_has_uncensored: Boolean(profile.has_uncensored_avatar),
    p_idempotency_key: idempotencyKey,
    p_allow_multiple_active: allowMultipleActiveAvatars,
  });

  if (error) {
    console.error("[runway] submit_voting_avatar failed", error);
    return jsonError(error.message, 500);
  }

  const result = data as { error?: string; success?: boolean; avatarId?: string; nextEligibleAt?: string; next_eligible_at?: string } | null;
  if (result?.error) {
    const status = result.error === "cooldown_active" ? 409 : 400;
    return Response.json(result, { status });
  }

  return Response.json(result);
}
