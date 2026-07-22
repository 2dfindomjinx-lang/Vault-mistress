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
  isFullSetItem,
  MAX_AVATAR_PRESET_SLOTS,
  AVATAR_PRESET_SLOT_UNLOCK_COST,
  type EquippedAvatarSlots,
  type AvatarSlot,
  type AvatarPreset,
} from "@/lib/avatar-slots";
import { profileSelect } from "@/lib/server-game-rules";

type Body = {
  action?:
    | "equip"
    | "unequip"
    | "unlock-uncensored"
    | "equip-full-set"
    | "unequip-full-set"
    | "set-equipped"
    | "save-avatar-preset"
    | "apply-avatar-preset"
    | "rename-avatar-preset"
    | "unlock-avatar-preset-slot";
  itemId?: string;
  slot?: AvatarSlot;
  presetIndex?: number;
  presetName?: string;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

const UNCENSORED_COST = 10000;

function normalizePresets(raw: unknown): AvatarPreset[] {
  const presets: AvatarPreset[] = Array.isArray(raw) ? [...raw] : [];
  while (presets.length < MAX_AVATAR_PRESET_SLOTS) {
    presets.push(null);
  }
  return presets.slice(0, MAX_AVATAR_PRESET_SLOTS);
}

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
    .select(
      "id, coins, equipped_avatar_slots, equipped_full_set_id, has_uncensored_avatar, avatar_presets, unlocked_avatar_preset_slots",
    )
    .eq("id", userId)
    .single();

  if (profileErr || !profile) {
    return jsonError("Profile not found.", 404);
  }

  const currentSlots: EquippedAvatarSlots = (profile.equipped_avatar_slots as any) || {};
  const currentUncensored = !!profile.has_uncensored_avatar;
  const currentFullSetId: string | null = (profile.equipped_full_set_id as string | null) ?? null;

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

      // Full Set and wardrobe slots are mutually exclusive - equipping a
      // regular slot item drops out of Full Set mode back to the base model.
      if (currentFullSetId) {
        await adjustInventoryQuantity(supabase, userId, currentFullSetId, "normal", 1);
      }
    } catch (inventoryErr) {
      console.error("[wardrobe] inventory reserve update failed", inventoryErr);
      return jsonError("Failed to update inventory reserve.", 500);
    }

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ equipped_avatar_slots: next, equipped_full_set_id: null, updated_at: now })
      .eq("id", userId);

    if (updateErr) {
      return jsonError("Failed to equip.", 500);
    }

    return Response.json({ equipped: next, equippedFullSetId: null });
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

  if (action === "equip-full-set") {
    const itemId = body?.itemId;
    if (!itemId) return jsonError("itemId required.", 400);
    if (!isFullSetItem(itemId)) return jsonError("Item is not a Full Set.", 400);

    if (itemId !== currentFullSetId) {
      const { data: inv } = await supabase
        .from("user_crate_inventory")
        .select("quantity")
        .eq("user_id", userId)
        .eq("item_id", itemId)
        .maybeSingle();

      if (!inv || (inv.quantity ?? 0) < 1) {
        return jsonError("You do not own this item.", 403);
      }

      try {
        if (currentFullSetId) {
          await adjustInventoryQuantity(supabase, userId, currentFullSetId, "normal", 1);
        }
        await adjustInventoryQuantity(supabase, userId, itemId, "normal", -1);

        // Full Set replaces the base model + every layer entirely - unequip
        // and restore any currently equipped wardrobe slot items.
        for (const equippedItemId of Object.values(currentSlots)) {
          if (typeof equippedItemId === "string" && equippedItemId !== "classic") {
            await adjustInventoryQuantity(supabase, userId, equippedItemId, "normal", 1);
          }
        }
      } catch (inventoryErr) {
        console.error("[wardrobe] full-set inventory reserve update failed", inventoryErr);
        return jsonError("Failed to update inventory reserve.", 500);
      }
    }

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ equipped_full_set_id: itemId, equipped_avatar_slots: {}, updated_at: now })
      .eq("id", userId);

    if (updateErr) {
      return jsonError("Failed to equip.", 500);
    }

    return Response.json({ equippedFullSetId: itemId, equipped: {} });
  }

  if (action === "unequip-full-set") {
    if (currentFullSetId) {
      try {
        await adjustInventoryQuantity(supabase, userId, currentFullSetId, "normal", 1);
      } catch (inventoryErr) {
        console.error("[wardrobe] full-set inventory restore failed", inventoryErr);
        return jsonError("Failed to restore inventory.", 500);
      }
    }

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ equipped_full_set_id: null, updated_at: now })
      .eq("id", userId);

    if (updateErr) {
      return jsonError("Failed to unequip.", 500);
    }

    return Response.json({ equippedFullSetId: null });
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

  const currentPresets = normalizePresets(profile.avatar_presets);
  const currentUnlockedPresetSlots = Math.max(
    1,
    Math.min(MAX_AVATAR_PRESET_SLOTS, Number(profile.unlocked_avatar_preset_slots ?? 1)),
  );

  if (action === "save-avatar-preset") {
    const presetIndex = body?.presetIndex;
    if (typeof presetIndex !== "number" || presetIndex < 0 || presetIndex >= MAX_AVATAR_PRESET_SLOTS) {
      return jsonError("Invalid preset slot.", 400);
    }
    if (presetIndex >= currentUnlockedPresetSlots) {
      return jsonError("This preset slot is locked.", 403);
    }

    const existing = currentPresets[presetIndex];
    const rawName = typeof body?.presetName === "string" ? body.presetName.trim() : "";
    const name = (rawName || existing?.name || `Preset ${presetIndex + 1}`).slice(0, 40);

    const nextPresets = [...currentPresets];
    nextPresets[presetIndex] = {
      name,
      equippedAvatarSlots: currentSlots,
      equippedFullSetId: currentFullSetId,
    };

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ avatar_presets: nextPresets, updated_at: now })
      .eq("id", userId);

    if (updateErr) {
      return jsonError("Failed to save preset.", 500);
    }

    return Response.json({ avatarPresets: nextPresets });
  }

  if (action === "rename-avatar-preset") {
    const presetIndex = body?.presetIndex;
    if (typeof presetIndex !== "number" || presetIndex < 0 || presetIndex >= MAX_AVATAR_PRESET_SLOTS) {
      return jsonError("Invalid preset slot.", 400);
    }
    if (presetIndex >= currentUnlockedPresetSlots) {
      return jsonError("This preset slot is locked.", 403);
    }

    const existing = currentPresets[presetIndex];
    if (!existing) {
      return jsonError("No preset saved in this slot.", 400);
    }

    const rawName = typeof body?.presetName === "string" ? body.presetName.trim() : "";
    if (!rawName) {
      return jsonError("Preset name required.", 400);
    }

    const nextPresets = [...currentPresets];
    nextPresets[presetIndex] = { ...existing, name: rawName.slice(0, 40) };

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ avatar_presets: nextPresets, updated_at: now })
      .eq("id", userId);

    if (updateErr) {
      return jsonError("Failed to rename preset.", 500);
    }

    return Response.json({ avatarPresets: nextPresets });
  }

  if (action === "apply-avatar-preset") {
    const presetIndex = body?.presetIndex;
    if (typeof presetIndex !== "number" || presetIndex < 0 || presetIndex >= MAX_AVATAR_PRESET_SLOTS) {
      return jsonError("Invalid preset slot.", 400);
    }
    if (presetIndex >= currentUnlockedPresetSlots) {
      return jsonError("This preset slot is locked.", 403);
    }

    const preset = currentPresets[presetIndex];
    if (!preset) {
      return jsonError("No preset saved in this slot.", 400);
    }

    // Computed BEFORE the ownership checks below: an item currently equipped
    // by the OUTGOING look is about to be released back to inventory by this
    // very switch, so it must count as "available" even though its stored
    // quantity is still reserved (0) at this instant. Without this, saving
    // the same item into two different presets meant the second preset could
    // never be applied while the first one was active - the ownership check
    // would see the item's reserved quantity and reject it.
    const previousItemIds = new Set<string>();
    Object.values(currentSlots).forEach((value) => {
      if (typeof value === "string") previousItemIds.add(value);
    });
    if (currentFullSetId) previousItemIds.add(currentFullSetId);

    const isAvailable = async (itemId: string) => {
      if (itemId === "classic" || previousItemIds.has(itemId)) return true;
      const { data: inv } = await supabase
        .from("user_crate_inventory")
        .select("quantity")
        .eq("user_id", userId)
        .eq("item_id", itemId)
        .maybeSingle();
      return !!inv && (inv.quantity ?? 0) > 0;
    };

    let targetFullSetId: string | null = null;
    let targetSlots: EquippedAvatarSlots = {};

    if (preset.equippedFullSetId && (await isAvailable(preset.equippedFullSetId))) {
      targetFullSetId = preset.equippedFullSetId;
    } else {
      const rawSlots = preset.equippedAvatarSlots || {};
      const validated: EquippedAvatarSlots = {};
      for (const [slot, itemId] of Object.entries(rawSlots)) {
        if (typeof itemId === "string" && (await isAvailable(itemId))) {
          (validated as any)[slot] = itemId;
        }
      }
      targetSlots = normalizeEquipment(validated);
    }

    const nextItemIds = new Set<string>();
    Object.values(targetSlots).forEach((value) => {
      if (typeof value === "string") nextItemIds.add(value);
    });
    if (targetFullSetId) nextItemIds.add(targetFullSetId);

    try {
      for (const removedItemId of previousItemIds) {
        if (!nextItemIds.has(removedItemId)) {
          await adjustInventoryQuantity(supabase, userId, removedItemId, "normal", 1);
        }
      }
      for (const addedItemId of nextItemIds) {
        if (!previousItemIds.has(addedItemId)) {
          await adjustInventoryQuantity(supabase, userId, addedItemId, "normal", -1);
        }
      }
    } catch (inventoryErr) {
      console.error("[wardrobe] preset apply inventory update failed", inventoryErr);
      return jsonError("Failed to update inventory reserve.", 500);
    }

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({
        equipped_avatar_slots: targetSlots,
        equipped_full_set_id: targetFullSetId,
        updated_at: now,
      })
      .eq("id", userId);

    if (updateErr) {
      return jsonError("Failed to apply preset.", 500);
    }

    return Response.json({ equipped: targetSlots, equippedFullSetId: targetFullSetId });
  }

  if (action === "unlock-avatar-preset-slot") {
    if (currentUnlockedPresetSlots >= MAX_AVATAR_PRESET_SLOTS) {
      return Response.json({ unlockedAvatarPresetSlots: currentUnlockedPresetSlots });
    }

    const currentCoins = Number(profile.coins ?? 0);
    if (currentCoins < AVATAR_PRESET_SLOT_UNLOCK_COST) {
      return jsonError("Not enough coins.", 402);
    }

    const nextCoins = currentCoins - AVATAR_PRESET_SLOT_UNLOCK_COST;
    const nextUnlockedSlots = currentUnlockedPresetSlots + 1;

    const { data: updatedRow, error: coinErr } = await supabase
      .from("profiles")
      .update({ coins: nextCoins, unlocked_avatar_preset_slots: nextUnlockedSlots, updated_at: now })
      .eq("id", userId)
      .eq("coins", currentCoins)
      .select("id")
      .maybeSingle();

    if (coinErr) {
      return jsonError("Unlock failed (balance changed).", 409);
    }

    if (!updatedRow) {
      // Without .select() above, an update that matches ZERO rows (stale
      // currentCoins read, concurrent request, etc.) returns no error at
      // all - the request would look successful (sound + UI update) while
      // nothing was actually charged or persisted, and a refresh would
      // silently revert it. Treat "no row came back" as the same failure
      // as a real error.
      return jsonError("Unlock failed (balance changed) - please try again.", 409);
    }

    const { error: txErr } = await supabase.from("coin_transactions").insert({
      user_id: userId,
      amount: -AVATAR_PRESET_SLOT_UNLOCK_COST,
      balance_before: currentCoins,
      balance_after: nextCoins,
      reason: "spend:avatar-preset-slot",
      metadata: { spendAmount: AVATAR_PRESET_SLOT_UNLOCK_COST, slotIndex: currentUnlockedPresetSlots },
    });

    if (txErr) {
      console.error("[wardrobe] preset slot unlock ledger insert failed", txErr);
      await supabase
        .from("profiles")
        .update({ coins: currentCoins, unlocked_avatar_preset_slots: currentUnlockedPresetSlots, updated_at: now })
        .eq("id", userId)
        .eq("coins", nextCoins);
      return jsonError("Unlock logging failed.", 500);
    }

    return Response.json({ unlockedAvatarPresetSlots: nextUnlockedSlots, coins: nextCoins });
  }

  return jsonError("Unknown action.", 400);
}
