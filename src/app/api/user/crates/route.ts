import { randomInt } from "node:crypto";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import {
  CRATE_TYPES,
  PRINCIPESSA_PITY_CRATE,
  PRINCIPESSA_PITY_THRESHOLD,
  SAMPLE_CRATE_ITEMS,
  getCrateIconUrl,
  getCrateItemImageUrl,
  isBulkSellProtectedRarity,
  isPityResettingRarity,
  type CrateItem,
  type CrateRarity,
  type UserCrateInventoryItem,
} from "@/lib/crates";
import {
  getAdjustedCrateDrops,
  getCrateCostMultiplier,
  hasFreeCrateOpen,
} from "@/lib/crate-events";
import { getGmt3DayBounds } from "@/lib/time";
import type { EventEffect } from "@/lib/events";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const MAX_CRATE_BATCH_OPEN = 5;

type CrateActionBody = {
  action?: "open" | "sell" | "sell_all" | "sell_many" | "sell_duplicates";
  crateType?: string;
  itemId?: string;
  variant?: string;
  quantity?: number;
  items?: Array<{
    itemId?: string;
    variant?: string;
    quantity?: number;
  }>;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

async function getCrateOpenCredits(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
) {
  const { data, error } = await supabase
    .from("user_crate_open_grants")
    .select("crate_type, remaining_opens")
    .eq("user_id", userId)
    .gt("remaining_opens", 0);

  if (error) {
    console.error("[crates] open grant lookup failed", error);
    return {} as Record<string, number>;
  }

  return (data ?? []).reduce<Record<string, number>>((totals, row) => {
    const crateType = typeof row.crate_type === "string" ? row.crate_type : "";
    if (!crateType) {
      return totals;
    }

    totals[crateType] = (totals[crateType] ?? 0) + Math.max(0, Number(row.remaining_opens ?? 0));
    return totals;
  }, {});
}

function getCrateBatchPricing(
  crateCost: number,
  quantity: number,
  activeEvents: Array<{ effect: EventEffect }>,
  freeOpenUsedToday: boolean,
  grantedOpenCount: number,
  crateType?: string,
) {
  const safeQuantity = Math.max(1, Math.floor(quantity));
  const grantApplied = Math.min(safeQuantity, Math.max(0, Math.floor(grantedOpenCount)));
  const remainingAfterGrants = Math.max(0, safeQuantity - grantApplied);
  const eventFreeApplied = hasFreeCrateOpen(activeEvents, crateType) && !freeOpenUsedToday && remainingAfterGrants > 0;
  const paidQuantity = Math.max(0, remainingAfterGrants - (eventFreeApplied ? 1 : 0));
  const openCost = Math.round(crateCost * getCrateCostMultiplier(activeEvents, crateType));

  return {
    batchCost: openCost * paidQuantity,
    eventFreeApplied,
    grantApplied,
  };
}

async function getActiveEvents(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("random_events")
    .select("id, effect")
    .eq("active", true)
    .lte("starts_at", now)
    .gt("ends_at", now);

  if (error) {
    console.error("[crates] active event lookup failed", error);
    return [] as Array<{ id: string; effect: EventEffect }>;
  }

  return (data ?? []) as Array<{ id: string; effect: EventEffect }>;
}

async function getFreeOpenUsageToday(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
) {
  const { start, end } = getGmt3DayBounds();
  const { data, error } = await supabase
    .from("crate_opens")
    .select("crate_type, cost")
    .eq("cost", 0)
    .eq("user_id", userId)
    .gte("opened_at", start.toISOString())
    .lt("opened_at", end.toISOString());

  if (error) {
    console.error("[crates] daily crate usage lookup failed", error);
    return {} as Record<string, boolean>;
  }

  const used = new Set(
    (data ?? [])
      .filter((row) => (row.cost ?? 0) === 0)
      .map((row) => row.crate_type as string),
  );

  return Object.fromEntries(Object.keys(CRATE_TYPES).map((crateType) => [crateType, used.has(crateType)]));
}

function weightedRandom<T extends { weight: number }>(items: T[]): T | null {
  if (!items.length) return null;
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) return items[0] ?? null;

  let r = (randomInt(0, 2 ** 47) / 2 ** 47) * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

// Seed only actual winning definitions, without overwriting existing catalog metadata.
async function ensureOpeningItems(supabase: ReturnType<typeof createSupabaseAdminClient>, itemIds: string[]) {
  const rows = [...new Set(itemIds)].flatMap(itemId => {
    const item = SAMPLE_CRATE_ITEMS[itemId];
    return item ? [{ item_id: itemId, name: item.name, description: item.description ?? "", image_url: getCrateItemImageUrl(itemId, item.image_url), rarity: item.rarity, collection: item.collection ?? null, sell_value: item.sell_value, enabled: true, metadata: {} }] : [];
  });
  if (!rows.length) return null;
  const { error } = await supabase.from("crate_items").upsert(rows, { onConflict: "item_id", ignoreDuplicates: true });
  return error;
}

async function settleCrateSale(supabase: ReturnType<typeof createSupabaseAdminClient>, userId: string, expectedCoins: number, items: Array<{ item_id: string; variant: string; quantity: number; value: number; expectedQuantity: number }>, reason: string) {
  const { data, error } = await supabase.rpc("commit_crate_sale", { p_user_id: userId, p_expected_coins: expectedCoins, p_items: items, p_reason: reason });
  if (error) { console.error("[crates] sale transaction unavailable", error); return jsonError("Sale could not be confirmed. Refresh your inventory.", 503); }
  if (!data?.success) return jsonError("Your balance or inventory changed. Refresh before selling.", 409);
  return null;
}

async function getItemDefinition(supabase: ReturnType<typeof createSupabaseAdminClient>, itemId: string): Promise<CrateItem | null> {
  // In V1 we primarily use in-memory SAMPLE_CRATE_ITEMS for demo.
  // In production you would query the crate_items table here.
  const sample = SAMPLE_CRATE_ITEMS[itemId];
  if (sample) {
    const resolvedImage = getCrateItemImageUrl(itemId, sample.image_url);
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

async function openCrateBatch(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  crateType: string,
  quantity: number,
) {
  if (quantity < 1 || quantity > MAX_CRATE_BATCH_OPEN) {
    return jsonError(`You can open at most ${MAX_CRATE_BATCH_OPEN} crates at once.`, 422);
  }

  const crateDef = CRATE_TYPES[crateType];

  if (!crateDef || !crateDef.enabled) {
    return jsonError("Invalid or disabled crate.", 422);
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("coins, principessa_case_bad_luck_count")
    .eq("id", userId)
    .single();

  if (profileErr || !profile) {
    console.error("[crates] profile read failed for batch open", profileErr);
    return jsonError("Could not verify balance.", 500);
  }

  const [activeEvents, freeOpensUsedToday, grantPreview] = await Promise.all([getActiveEvents(supabase), getFreeOpenUsageToday(supabase, userId), getCrateOpenCredits(supabase, userId)]);
  const grantedOpenPreview = grantPreview[crateType] ?? 0;
  const pricing = getCrateBatchPricing(
    crateDef.cost,
    quantity,
    activeEvents,
    freeOpensUsedToday[crateType],
    grantedOpenPreview,
    crateType,
  );
  const batchCost = pricing.batchCost;

  if (profile.coins < batchCost) {
    return jsonError("Not enough coins to open this crate.", 422);
  }

  const grantApplied = pricing.grantApplied;

  const finalPricing = getCrateBatchPricing(
    crateDef.cost,
    quantity,
    activeEvents,
    freeOpensUsedToday[crateType],
    grantApplied,
    crateType,
  );
  const finalBatchCost = finalPricing.batchCost;

  if (profile.coins < finalBatchCost) {
    return jsonError("Not enough coins to open this crate.", 422);
  }

  const possibleDrops = getAdjustedCrateDrops(crateType, activeEvents).map((drop) => ({
    item_id: drop.item_id,
    weight: drop.weight,
    variant: drop.variant ?? "normal",
  }));

  const results: Array<{ item_id: string; variant: string }> = [];
  let principessaBadLuck = profile.principessa_case_bad_luck_count ?? 0;

  for (let i = 0; i < quantity; i += 1) {
    const isPrincipessaPity = crateType === PRINCIPESSA_PITY_CRATE && principessaBadLuck >= PRINCIPESSA_PITY_THRESHOLD;

    let rolled = weightedRandom(possibleDrops);
    if (!rolled) {
      return jsonError("Crate is empty. Contact support.", 500);
    }

    if (isPrincipessaPity) {
      const tempDef = SAMPLE_CRATE_ITEMS[rolled.item_id];
      if (tempDef?.rarity !== "legendary") {
        const epicOnly = possibleDrops.filter((drop) => SAMPLE_CRATE_ITEMS[drop.item_id]?.rarity === "epic");
        rolled = weightedRandom(epicOnly.length ? epicOnly : possibleDrops) ?? rolled;
      }
    }

    results.push({
      item_id: rolled.item_id,
      variant: rolled.variant ?? "normal",
    });

    const resultRarity = SAMPLE_CRATE_ITEMS[rolled.item_id]?.rarity;
    if (crateType === PRINCIPESSA_PITY_CRATE) {
      principessaBadLuck = isPityResettingRarity(resultRarity) ? 0 : principessaBadLuck + 1;
    }
  }

  const uniqueItemIds = Array.from(new Set(results.map((entry) => entry.item_id)));
  const defs = await Promise.all(uniqueItemIds.map((itemId) => getItemDefinition(supabase, itemId)));
  const defMap = new Map(
    defs.filter((def): def is CrateItem => Boolean(def)).map((def) => [def.item_id, def]),
  );

  const nextCoins = profile.coins - finalBatchCost;
  const seedError = await ensureOpeningItems(supabase, results.map(result => result.item_id));
  if (seedError) return jsonError("Crate items could not be prepared. Try again.", 503);
  const { data: committed, error: commitError } = await supabase.rpc("commit_crate_open_with_keys", {
    p_user_id: userId, p_crate_type: crateType, p_expected_coins: profile.coins,
    p_expected_pity: profile.principessa_case_bad_luck_count ?? 0,
    p_next_pity: principessaBadLuck, p_cost: finalBatchCost,
    p_items: results.map((result) => ({ itemId: result.item_id, variant: result.variant, sellValue: defMap.get(result.item_id)?.sell_value ?? 0 })),
    p_metadata: {
      crate_type: crateType, quantity, batch: true,
      community_goal_keys_used: grantApplied, free_open_applied: finalPricing.eventFreeApplied,
      item_ids: results.map((result) => result.item_id),
    },
  });
  if (commitError || !committed?.success) {
    console.error("[crates] batch transaction failed", commitError ?? committed?.error);
    return jsonError("Crate purchase could not be completed. Refresh and try again.", commitError ? 503 : 409);
  }

  return Response.json({
    success: true,
    result: {
      items: results.map((result) => {
        const def = defMap.get(result.item_id);
        return {
          item_id: result.item_id,
          name: def?.name ?? result.item_id,
          description: def?.description ?? "",
          image_url: def?.image_url ?? null,
          rarity: def?.rarity ?? "common",
          collection: def?.collection ?? null,
          sell_value: def?.sell_value ?? 0,
          variant: result.variant,
        };
      }),
      newCoins: nextCoins,
    },
    community_goal_keys_used: grantApplied,
    free_open_applied: finalPricing.eventFreeApplied,
    pity: {
      principessa_bad_luck: principessaBadLuck,
    },
  });
}

function buildInventoryKey(itemId: string, variant: string) {
  return `${itemId}:${variant}`;
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
      icon_url: getCrateIconUrl(crate_type, def.icon_url ?? null),
    }))
    .sort((a, b) => a.cost - b.cost);

  // Independent reads share the same wait instead of four network round trips.
  const [
    { data: invRows, error: invError },
    { data: pityProfile },
    freeOpensUsedToday,
    crateOpenCredits,
  ] = await Promise.all([
    supabase.from("user_crate_inventory").select("item_id, variant, quantity").eq("user_id", userId),
    supabase.from("profiles").select("principessa_case_bad_luck_count").eq("id", userId).single(),
    getFreeOpenUsageToday(supabase, userId),
    getCrateOpenCredits(supabase, userId),
  ]);

  if (invError) {
    console.error("[crates] inventory load failed", invError);
    return jsonError("Failed to load inventory.", 500);
  }

  const classicRow = invRows?.find(
    (row) => row.item_id === "classic" && (row.variant ?? "normal") === "normal",
  );
  if (!classicRow) {
    const classicDef = await getItemDefinition(supabase, "classic");
    if (classicDef) {
      const { error: restoreClassicErr } = await supabase.from("user_crate_inventory").insert({
        user_id: userId,
        item_id: "classic",
        quantity: 1,
        variant: "normal",
      });

      if (restoreClassicErr && restoreClassicErr.code !== "23505") {
        console.error("[crates] classic restore failed", restoreClassicErr);
      } else if (!restoreClassicErr) {
        invRows?.push({ item_id: "classic", variant: "normal", quantity: 1 });
      }
    }
  } else if (classicRow.quantity > 1) {
    const { error: clampClassicErr } = await supabase
      .from("user_crate_inventory")
      .update({ quantity: 1 })
      .eq("user_id", userId)
      .eq("item_id", "classic")
      .eq("variant", "normal");

    if (clampClassicErr) {
      console.error("[crates] classic quantity clamp failed", clampClassicErr);
    } else {
      classicRow.quantity = 1;
    }
  }

  // Custom DB items are fetched once, including inventories with many variants.
  const unknownIds = [...new Set((invRows ?? []).map((row) => row.item_id as string))]
    .filter((id) => !SAMPLE_CRATE_ITEMS[id]);
  const { data: customItems, error: customError } = unknownIds.length
    ? await supabase.from("crate_items")
      .select("item_id, name, description, image_url, rarity, collection, sell_value")
      .in("item_id", unknownIds).eq("enabled", true)
    : { data: [], error: null };
  if (customError) return jsonError("Failed to load inventory details.", 500);
  const customById = new Map((customItems ?? []).map((item) => [item.item_id, item]));

  const inventory: UserCrateInventoryItem[] = [];
  for (const row of invRows ?? []) {
    const def = SAMPLE_CRATE_ITEMS[row.item_id] ?? customById.get(row.item_id);
    if (def) {
      inventory.push({
        item_id: row.item_id,
        name: def.name,
        description: def.description ?? "",
        image_url: getCrateItemImageUrl(row.item_id, def.image_url),
        rarity: def.rarity,
        collection: def.collection,
        sell_value: def.sell_value ?? 0,
        variant: row.variant ?? "normal",
        quantity: row.quantity,
      });
    }
  }

  // Sort by rarity then name for nice display, but keep classic pinned first.
  inventory.sort((a, b) => {
    if (a.item_id === "classic" && b.item_id !== "classic") return -1;
    if (b.item_id === "classic" && a.item_id !== "classic") return 1;

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
    pity: {
      principessa_bad_luck: pityProfile?.principessa_case_bad_luck_count ?? 0,
    },
    free_opens_used_today: freeOpensUsedToday,
    crate_open_credits: crateOpenCredits,
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
    const rateLimit = await checkRateLimit(supabase, `crate-open:${userId}`, 30, 60);
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.retryAfterSeconds);
    }

    const crateType = body?.crateType;
    const crateDef = CRATE_TYPES[crateType ?? ""];

    if (!crateDef || !crateDef.enabled) {
      return jsonError("Invalid or disabled crate.", 422);
    }
    const resolvedCrateType = crateType as keyof typeof CRATE_TYPES;
    const quantity = Math.max(1, Math.floor(body?.quantity ?? 1));

    if (quantity > MAX_CRATE_BATCH_OPEN) {
      return jsonError(`You can open at most ${MAX_CRATE_BATCH_OPEN} crates at once.`, 422);
    }

    if (quantity > 1) {
      return openCrateBatch(supabase, userId, resolvedCrateType, quantity);
    }

    // Get current coins (for validation + tx) + pity counters
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("coins, principessa_case_bad_luck_count")
      .eq("id", userId)
      .single();

    if (profileErr || !profile) {
      console.error("[crates] profile read failed for open", profileErr);
      return jsonError("Could not verify balance.", 500);
    }

    const principessaBadLuck = profile.principessa_case_bad_luck_count ?? 0;
    const [activeEvents, freeOpensUsedToday, grantPreview] = await Promise.all([getActiveEvents(supabase), getFreeOpenUsageToday(supabase, userId), getCrateOpenCredits(supabase, userId)]);
    const pricing = getCrateBatchPricing(
      crateDef.cost,
      1,
      activeEvents,
      freeOpensUsedToday[resolvedCrateType],
      grantPreview[resolvedCrateType] ?? 0,
      resolvedCrateType,
    );
    const openCost = pricing.batchCost;

    if (profile.coins < openCost) {
      return jsonError("Not enough coins to open this crate.", 422);
    }

    const grantApplied = pricing.grantApplied;

    const finalPricing = getCrateBatchPricing(
      crateDef.cost,
      1,
      activeEvents,
      freeOpensUsedToday[resolvedCrateType],
      grantApplied,
      resolvedCrateType,
    );
    const finalOpenCost = finalPricing.batchCost;

    if (profile.coins < finalOpenCost) {
      return jsonError("Not enough coins to open this crate.", 422);
    }

    // === SERVER ROLLS THE RESULT (critical security point) ===
    // Pity systems applied here (server authoritative)
    const possibleDrops = getAdjustedCrateDrops(resolvedCrateType, activeEvents).map((d) => ({
      item_id: d.item_id,
      weight: d.weight,
      variant: d.variant ?? "normal",
    }));

    let rolled;
    const isPrincipessaPity = crateType === PRINCIPESSA_PITY_CRATE && principessaBadLuck >= PRINCIPESSA_PITY_THRESHOLD;

    if (isPrincipessaPity) {
      // Bad luck protection: 
      // - First roll normally to preserve the base legendary chance (e.g. 0.5%)
      // - If it landed on legendary → keep it
      // - Otherwise force Epic (so 99.5% epic + 0.5% legendary on pity opening)
      const tempRolled = weightedRandom(possibleDrops);
      if (!tempRolled) {
        return jsonError("Crate is empty. Contact support.", 500);
      }
      const tempDef = SAMPLE_CRATE_ITEMS[tempRolled.item_id];
      if (tempDef && tempDef.rarity === "legendary") {
        rolled = tempRolled;
      } else {
        const epicOnly = possibleDrops.filter((d) => {
          const def = SAMPLE_CRATE_ITEMS[d.item_id];
          return def && def.rarity === "epic";
        });
        rolled = weightedRandom(epicOnly.length ? epicOnly : possibleDrops);
      }
    } else {
      rolled = weightedRandom(possibleDrops);
    }

    if (!rolled) {
      return jsonError("Crate is empty. Contact support.", 500);
    }

    const wonItemDef = await getItemDefinition(supabase, rolled.item_id);
    if (!wonItemDef) {
      console.error("[crates] rolled unknown item", rolled.item_id);
      return jsonError("Crate configuration error.", 500);
    }

    const seedError = await ensureOpeningItems(supabase, [rolled.item_id]);
    if (seedError) return jsonError("Crate items could not be prepared. Try again.", 503);

    const nextCoins = profile.coins - finalOpenCost;
    const resultRarity = wonItemDef.rarity;
    const updatedBadLuck = resolvedCrateType === PRINCIPESSA_PITY_CRATE
      ? (isPityResettingRarity(resultRarity) ? 0 : principessaBadLuck + 1)
      : principessaBadLuck;
    const { data: committed, error: commitError } = await supabase.rpc("commit_crate_open_with_keys", {
      p_user_id: userId, p_crate_type: resolvedCrateType, p_expected_coins: profile.coins,
      p_expected_pity: principessaBadLuck, p_next_pity: updatedBadLuck, p_cost: finalOpenCost,
      p_items: [{ itemId: rolled.item_id, variant: rolled.variant, sellValue: wonItemDef.sell_value }],
      p_metadata: {
        crate_type: resolvedCrateType, item_id: rolled.item_id, variant: rolled.variant, rarity: wonItemDef.rarity,
        community_goal_keys_used: grantApplied, free_open_applied: finalPricing.eventFreeApplied,
      },
    });
    if (commitError || !committed?.success) {
      console.error("[crates] open transaction failed", commitError ?? committed?.error);
      return jsonError("Crate purchase could not be completed. Refresh and try again.", commitError ? 503 : 409);
    }

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
      community_goal_keys_used: grantApplied,
      free_open_applied: finalPricing.eventFreeApplied,
      pity: {
        principessa_bad_luck: updatedBadLuck,
      },
    });
  }

  // One bucket for every sell variant. The per-row conflict guards make a
  // double sale fail rather than pay out, but they only work if the attacker
  // cannot fire the racing requests by the hundred, and no legitimate client
  // sells faster than this.
  if (action === "sell" || action === "sell_all" || action === "sell_many" || action === "sell_duplicates") {
    const sellRateLimit = await checkRateLimit(supabase, `crate-sell:${userId}`, 20, 60);
    if (!sellRateLimit.allowed) {
      return rateLimitResponse(sellRateLimit.retryAfterSeconds);
    }
  }

  if (action === "sell") {
    const itemId = body?.itemId;
    const variant = body?.variant ?? "normal";
    const qtyToSell = Math.max(1, Math.floor(body?.quantity ?? 1));

    if (!itemId) return jsonError("Missing item to sell.");

    const itemDef = await getItemDefinition(supabase, itemId);
    if (!itemDef || itemDef.sell_value <= 0 || itemId === "classic") {
      return jsonError("This item cannot be sold or has no value.", 422);
    }

    // Verify current ownership quantity
    const { data: invRow, error: invErr } = await supabase
      .from("user_crate_inventory")
      .select("quantity, pm_quantity")
      .eq("user_id", userId)
      .eq("item_id", itemId)
      .eq("variant", variant)
      .maybeSingle();

    if (invErr || !invRow || invRow.quantity < qtyToSell) {
      return jsonError("You do not own enough of this item.", 422);
    }

    // Copies bought with Principessa Money are excluded from the coin sell
    // path on purpose: they buy back to PM at 70% via /api/user/money-shop.
    // Letting them liquidate for coins here would make the shop a cheaper,
    // unmetered PM -> Coin exchange that bypasses the conversion route.
    const pmQuantity = Math.max(0, Number(invRow.pm_quantity) || 0);
    const coinSellableQuantity = Math.max(0, invRow.quantity - pmQuantity);
    if (coinSellableQuantity < qtyToSell) {
      return jsonError(
        pmQuantity > 0
          ? "Shop-bought copies return Principessa Money, not coins. Sell them from the Money Shop."
          : "You do not own enough of this item.",
        422,
      );
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

    const saleError = await settleCrateSale(supabase, userId, profile.coins, [{ item_id: itemId, variant, quantity: qtyToSell, value: totalSellValue, expectedQuantity: invRow.quantity }], "crate:sell");
    if (saleError) return saleError;

    return Response.json({
      success: true,
      sold: {
        item_id: itemId,
        variant,
        quantity: qtyToSell,
        value: totalSellValue,
      },
      inventoryChanges: [{ item_id: itemId, variant, quantity: newQty }],
      newCoins: nextCoins,
    });
  }

  // Selection is followed by one atomic inventory/wallet/ledger settlement.
  if (action === "sell_all") {
    // Fetch user's current full inventory
    const { data: invRows, error: invErr } = await supabase
      .from("user_crate_inventory")
      .select("item_id, variant, quantity")
      .eq("user_id", userId);

    if (invErr) {
      console.error("[crates] sell_all inventory read failed", invErr);
      return jsonError("Failed to read inventory.", 500);
    }

    // Get current coins
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("coins")
      .eq("id", userId)
      .single();

    if (profileErr || !profile) return jsonError("Profile not found.", 500);

    // Calculate total value server-side using item definitions
    const definitions = await Promise.all(
      (invRows ?? []).map(async (row) => ({
        row,
        itemDef: await getItemDefinition(supabase, row.item_id),
      })),
    );

    const sellDetails = definitions
      .filter(({ row, itemDef }) => {
        return Boolean(
          itemDef &&
            itemDef.sell_value > 0 &&
            itemDef.item_id !== "classic" &&
            !isBulkSellProtectedRarity(itemDef.rarity) &&
            row.quantity > 0,
        );
      })
      .map(({ row, itemDef }) => ({
        item_id: row.item_id,
        variant: row.variant ?? "normal",
        quantity: row.quantity,
        value: (itemDef?.sell_value ?? 0) * row.quantity,
      }));

    const totalSellValue = sellDetails.reduce((sum, detail) => sum + detail.value, 0);

    if (totalSellValue <= 0) {
      return jsonError("Nothing of value to sell in inventory.", 422);
    }

    const nextCoins = profile.coins + totalSellValue;
    const saleError = await settleCrateSale(supabase, userId, profile.coins, sellDetails.map(item => ({ ...item, expectedQuantity: item.quantity })), "crate:sell_all");
    if (saleError) return saleError;

    return Response.json({
      success: true,
      sold_all: true,
      inventoryChanges: sellDetails.map((item) => ({ item_id: item.item_id, variant: item.variant, quantity: 0 })),
      total_value: totalSellValue,
      item_count: sellDetails.length,
      newCoins: nextCoins,
    });
  }

  if (action === "sell_many") {
    const requestedItems = Array.isArray(body?.items) ? body.items : [];

    if (requestedItems.length === 0) {
      return jsonError("No items provided.", 422);
    }

    const requestedMap = new Map<string, number>();
    for (const entry of requestedItems) {
      const itemId = typeof entry?.itemId === "string" ? entry.itemId : "";
      const variant = typeof entry?.variant === "string" && entry.variant.trim().length > 0 ? entry.variant : "normal";
      const quantity = Math.max(1, Math.floor(Number(entry?.quantity ?? 1)));

      if (!itemId) {
        return jsonError("Missing item to sell.", 422);
      }

      const key = buildInventoryKey(itemId, variant);
      requestedMap.set(key, (requestedMap.get(key) ?? 0) + quantity);
    }

    const { data: invRows, error: invErr } = await supabase
      .from("user_crate_inventory")
      .select("item_id, variant, quantity")
      .eq("user_id", userId);

    if (invErr) {
      console.error("[crates] sell_many inventory read failed", invErr);
      return jsonError("Failed to read inventory.", 500);
    }

    const inventoryMap = new Map(
      (invRows ?? []).map((row) => [buildInventoryKey(row.item_id, row.variant ?? "normal"), Number(row.quantity ?? 0)]),
    );

    const details: Array<{
      item_id: string;
      variant: string;
      quantity: number;
      value: number;
    }> = [];

    for (const [key, quantity] of requestedMap.entries()) {
      const [itemId, variant] = key.split(":");
      const itemDef = await getItemDefinition(supabase, itemId);

      if (!itemDef || itemDef.sell_value <= 0 || itemId === "classic" || isBulkSellProtectedRarity(itemDef.rarity)) {
        return jsonError("This item cannot be sold or has no value.", 422);
      }

      const ownedQuantity = inventoryMap.get(key) ?? 0;
      if (ownedQuantity < quantity) {
        return jsonError("You do not own enough of this item.", 422);
      }

      details.push({
        item_id: itemId,
        variant,
        quantity,
        value: itemDef.sell_value * quantity,
      });
    }

    if (details.length === 0) {
      return jsonError("Nothing to sell.", 422);
    }

    const totalSellValue = details.reduce((sum, detail) => sum + detail.value, 0);

    if (totalSellValue <= 0) {
      return jsonError("Nothing of value to sell.", 422);
    }

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("coins")
      .eq("id", userId)
      .single();

    if (profileErr || !profile) {
      console.error("[crates] sell_many profile read failed", profileErr);
      return jsonError("Profile not found.", 500);
    }

    const nextCoins = profile.coins + totalSellValue;
    const saleError = await settleCrateSale(supabase, userId, profile.coins, details.map(item => ({ ...item, expectedQuantity: inventoryMap.get(buildInventoryKey(item.item_id, item.variant)) ?? 0 })), "crate:sell_many");
    if (saleError) return saleError;

    return Response.json({
      success: true,
      sold_many: true,
      inventoryChanges: details.map((item) => ({ item_id: item.item_id, variant: item.variant, quantity: (inventoryMap.get(buildInventoryKey(item.item_id, item.variant)) ?? 0) - item.quantity })),
      total_value: totalSellValue,
      item_count: details.length,
      newCoins: nextCoins,
    });
  }

  if (action === "sell_duplicates") {
    const { data: invRows, error: invErr } = await supabase
      .from("user_crate_inventory")
      .select("item_id, variant, quantity")
      .eq("user_id", userId);

    if (invErr) {
      console.error("[crates] sell_duplicates inventory read failed", invErr);
      return jsonError("Failed to read inventory.", 500);
    }

    const inventoryRows = (invRows ?? []).map((row) => ({
      item_id: row.item_id,
      variant: row.variant ?? "normal",
      quantity: Number(row.quantity ?? 0),
    }));

    const details: Array<{
      item_id: string;
      variant: string;
      quantity: number;
      value: number;
    }> = [];

    const inventoryMap = new Map(
      inventoryRows.map((row) => [buildInventoryKey(row.item_id, row.variant), row.quantity]),
    );

    for (const row of inventoryRows) {
      if (row.item_id === "classic" || row.quantity <= 1) {
        continue;
      }

      const itemDef = await getItemDefinition(supabase, row.item_id);
      if (!itemDef || itemDef.sell_value <= 0 || isBulkSellProtectedRarity(itemDef.rarity)) {
        continue;
      }

      const duplicateQuantity = row.quantity - 1;
      if (duplicateQuantity <= 0) {
        continue;
      }

      details.push({
        item_id: row.item_id,
        variant: row.variant,
        quantity: duplicateQuantity,
        value: itemDef.sell_value * duplicateQuantity,
      });
    }

    if (details.length === 0) {
      return jsonError("You do not have any sellable duplicates.", 422);
    }

    const totalSellValue = details.reduce((sum, detail) => sum + detail.value, 0);

    if (totalSellValue <= 0) {
      return jsonError("Nothing of value to sell.", 422);
    }

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("coins")
      .eq("id", userId)
      .single();

    if (profileErr || !profile) {
      console.error("[crates] sell_duplicates profile read failed", profileErr);
      return jsonError("Profile not found.", 500);
    }

    const nextCoins = profile.coins + totalSellValue;
    const saleError = await settleCrateSale(supabase, userId, profile.coins, details.map(item => ({ ...item, expectedQuantity: inventoryMap.get(buildInventoryKey(item.item_id, item.variant)) ?? 0 })), "crate:sell_duplicates");
    if (saleError) return saleError;

    return Response.json({
      success: true,
      sold_duplicates: true,
      inventoryChanges: details.map((item) => ({ item_id: item.item_id, variant: item.variant, quantity: 1 })),
      total_value: totalSellValue,
      item_count: details.length,
      newCoins: nextCoins,
    });
  }

  return jsonError("Invalid action.");
}
