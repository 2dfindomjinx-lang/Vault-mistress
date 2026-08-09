import { ALL_LEGENDARY_ITEM_IDS, getCrateItemImageUrl, SAMPLE_CRATE_ITEMS } from "@/lib/crates";
import { getMoneyBuybackAmount, getMoneyShopPrice, type MoneyShopEntry } from "@/lib/principessa-money";
import { profileSelect } from "@/lib/server-game-rules";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

// The catalogue is derived, never client-supplied: the price of an item is
// always recomputed from its own sell_value here, so a tampered request cannot
// name its own price.
//
// COUPLING: the legendary-only filter is load-bearing. The bulk sell paths in
// src/app/api/user/crates/route.ts (sell_all, sell_many, sell_duplicates) all
// skip legendaries outright, which is the only reason they cannot liquidate a
// PM-bought copy for coins. If this catalogue is ever widened past legendary,
// those three paths need the same pm_quantity guard the single-item sell has.
// SAMPLE_CRATE_ITEMS values omit item_id/enabled (they are keyed by id and
// implicitly enabled), so the id is threaded back on here.
function getShopItem(itemId: string) {
  const item = SAMPLE_CRATE_ITEMS[itemId];
  if (!item || item.rarity !== "legendary" || item.sell_value <= 0) {
    return null;
  }
  return { ...item, item_id: itemId };
}

