import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getItemAvatarSlot,
  normalizeEquipment,
  equipAvatarItem,
  unequipAvatarSlot,
  type EquippedAvatarSlots,
  type AvatarSlot,
} from "@/lib/avatar-slots";
import { profileSelect } from "@/lib/server-game-rules";

type Body = {
  action?: "equip" | "unequip" | "unlock-uncensored";
  itemId?: string;
  slot?: AvatarSlot;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

const UNCENSORED_COST = 10000;

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
  const action = body?.action;
  const userId = authData.user.id;
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  // Load current profile for equipped and coins
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, coins, equipped_avatar_slots, has_uncensored_avatar")
    .eq("id", userId)
    .single();

  if (profileErr || !profile) {
    return jsonError("Profile not found.", 404);
  }

  const currentSlots: EquippedAvatarSlots = (profile.equipped_avatar_slots as any) || {};
  const currentUncensored = !!profile.has_uncensored_avatar;

  if (action === "equip") {
    const itemId = body?.itemId;
    if (!itemId) return jsonError("itemId required.", 400);

    const slot = getItemAvatarSlot(itemId);
    if (!slot) return jsonError("Item not equippable.", 400);

    // "classic" is a default item always available (no DB ownership required)
    if (itemId !== "classic") {
      // Verify ownership server-side: must have quantity > 0 in crate inventory
      const { data: inv } = await supabase
        .from("user_crate_inventory")
        .select("quantity")
        .eq("user_id", userId)
        .eq("item_id", itemId)
        .maybeSingle();

      if (!inv || (inv.quantity ?? 0) < 1) {
        return jsonError("You do not own this item.", 403);
      }
    }

    // Server-side apply logic (trust only server)
    const next = equipAvatarItem(currentSlots, itemId);

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ equipped_avatar_slots: next, updated_at: now })
      .eq("id", userId);

    if (updateErr) {
      return jsonError("Failed to equip.", 500);
    }

    return Response.json({ equipped: next });
  }

  if (action === "unequip") {
    const slot = body?.slot;
    if (!slot) return jsonError("slot required.", 400);

    const next = unequipAvatarSlot(currentSlots, slot);

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ equipped_avatar_slots: next, updated_at: now })
      .eq("id", userId);

    if (updateErr) {
      return jsonError("Failed to unequip.", 500);
    }

    return Response.json({ equipped: next });
  }

  if (action === "unlock-uncensored") {
    if (currentUncensored) {
      return Response.json({ hasUncensored: true });
    }

    const currentCoins = Number(profile.coins ?? 0);
    if (currentCoins < UNCENSORED_COST) {
      return jsonError("Not enough coins.", 402);
    }

    const nextCoins = currentCoins - UNCENSORED_COST;

    const { error: coinErr } = await supabase
      .from("profiles")
      .update({ coins: nextCoins, has_uncensored_avatar: true, updated_at: now })
      .eq("id", userId)
      .eq("coins", currentCoins);

    if (coinErr) {
      return jsonError("Unlock failed (balance changed).", 409);
    }

    // Ledger
    await supabase.from("coin_transactions").insert({
      user_id: userId,
      amount: -UNCENSORED_COST,
      balance_before: currentCoins,
      balance_after: nextCoins,
      reason: "spend:uncensored",
      metadata: { spendAmount: UNCENSORED_COST },
    });

    return Response.json({ hasUncensored: true, coins: nextCoins });
  }

  if (action === "set-equipped") {
    const slots = (body as any)?.equippedSlots || {};
    // harden: only set items the user actually owns
    const cleaned: EquippedAvatarSlots = {};
    for (const [s, iid] of Object.entries(slots as Record<string, string>)) {
      if (!iid || typeof iid !== "string") continue;
      if (iid === "classic") {
        // default item always allowed
        (cleaned as any)[s] = iid;
        continue;
      }
      const { data: inv } = await supabase
        .from("user_crate_inventory")
        .select("quantity")
        .eq("user_id", userId)
        .eq("item_id", iid)
        .maybeSingle();
      if (inv && (inv.quantity ?? 0) > 0) {
        (cleaned as any)[s] = iid;
      }
    }
    const normalized = normalizeEquipment(cleaned);
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ equipped_avatar_slots: normalized, updated_at: now })
      .eq("id", userId);
    if (updateErr) {
      return jsonError("Failed to sync equipped.", 500);
    }
    return Response.json({ equipped: normalized });
  }

  return jsonError("Unknown action.", 400);
}
