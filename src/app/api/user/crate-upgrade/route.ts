import { randomInt } from "node:crypto";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { CRATE_TYPES, SAMPLE_CRATE_ITEMS, type CrateRarity } from "@/lib/crates";
import {
  CRATE_UPGRADE_RARITY_ORDER,
  computeCrateUpgradeChance,
  getCrateRarityAvgSellValue,
  pickCrateUpgradeReward,
} from "@/lib/crate-upgrade";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

// The Upgrade table's only endpoint. One item in, a coin flip, and either a
// pricier item out or nothing. The chance is recomputed here from the same
// shared module the client used to show a preview - the client's number is
// never trusted, only reproduced.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type UpgradeBody = {
  itemId?: string;
  variant?: string;
  toCrateType?: string;
  toRarity?: string;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function roll(): number {
  return randomInt(0, 1_000_000) / 1_000_000;
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();
  if (authError || !authData.user) {
    return jsonError("Authentication required.", 401);
  }
  const userId = authData.user.id;

  const supabase = createSupabaseAdminClient();
  const rateLimit = await checkRateLimit(supabase, `crate-upgrade:${userId}`, 30, 60);
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfterSeconds);

  const body = (await request.json().catch(() => null)) as UpgradeBody | null;
  const itemId = body?.itemId?.trim();
  const variant = body?.variant?.trim() || "normal";
  const toCrateType = body?.toCrateType?.trim();
  const toRarity = body?.toRarity?.trim() as CrateRarity | undefined;

  if (!itemId || !toCrateType || !toRarity) {
    return jsonError("Missing item or target.");
  }
  if (!CRATE_UPGRADE_RARITY_ORDER.includes(toRarity)) {
    return jsonError("Invalid target rarity.");
  }
  const targetCrate = CRATE_TYPES[toCrateType];
  if (!targetCrate || !targetCrate.enabled) {
    return jsonError("Invalid or disabled target crate.");
  }

  const itemDef = SAMPLE_CRATE_ITEMS[itemId];
  // Same rule as a plain sell: the classic starter item has no value and
  // cannot be fed into anything.
  if (!itemDef || itemDef.sell_value <= 0 || itemId === "classic") {
    return jsonError("This item cannot be used for an upgrade.", 422);
  }

  const targetAvgSellValue = getCrateRarityAvgSellValue(toCrateType, toRarity);
  if (targetAvgSellValue === null) {
    return jsonError("That crate has no items at that rarity.", 422);
  }
  const chance = computeCrateUpgradeChance(itemDef.sell_value, targetAvgSellValue);
  if (chance === null) {
    return jsonError("The target must be worth more than the item you are risking.", 422);
  }

  // Verify current ownership.
  const { data: invRow, error: invErr } = await supabase
    .from("user_crate_inventory")
    .select("quantity")
    .eq("user_id", userId)
    .eq("item_id", itemId)
    .eq("variant", variant)
    .maybeSingle();

  if (invErr || !invRow || invRow.quantity < 1) {
    return jsonError("You do not own this item.", 422);
  }

  // Two independent rolls: one decides win/lose, the other (only spent on a
  // win) decides which item from the target rarity comes back. Keeping them
  // separate avoids any correlation between the outcome and the reward.
  const outcomeRoll = roll();
  const won = outcomeRoll < chance;

  // Consume the fodder item first, with the same optimistic-concurrency
  // pattern crates.ts already uses for sell/open: a conditional write against
  // the quantity just read, rolled back on any later failure.
  const previousQuantity = invRow.quantity;
  const nextQuantity = previousQuantity - 1;
  const consumeQuery =
    nextQuantity > 0
      ? supabase
          .from("user_crate_inventory")
          .update({ quantity: nextQuantity })
          .eq("user_id", userId)
          .eq("item_id", itemId)
          .eq("variant", variant)
          .eq("quantity", previousQuantity)
          .select("item_id")
          .maybeSingle()
      : supabase
          .from("user_crate_inventory")
          .delete()
          .eq("user_id", userId)
          .eq("item_id", itemId)
          .eq("variant", variant)
          .eq("quantity", previousQuantity)
          .select("item_id")
          .maybeSingle();

  const { data: consumed, error: consumeErr } = await consumeQuery;
  if (consumeErr || !consumed) {
    return jsonError("Upgrade collided with another inventory update. Try again.", 409);
  }

  const restoreFodder = async () => {
    const { error } = await supabase
      .from("user_crate_inventory")
      .upsert(
        { user_id: userId, item_id: itemId, variant, quantity: previousQuantity },
        { onConflict: "user_id,item_id,variant" },
      );
    if (error) console.error("[crate-upgrade] fodder restore failed", error);
  };

  let rewardItemId: string | null = null;
  let rewardVariant: string | null = null;

  if (won) {
    const reward = pickCrateUpgradeReward(toCrateType, toRarity, roll());
    if (!reward) {
      await restoreFodder();
      return jsonError("Could not draw a reward for that target. Try again.", 500);
    }
    const rewardDef = SAMPLE_CRATE_ITEMS[reward.item_id];
    // Legendary+ items stay individually visible even when won this way -
    // the bulk-sell shield on them is unrelated to how they were acquired,
    // but this check protects against a malformed drop table ever handing
    // out something with no sell value at all.
    if (!rewardDef) {
      await restoreFodder();
      return jsonError("Could not resolve the reward item. Try again.", 500);
    }

    const { data: existingReward } = await supabase
      .from("user_crate_inventory")
      .select("quantity")
      .eq("user_id", userId)
      .eq("item_id", reward.item_id)
      .eq("variant", reward.variant)
      .maybeSingle();

    const newRewardQty = (existingReward?.quantity ?? 0) + 1;
    const { error: grantErr } = await supabase.from("user_crate_inventory").upsert(
      { user_id: userId, item_id: reward.item_id, variant: reward.variant, quantity: newRewardQty },
      { onConflict: "user_id,item_id,variant" },
    );
    if (grantErr) {
      console.error("[crate-upgrade] reward grant failed", grantErr);
      await restoreFodder();
      return jsonError("Failed to grant the reward. Your item was not consumed.", 500);
    }

    rewardItemId = reward.item_id;
    rewardVariant = reward.variant;
  }

  // Best-effort audit log. Nothing financial hinges on this row - the coins
  // and inventory are already correct at this point - so a logging failure
  // is reported but does not roll back a result the player already has.
  const { error: logErr } = await supabase.from("crate_item_upgrades").insert({
    user_id: userId,
    from_item_id: itemId,
    from_variant: variant,
    from_sell_value: itemDef.sell_value,
    to_crate_type: toCrateType,
    to_rarity: toRarity,
    win_chance_percent: Math.round(chance * 100_000) / 1_000,
    won,
    to_item_id: rewardItemId,
    to_variant: rewardVariant,
  });
  if (logErr) console.error("[crate-upgrade] audit log insert failed", logErr);

  return Response.json({
    success: true,
    won,
    chancePercent: Math.round(chance * 1000) / 10,
    rewardItemId,
    rewardVariant,
  });
}
