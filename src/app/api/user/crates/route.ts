import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import {
  CRATE_TYPES,
  SAMPLE_CRATE_ITEMS,
  getCrateIconUrl,
  getCrateItemImageUrl,
  type CrateItem,
  type CrateRarity,
  type UserCrateInventoryItem,
} from "@/lib/crates";

type CrateActionBody = {
  action?: "open" | "sell";
  crateType?: string;
  itemId?: string;
  variant?: string;
  quantity?: number;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function weightedRandom<T extends { weight: number }>(items: T[]): T | null {
  if (!items.length) return null;
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) return items[0] ?? null;

  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

async function getItemDefinition(supabase: ReturnType<typeof createSupabaseAdminClient>, itemId: string): Promise<CrateItem | null> {
  // In V1 we primarily use in-memory SAMPLE_CRATE_ITEMS for demo.
  // In production you would query the crate_items table here.
  const sample = SAMPLE_CRATE_ITEMS[itemId];
  if (sample) {
    const resolvedImage = getCrateItemImageUrl(itemId, (sample as any).image_url);
    return {
      item_id: itemId,
      ...sample,
      image_url: resolvedImage,
      enabled: true,
      variant: "normal",
    } as CrateItem;
  }

  // Fallback DB lookup (future-proof)
  const { data } = await supabase
    .from("crate_items")
    .select("*")
    .eq("item_id", itemId)
    .eq("enabled", true)
    .maybeSingle();

  if (data) {
    const resolvedImage = getCrateItemImageUrl(itemId, data.image_url);
    return {
      item_id: data.item_id,
      name: data.name,
      description: data.description ?? "",
      image_url: resolvedImage,
      rarity: data.rarity as CrateRarity,
      collection: data.collection,
      sell_value: data.sell_value ?? 0,
      enabled: data.enabled,
      metadata: data.metadata ?? {},
      variant: "normal",
    };
  }
  return null;
}

export async function GET() {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();

  if (authError || !authData.user) {
    return jsonError("Authentication required.", 401);
  }

  const supabase = createSupabaseAdminClient();
  const userId = authData.user.id;

  // Available crates (from in-memory config for V1)
  const availableCrates = Object.entries(CRATE_TYPES)
    .filter(([, def]) => def.enabled)
    .map(([crate_type, def]) => ({
      crate_type,
      name: def.name,
      description: def.description,
      cost: def.cost,
      icon_url: getCrateIconUrl(crate_type, (def as any).icon_url ?? null),
    }));

  // User's inventory (joined with sample data)
  const { data: invRows, error: invError } = await supabase
    .from("user_crate_inventory")
    .select("item_id, variant, quantity")
    .eq("user_id", userId);

  if (invError) {
    console.error("[crates] inventory load failed", invError);
    return jsonError("Failed to load inventory.", 500);
  }

  const inventory: UserCrateInventoryItem[] = [];
  for (const row of invRows ?? []) {
    const def = await getItemDefinition(supabase, row.item_id);
    if (def) {
      inventory.push({
        item_id: row.item_id,
        name: def.name,
        description: def.description,
        image_url: def.image_url,
        rarity: def.rarity,
        collection: def.collection,
        sell_value: def.sell_value,
        variant: row.variant ?? "normal",
        quantity: row.quantity,
      });
    }
  }

  // Sort by rarity then name for nice display
  inventory.sort((a, b) => {
    const ra = a.rarity;
    const rb = b.rarity;
    if (ra !== rb) {
      const order = ["common", "uncommon", "rare", "epic", "legendary"];
      return order.indexOf(ra) - order.indexOf(rb);
    }
    return a.name.localeCompare(b.name);
  });

  return Response.json({
    crates: availableCrates,
    inventory,
  });
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

  const body = (await request.json().catch(() => null)) as CrateActionBody | null;
  const action = body?.action;
  const userId = authData.user.id;

  const supabase = createSupabaseAdminClient();

  if (action === "open") {
    const crateType = body?.crateType;
    const crateDef = CRATE_TYPES[crateType ?? ""];

    if (!crateDef || !crateDef.enabled) {
      return jsonError("Invalid or disabled crate.", 422);
    }

    // Get current coins (for validation + tx)
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("coins")
      .eq("id", userId)
      .single();

    if (profileErr || !profile) {
      console.error("[crates] profile read failed for open", profileErr);
      return jsonError("Could not verify balance.", 500);
    }

    if (profile.coins < crateDef.cost) {
      return jsonError("Not enough coins to open this crate.", 422);
    }

    // === SERVER ROLLS THE RESULT (critical security point) ===
    const possibleDrops = crateDef.drops.map((d) => ({
      item_id: d.item_id,
      weight: d.weight,
      variant: d.variant ?? "normal",
    }));

    const rolled = weightedRandom(possibleDrops);
    if (!rolled) {
      return jsonError("Crate is empty. Contact support.", 500);
    }

    const wonItemDef = await getItemDefinition(supabase, rolled.item_id);
    if (!wonItemDef) {
      console.error("[crates] rolled unknown item", rolled.item_id);
      return jsonError("Crate configuration error.", 500);
    }

    const nextCoins = profile.coins - crateDef.cost;

    // Atomic: update coins + inventory quantity + tx + history
    const { error: coinUpdateErr } = await supabase
      .from("profiles")
      .update({ coins: nextCoins, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .eq("coins", profile.coins); // optimistic / race protection

    if (coinUpdateErr) {
      console.error("[crates] coin deduction failed", coinUpdateErr);
      return jsonError("Crate purchase failed (balance changed).", 409);
    }

    // Increment or insert inventory
    const { data: existingInv } = await supabase
      .from("user_crate_inventory")
      .select("quantity")
      .eq("user_id", userId)
      .eq("item_id", rolled.item_id)
      .eq("variant", rolled.variant)
      .maybeSingle();

    const newQty = (existingInv?.quantity ?? 0) + 1;

    const { error: invErr } = await supabase
      .from("user_crate_inventory")
      .upsert(
        {
          user_id: userId,
          item_id: rolled.item_id,
          variant: rolled.variant,
          quantity: newQty,
        },
        { onConflict: "user_id,item_id,variant" }
      );

    if (invErr) {
      console.error("[crates] inventory upsert failed after coin charge", invErr);
      // Best effort refund
      await supabase.from("profiles").update({ coins: profile.coins }).eq("id", userId);
      return jsonError("Failed to grant item. Coins refunded.", 500);
    }

    // Record negative coin transaction (crate purchase / sink)
    await supabase.from("coin_transactions").insert({
      user_id: userId,
      amount: -crateDef.cost,
      balance_before: profile.coins,
      balance_after: nextCoins,
      reason: "crate:open",
      metadata: {
        crate_type: crateType,
        item_id: rolled.item_id,
        variant: rolled.variant,
        rarity: wonItemDef.rarity,
      },
    });

    // Record history
    await supabase.from("crate_opens").insert({
      user_id: userId,
      crate_type: crateType,
      item_id: rolled.item_id,
      variant: rolled.variant,
      cost: crateDef.cost,
      received_sell_value: wonItemDef.sell_value,
    });

    return Response.json({
      success: true,
      result: {
        item: {
          item_id: wonItemDef.item_id,
          name: wonItemDef.name,
          description: wonItemDef.description,
          image_url: wonItemDef.image_url,
          rarity: wonItemDef.rarity,
          collection: wonItemDef.collection,
          sell_value: wonItemDef.sell_value,
          variant: rolled.variant,
        },
        newCoins: nextCoins,
      },
    });
  }

  if (action === "sell") {
    const itemId = body?.itemId;
    const variant = body?.variant ?? "normal";
    const qtyToSell = Math.max(1, Math.floor(body?.quantity ?? 1));

    if (!itemId) return jsonError("Missing item to sell.");

    const itemDef = await getItemDefinition(supabase, itemId);
    if (!itemDef || itemDef.sell_value <= 0) {
      return jsonError("This item cannot be sold or has no value.", 422);
    }

    // Verify current ownership quantity
    const { data: invRow, error: invErr } = await supabase
      .from("user_crate_inventory")
      .select("quantity")
      .eq("user_id", userId)
      .eq("item_id", itemId)
      .eq("variant", variant)
      .maybeSingle();

    if (invErr || !invRow || invRow.quantity < qtyToSell) {
      return jsonError("You do not own enough of this item.", 422);
    }

    // Get current coins
    const { data: profile } = await supabase
      .from("profiles")
      .select("coins")
      .eq("id", userId)
      .single();

    if (!profile) return jsonError("Profile not found.", 500);

    const totalSellValue = itemDef.sell_value * qtyToSell;
    const nextCoins = profile.coins + totalSellValue;
    const newQty = invRow.quantity - qtyToSell;

    // Update coins
    const { error: coinErr } = await supabase
      .from("profiles")
      .update({ coins: nextCoins, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .eq("coins", profile.coins);

    if (coinErr) {
      console.error("[crates] sell coin update failed", coinErr);
      return jsonError("Sale failed.", 500);
    }

    // Update or delete inventory row
    if (newQty > 0) {
      await supabase
        .from("user_crate_inventory")
        .update({ quantity: newQty })
        .eq("user_id", userId)
        .eq("item_id", itemId)
        .eq("variant", variant);
    } else {
      await supabase
        .from("user_crate_inventory")
        .delete()
        .eq("user_id", userId)
        .eq("item_id", itemId)
        .eq("variant", variant);
    }

    // Positive coin transaction for the sale
    await supabase.from("coin_transactions").insert({
      user_id: userId,
      amount: totalSellValue,
      balance_before: profile.coins,
      balance_after: nextCoins,
      reason: "crate:sell",
      metadata: {
        item_id: itemId,
        variant,
        quantity: qtyToSell,
        rarity: itemDef.rarity,
      },
    });

    // Optional history (we can reuse crate_opens or make a sell event, but for V1 this is fine)
    await supabase.from("crate_opens").insert({
      user_id: userId,
      crate_type: "sell",
      item_id: itemId,
      variant,
      cost: 0,
      received_sell_value: totalSellValue,
    });

    return Response.json({
      success: true,
      sold: {
        item_id: itemId,
        variant,
        quantity: qtyToSell,
        value: totalSellValue,
      },
      newCoins: nextCoins,
    });
  }

  return jsonError("Invalid action.");
}