async function requireUser() {
  const authSupabase = await createSupabaseServerClient();
  const { data, error } = await authSupabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

export async function GET() {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const userId = await requireUser();
  if (!userId) return jsonError("Authentication required.", 401);

  const supabase = createSupabaseAdminClient();
  const { data: inventory } = await supabase
    .from("user_crate_inventory")
    .select("item_id, quantity, pm_quantity")
    .eq("user_id", userId);

  const ownedFromShop = new Map<string, number>();
  const ownedInInventory = new Map<string, number>();
  for (const row of (inventory ?? []) as Array<{ item_id: string; quantity: number | null; pm_quantity: number | null }>) {
    ownedFromShop.set(row.item_id, Math.max(0, Number(row.pm_quantity) || 0));
    ownedInInventory.set(row.item_id, Math.max(0, Number(row.quantity) || 0));
  }

  const entries: MoneyShopEntry[] = ALL_LEGENDARY_ITEM_IDS.map((itemId) => getShopItem(itemId))
    .filter((item): item is NonNullable<ReturnType<typeof getShopItem>> => Boolean(item))
    .map((item) => {
      const pricePm = getMoneyShopPrice(item.sell_value);
      return {
        buybackPm: getMoneyBuybackAmount(pricePm),
        imageUrl: getCrateItemImageUrl(item.item_id, item.image_url),
        itemId: item.item_id,
        name: item.name,
        ownedFromShop: ownedFromShop.get(item.item_id) ?? 0,
        pricePm,
        rarity: item.rarity,
        sellValueCoins: item.sell_value,
        ownedInInventory: ownedInInventory.get(item.item_id) ?? 0,
      };
    })
    .sort((left, right) => left.pricePm - right.pricePm || left.name.localeCompare(right.name));

  return Response.json({ items: entries }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const userId = await requireUser();
  if (!userId) return jsonError("Authentication required.", 401);

  const body = (await request.json().catch(() => null)) as { action?: string; itemId?: string } | null;
  if (body?.action !== "buy" && body?.action !== "sell") {
    return jsonError("Invalid Money Shop action.", 422);
  }
  const action = body.action;
  const itemId = typeof body?.itemId === "string" ? body.itemId : "";
  const item = getShopItem(itemId);
  if (!item) return jsonError("That item is not sold here.", 404);

  const supabase = createSupabaseAdminClient();
  const limit = await checkRateLimit(supabase, `money-shop:${userId}`, 20, 60);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  const pricePm = getMoneyShopPrice(item.sell_value);
  const refundPm = getMoneyBuybackAmount(pricePm);

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select(profileSelect)
    .eq("id", userId)
    .single();

  if (profileError || !profileData) {
    return jsonError(profileError?.message ?? "Profile not found.", 404);
  }

  const money = Math.max(0, Math.floor(Number((profileData as unknown as { principessa_money: number }).principessa_money) || 0));

  const { data: inventoryRow } = await supabase
    .from("user_crate_inventory")
    .select("id, quantity, pm_quantity")
    .eq("user_id", userId)
    .eq("item_id", itemId)
    .eq("variant", "normal")
    .maybeSingle();

  const current = inventoryRow as { id: string; pm_quantity: number | null; quantity: number } | null;
  const currentQuantity = Math.max(0, Number(current?.quantity) || 0);
  const currentPmQuantity = Math.max(0, Number(current?.pm_quantity) || 0);

  if (action === "sell") {
    if (currentPmQuantity < 1) {
      return jsonError("You have no shop-bought copy of this item to return.", 409);
    }

    const nextMoney = money + refundPm;
    // Inventory first: if the PM credit fails afterwards we roll the row back,
    // whereas crediting first and failing here would mint PM out of nothing.
    const nextQuantity = currentQuantity - 1;
    const nextPmQuantity = currentPmQuantity - 1;

    const inventoryUpdate =
      nextQuantity <= 0
        ? await supabase
            .from("user_crate_inventory")
            .delete()
            .eq("id", current!.id)
            .eq("quantity", currentQuantity)
            .eq("pm_quantity", currentPmQuantity)
            .select("id")
            .maybeSingle()
        : await supabase
            .from("user_crate_inventory")
            .update({ pm_quantity: nextPmQuantity, quantity: nextQuantity })
            .eq("id", current!.id)
            .eq("quantity", currentQuantity)
            .eq("pm_quantity", currentPmQuantity)
            .select("id")
            .maybeSingle();

    if (inventoryUpdate.error || !inventoryUpdate.data) {
      return jsonError(inventoryUpdate.error?.message ?? "Inventory changed, try again.", inventoryUpdate.error ? 500 : 409);
    }

    const { data: updatedProfile, error: updateError } = await supabase
      .from("profiles")
      .update({ principessa_money: nextMoney, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .eq("principessa_money", money)
      .select(profileSelect)
      .maybeSingle();

    if (updateError || !updatedProfile) {
      // Put the copy back so the user is not left with neither item nor refund.
      await supabase.from("user_crate_inventory").upsert(
        { item_id: itemId, pm_quantity: currentPmQuantity, quantity: currentQuantity, user_id: userId, variant: "normal" },
        { onConflict: "user_id,item_id,variant" },
      );
      return jsonError(updateError?.message ?? "Balance changed, try again.", updateError ? 500 : 409);
    }

    const { error: transactionError } = await supabase.from("money_transactions").insert({
      amount: refundPm,
      balance_after: nextMoney,
      balance_before: money,
      metadata: { itemId, pricePm },
      reason: "money-shop:buyback",
      user_id: userId,
    });

    if (transactionError) {
      await supabase
        .from("profiles")
        .update({ principessa_money: money, updated_at: new Date().toISOString() })
        .eq("id", userId)
        .eq("principessa_money", nextMoney);
      await supabase.from("user_crate_inventory").upsert(
        { item_id: itemId, pm_quantity: currentPmQuantity, quantity: currentQuantity, user_id: userId, variant: "normal" },
        { onConflict: "user_id,item_id,variant" },
      );
      return jsonError("Buyback logging failed; nothing was changed.", 500);
    }

    return Response.json({ profile: updatedProfile, refundPm });
  }

  if (money < pricePm) {
    return jsonError(`This costs ${pricePm.toLocaleString()} Principessa Money.`, 402);
  }

  const nextMoney = money - pricePm;
  const { data: updatedProfile, error: updateError } = await supabase
    .from("profiles")
    .update({ principessa_money: nextMoney, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .eq("principessa_money", money)
    .select(profileSelect)
    .maybeSingle();

  if (updateError || !updatedProfile) {
    return jsonError(updateError?.message ?? "Balance changed, try again.", updateError ? 500 : 409);
  }

  const { error: inventoryError } = await supabase.from("user_crate_inventory").upsert(
    {
      item_id: itemId,
      pm_quantity: currentPmQuantity + 1,
      quantity: currentQuantity + 1,
      user_id: userId,
      variant: "normal",
    },
    { onConflict: "user_id,item_id,variant" },
  );

  if (inventoryError) {
    await supabase
      .from("profiles")
      .update({ principessa_money: money, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .eq("principessa_money", nextMoney);
    return jsonError("Purchase failed, nothing was charged.", 500);
  }

  const { error: transactionError } = await supabase.from("money_transactions").insert({
    amount: -pricePm,
    balance_after: nextMoney,
    balance_before: money,
    metadata: { itemId, sellValueCoins: item.sell_value },
    reason: "money-shop:purchase",
    user_id: userId,
  });

  if (transactionError) {
    await supabase
      .from("profiles")
      .update({ principessa_money: money, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .eq("principessa_money", nextMoney);
    await supabase.from("user_crate_inventory").upsert(
      { item_id: itemId, pm_quantity: currentPmQuantity, quantity: currentQuantity, user_id: userId, variant: "normal" },
      { onConflict: "user_id,item_id,variant" },
    );
    return jsonError("Purchase logging failed; nothing was changed.", 500);
  }

  return Response.json({ pricePm, profile: updatedProfile });
}
