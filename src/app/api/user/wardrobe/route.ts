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

async function adjustInventoryQuantity(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  itemId: string,
  variant: string,
  delta: number,
) {
  if (delta === 0 || itemId === "classic") {
    return;
  }

  const { data: existing, error: readErr } = await supabase
    .from("user_crate_inventory")
    .select("quantity")
    .eq("user_id", userId)
    .eq("item_id", itemId)
    .eq("variant", variant)
    .maybeSingle();

  if (readErr) {
    throw readErr;
  }

  const currentQuantity = Math.max(0, Number(existing?.quantity ?? 0));
  const nextQuantity = Math.max(0, currentQuantity + delta);

  if (nextQuantity <= 0) {
    const { error: deleteErr } = await supabase
      .from("user_crate_inventory")
      .delete()
      .eq("user_id", userId)
      .eq("item_id", itemId)
      .eq("variant", variant);

    if (deleteErr) {
      throw deleteErr;
    }
    return;
  }

  const { error: upsertErr } = await supabase
    .from("user_crate_inventory")
    .upsert(
      {
        user_id: userId,
        item_id: itemId,
        variant,
        quantity: nextQuantity,
      },
      { onConflict: "user_id,item_id,variant" },
    );

  if (upsertErr) {
    throw upsertErr;
  }
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
    const previousItemIds = new Set(Object.values(currentSlots).filter((value): value is string => typeof value === "string"));
    const nextItemIds = new Set(Object.values(next).filter((value): value is string => typeof value === "string"));

    try {
      for (const removedItemId of previousItemIds) {
        if (!nextItemIds.has(removedItemId)) {
          await adjustInventoryQuantity(supabase, userId, removedItemId, "normal", 1);
        }
      }

      if (!previousItemIds.has(itemId)) {
        await adjustInventoryQuantity(supabase, userId, itemId, "normal", -1);
      }
    } catch (inventoryErr) {
      console.error("[wardrobe] inventory reserve update failed", inventoryErr);
      return jsonError("Failed to update inventory reserve.", 500);
    }

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

    const removedItemId = currentSlots[slot];
    const next = unequipAvatarSlot(currentSlots, slot);
    if (removedItemId && removedItemId !== "classic") {
      try {
        await adjustInventoryQuantity(supabase, userId, removedItemId, "normal", 1);
      } catch (inventoryErr) {
        console.error("[wardrobe] inventory restore failed", inventoryErr);
        return jsonError("Failed to restore inventory.", 500);
      }
    }

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
    const { error: txErr } = await supabase.from("coin_transactions").insert({
      user_id: userId,
      amount: -UNCENSORED_COST,
      balance_before: currentCoins,
      balance_after: nextCoins,
      reason: "spend:uncensored",
      metadata: { spendAmount: UNCENSORED_COST },
    });

    if (txErr) {
      console.error("[wardrobe] uncensored ledger insert failed", txErr);
      await supabase
        .from("profiles")
        .update({ coins: currentCoins, has_uncensored_avatar: false, updated_at: now })
        .eq("id", userId)
        .eq("coins", nextCoins);
      return jsonError("Unlock logging failed.", 500);
    }

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
