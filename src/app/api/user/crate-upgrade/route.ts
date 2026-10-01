import { randomInt } from "node:crypto";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { SAMPLE_CRATE_ITEMS } from "@/lib/crates";
import { computeCrateUpgradeChance, findCrateUpgradeTargetItem, isUpgradeExcluded } from "@/lib/crate-upgrade";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

// The Upgrader's only endpoint. One item in, one roll, and either exactly the
// named target item out or nothing. The chance is recomputed here from the
// same shared module the client used to show a preview - the client's number
// is never trusted, only reproduced.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type UpgradeBody = {
  itemId?: string;
  targetItemId?: string;
  targetVariant?: string;
  variant?: string;
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
  const targetItemId = body?.targetItemId?.trim();
  const targetVariant = body?.targetVariant?.trim() || "normal";

  if (!itemId || !targetItemId) {
    return jsonError("Pick a target.");
  }

  // Only items that really drop from an enabled crate can be targets -
  // exclusives kept out of every drop table stay out of reach here too.
  const target = findCrateUpgradeTargetItem(targetItemId, targetVariant);
  if (!target) {
    return jsonError("Invalid target.", 422);
  }

  const itemDef = SAMPLE_CRATE_ITEMS[itemId];
  // Same rule as a plain sell: the classic starter item has no value and
  // cannot be fed into anything.
  if (!itemDef || itemDef.sell_value <= 0 || itemId === "classic" || isUpgradeExcluded(itemId)) {
    return jsonError("This item cannot be upgraded.", 422);
  }

  const chance = computeCrateUpgradeChance(itemDef.sell_value, target.sellValue);
  if (chance === null) {
    return jsonError("Target must be worth more.", 422);
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

  // One roll decides everything: under the chance wins the named item.
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
    return jsonError("Try again.", 409);
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
    const { data: existingReward } = await supabase
      .from("user_crate_inventory")
      .select("quantity")
      .eq("user_id", userId)
      .eq("item_id", target.itemId)
      .eq("variant", target.variant)
      .maybeSingle();

    const newRewardQty = (existingReward?.quantity ?? 0) + 1;
    const { error: grantErr } = await supabase.from("user_crate_inventory").upsert(
      { user_id: userId, item_id: target.itemId, variant: target.variant, quantity: newRewardQty },
      { onConflict: "user_id,item_id,variant" },
    );
    if (grantErr) {
      console.error("[crate-upgrade] reward grant failed", grantErr);
      await restoreFodder();
      return jsonError("Upgrade failed. Your item is safe.", 500);
    }

    rewardItemId = target.itemId;
    rewardVariant = target.variant;
  }

  // Best-effort audit log. Nothing financial hinges on this row - the coins
  // and inventory are already correct at this point - so a logging failure
  // is reported but does not roll back a result the player already has.
  const { error: logErr } = await supabase.from("crate_item_upgrades").insert({
    user_id: userId,
    from_item_id: itemId,
    from_variant: variant,
    from_sell_value: itemDef.sell_value,
    to_crate_type: target.crateType,
    to_rarity: target.rarity,
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
    // Where the outcome roll actually landed on the 0-100 bar - the win/lose
    // decision is already final by this point, so revealing it only lets the
    // client's marker animate to the exact spot that decided it, the same
    // way Her Patience reveals its real crash point after the fact.
    rollPercent: Math.round(outcomeRoll * 1000) / 10,
    rewardItemId,
    rewardVariant,
  });
}
