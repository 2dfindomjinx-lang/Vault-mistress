import { ALL_LEGENDARY_ITEM_IDS, getCrateItemImageUrl, SAMPLE_CRATE_ITEMS } from "@/lib/crates";
import { getFastUser } from "@/lib/supabase/fast-auth";
import { getMoneyBuybackAmount, getMoneyShopPrice, type MoneyShopEntry } from "@/lib/principessa-money";
import { profileSelect } from "@/lib/profile-columns";
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

// `fast` skips the Auth server round trip (see fast-auth.ts); GET only.
async function requireUser(fast = false) {
  const authSupabase = await createSupabaseServerClient();
  if (fast) return (await getFastUser(authSupabase))?.id ?? null;
  const { data, error } = await authSupabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

export async function GET() {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const userId = await requireUser(true);
  if (!userId) return jsonError("Authentication required.", 401);

  const supabase = createSupabaseAdminClient();
  const { data: inventory } = await supabase
    .from("user_crate_inventory")
    .select("item_id, quantity, pm_quantity")
    .eq("user_id", userId)
    .eq("variant", "normal");

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

  const body = (await request.json().catch(() => null)) as { action?: string; itemId?: string; requestId?: string } | null;
  if (body?.action !== "buy" && body?.action !== "sell") {
    return jsonError("Invalid Money Shop action.", 422);
  }
  if (typeof body.requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.requestId)) return jsonError("Refresh the page and try again.", 422);
  const action = body.action;
  const itemId = typeof body?.itemId === "string" ? body.itemId : "";
  const item = getShopItem(itemId);
  if (!item) return jsonError("That item is not sold here.", 404);

  const supabase = createSupabaseAdminClient();
  const limit = await checkRateLimit(supabase, `money-shop:${userId}`, 20, 60);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  const pricePm = getMoneyShopPrice(item.sell_value);
  const refundPm = getMoneyBuybackAmount(pricePm);

  const { data, error } = await supabase.rpc("execute_money_shop", {
    p_user_id: userId, p_request_id: body.requestId, p_action: action,
    p_item_id: itemId, p_price_pm: pricePm, p_refund_pm: refundPm,
  });
  if (error) {
    console.error("[money-shop] transaction failed", error);
    return jsonError("Purchase status unavailable. Retry to check the same request.", 503);
  }
  const result = data as { error?: string; success?: boolean; pricePm?: number; refundPm?: number } | null;
  if (result?.error === "insufficient_money") return jsonError("Not enough Principessa Money.", 402);
  if (result?.error === "no_shop_copy") return jsonError("You have no shop-bought copy to return.", 409);
  if (result?.error) return jsonError("That request could not be completed.", 409);
  if (!result?.success) return jsonError("Purchase status unavailable. Retry to check the same request.", 503);
  // Always read current state, including on replay. A receipt must not rewind a
  // balance/inventory changed by another tab since the original transaction.
  const [profile, inventory] = await Promise.all([
    supabase.from("profiles").select(profileSelect).eq("id", userId).single(),
    supabase.from("user_crate_inventory").select("quantity, pm_quantity")
      .eq("user_id", userId).eq("item_id", itemId).eq("variant", "normal").maybeSingle(),
  ]);
  if (profile.error || inventory.error || !profile.data) return jsonError("Your receipt is saved. Retry to refresh your balance.", 503);
  return Response.json({ ...result, profile: profile.data,
    ownedInInventory: inventory.data?.quantity ?? 0, ownedFromShop: inventory.data?.pm_quantity ?? 0,
  }, { headers: { "Cache-Control": "no-store" } });
}
