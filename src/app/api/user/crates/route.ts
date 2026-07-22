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

type CrateOpenGrantRow = {
  id: string;
  remaining_opens: number | null;
};

type ConsumedCrateGrant = {
  id: string;
  previousRemaining: number;
  used: number;
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

async function consumeCrateOpenGrants(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  crateType: string,
  requestedOpens: number,
) {
  const targetOpens = Math.max(0, Math.floor(requestedOpens));
  if (targetOpens <= 0) {
    return { consumed: [] as ConsumedCrateGrant[], used: 0 };
  }

  const { data, error } = await supabase
    .from("user_crate_open_grants")
    .select("id, remaining_opens")
    .eq("user_id", userId)
    .eq("crate_type", crateType)
    .gt("remaining_opens", 0)
    .order("granted_at", { ascending: true });

  if (error) {
    console.error("[crates] open grant consume lookup failed", error);
    throw new Error("Could not verify free case keys.");
  }

  let remainingToUse = targetOpens;
  const consumed: ConsumedCrateGrant[] = [];

  for (const row of (data ?? []) as CrateOpenGrantRow[]) {
    if (remainingToUse <= 0) {
      break;
    }

    const previousRemaining = Math.max(0, Number(row.remaining_opens ?? 0));
    const used = Math.min(previousRemaining, remainingToUse);
    if (used <= 0) {
      continue;
    }

    const nextRemaining = previousRemaining - used;
    const { error: updateError } = await supabase
      .from("user_crate_open_grants")
      .update({ remaining_opens: nextRemaining, updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("remaining_opens", previousRemaining);

    if (updateError) {
      console.error("[crates] open grant consume update failed", updateError);
      throw new Error("Could not use free case keys.");
    }

    consumed.push({ id: row.id, previousRemaining, used });
    remainingToUse -= used;
  }

  return {
    consumed,
    used: targetOpens - remainingToUse,
  };
}

async function restoreCrateOpenGrants(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  consumed: ConsumedCrateGrant[],
) {
  await Promise.all(
    consumed.map((entry) =>
      supabase
        .from("user_crate_open_grants")
        .update({ remaining_opens: entry.previousRemaining, updated_at: new Date().toISOString() })
        .eq("id", entry.id),
    ),
  );
}

function getCrateBatchPricing(
  crateCost: number,
  quantity: number,
  activeEvents: Array<{ effect: EventEffect }>,
  freeOpenUsedToday: boolean,
  grantedOpenCount: number,
) {
  const safeQuantity = Math.max(1, Math.floor(quantity));
  const grantApplied = Math.min(safeQuantity, Math.max(0, Math.floor(grantedOpenCount)));
  const remainingAfterGrants = Math.max(0, safeQuantity - grantApplied);
  const eventFreeApplied = hasFreeCrateOpen(activeEvents) && !freeOpenUsedToday && remainingAfterGrants > 0;
  const paidQuantity = Math.max(0, remainingAfterGrants - (eventFreeApplied ? 1 : 0));
  const openCost = Math.round(crateCost * getCrateCostMultiplier(activeEvents));

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
    .select("crate_type, cost, opened_at")
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
    .select("coins, principessa_case_bad_luck_count, blessing_case_legendary_pity_count")
    .eq("id", userId)
    .single();

  if (profileErr || !profile) {
    console.error("[crates] profile read failed for batch open", profileErr);
    return jsonError("Could not verify balance.", 500);
  }

  const activeEvents = await getActiveEvents(supabase);
  const freeOpensUsedToday = await getFreeOpenUsageToday(supabase, userId);
  const grantPreview = await getCrateOpenCredits(supabase, userId);
  const grantedOpenPreview = grantPreview[crateType] ?? 0;
  const pricing = getCrateBatchPricing(
    crateDef.cost,
    quantity,
    activeEvents,
    freeOpensUsedToday[crateType],
    grantedOpenPreview,
  );
  const batchCost = pricing.batchCost;

  if (profile.coins < batchCost) {
    return jsonError("Not enough coins to open this crate.", 422);
  }

  let consumedGrants: ConsumedCrateGrant[] = [];
  let grantApplied = 0;
  if (pricing.grantApplied > 0) {
    try {
      const grantResult = await consumeCrateOpenGrants(supabase, userId, crateType, pricing.grantApplied);
      consumedGrants = grantResult.consumed;
      grantApplied = grantResult.used;
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Could not use free case keys.", 409);
    }
  }

  const finalPricing = getCrateBatchPricing(
    crateDef.cost,
    quantity,
    activeEvents,
    freeOpensUsedToday[crateType],
    grantApplied,
  );
  const finalBatchCost = finalPricing.batchCost;

  if (profile.coins < finalBatchCost) {
    await restoreCrateOpenGrants(supabase, consumedGrants);
    return jsonError("Not enough coins to open this crate.", 422);
  }

  const possibleDrops = getAdjustedCrateDrops(crateType, activeEvents).map((drop) => ({
    item_id: drop.item_id,
    weight: drop.weight,
    variant: drop.variant ?? "normal",
  }));

  const results: Array<{ item_id: string; variant: string }> = [];
  let principessaBadLuck = profile.principessa_case_bad_luck_count ?? 0;
  let blessingPity = profile.blessing_case_legendary_pity_count ?? 0;

  for (let i = 0; i < quantity; i += 1) {
    const isPrincipessaPity = crateType === "principessa_case" && principessaBadLuck >= 4;
    const isBlessingPity = crateType === "blessing_case" && blessingPity >= 249;

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
    } else if (isBlessingPity) {
      const legendaryOnly = possibleDrops.filter((drop) => SAMPLE_CRATE_ITEMS[drop.item_id]?.rarity === "legendary");
      rolled = weightedRandom(legendaryOnly.length ? legendaryOnly : possibleDrops) ?? rolled;
    }

    results.push({
      item_id: rolled.item_id,
      variant: rolled.variant ?? "normal",
    });

    const resultRarity = SAMPLE_CRATE_ITEMS[rolled.item_id]?.rarity;
    if (crateType === "principessa_case") {
      principessaBadLuck =
        resultRarity === "rare" || resultRarity === "epic" || resultRarity === "legendary"
          ? 0
          : principessaBadLuck + 1;
    }

    if (crateType === "blessing_case") {
      blessingPity = resultRarity === "legendary" ? 0 : blessingPity + 1;
    }
  }

  const uniqueItemIds = Array.from(new Set(results.map((entry) => entry.item_id)));
  const defs = await Promise.all(uniqueItemIds.map((itemId) => getItemDefinition(supabase, itemId)));
  const defMap = new Map(
    defs.filter((def): def is CrateItem => Boolean(def)).map((def) => [def.item_id, def]),
  );

  const nextCoins = profile.coins - finalBatchCost;
  const nowIso = new Date().toISOString();

  const { error: coinUpdateErr } = await supabase
    .from("profiles")
    .update({
      coins: nextCoins,
      principessa_case_bad_luck_count: principessaBadLuck,
      blessing_case_legendary_pity_count: blessingPity,
      updated_at: nowIso,
    })
    .eq("id", userId)
    .eq("coins", profile.coins);

  if (coinUpdateErr) {
    console.error("[crates] batch coin deduction failed", coinUpdateErr);
    await restoreCrateOpenGrants(supabase, consumedGrants);
    return jsonError("Crate purchase failed (balance changed).", 409);
  }

  const existingInventory = await supabase
    .from("user_crate_inventory")
    .select("item_id, variant, quantity")
    .eq("user_id", userId);

  if (existingInventory.error) {
    console.error("[crates] batch inventory read failed", existingInventory.error);
    await supabase.from("profiles").update({ coins: profile.coins, updated_at: nowIso }).eq("id", userId);
    await restoreCrateOpenGrants(supabase, consumedGrants);
    return jsonError("Failed to load inventory.", 500);
  }

  const inventoryMap = new Map(
    ((existingInventory.data ?? []) as Array<{ item_id: string; variant: string | null; quantity: number }>).map((row) => [
      `${row.item_id}:${row.variant ?? "normal"}`,
      Number(row.quantity ?? 0),
    ]),
  );

  const batchCounts = new Map<string, number>();
  for (const result of results) {
    const key = `${result.item_id}:${result.variant}`;
    batchCounts.set(key, (batchCounts.get(key) ?? 0) + 1);
  }

  const upsertPromises = Array.from(batchCounts.entries()).map(async ([key, count]) => {
    const [itemId, variant] = key.split(":");
    const currentQty = inventoryMap.get(key) ?? 0;
    const nextQty = itemId === "classic" ? 1 : currentQty + count;

    return supabase.from("user_crate_inventory").upsert(
      {
        user_id: userId,
        item_id: itemId,
        variant,
        quantity: nextQty,
      },
      { onConflict: "user_id,item_id,variant" },
    );
  });

  const upsertResults = await Promise.all(upsertPromises);
  const invFailure = upsertResults.find((result) => result.error);

  if (invFailure?.error) {
    console.error("[crates] batch inventory upsert failed", invFailure.error);
    await supabase.from("profiles").update({ coins: profile.coins, updated_at: nowIso }).eq("id", userId);
    await restoreCrateOpenGrants(supabase, consumedGrants);
    return jsonError("Failed to grant item. Coins refunded.", 500);
  }

  const txInsert = await supabase.from("coin_transactions").insert({
    user_id: userId,
    amount: -finalBatchCost,
    balance_before: profile.coins,
    balance_after: nextCoins,
    reason: "crate:open",
    metadata: {
      crate_type: crateType,
      quantity,
      batch: true,
      community_goal_keys_used: grantApplied,
      free_open_applied: finalPricing.eventFreeApplied,
      item_ids: results.map((result) => result.item_id),
    },
  });

  if (txInsert.error) {
    console.error("[crates] batch open transaction logging failed", txInsert.error);
    await supabase.from("profiles").update({ coins: profile.coins, updated_at: nowIso }).eq("id", userId);
    await restoreCrateOpenGrants(supabase, consumedGrants);
    return jsonError("Crate purchase logging failed.", 500);
  }

  const historyRows = results.map((result) => {
    const def = defMap.get(result.item_id);
    return {
      user_id: userId,
      crate_type: crateType,
      item_id: result.item_id,
      variant: result.variant,
      cost: Math.round(finalBatchCost / Math.max(1, quantity)),
      received_sell_value: def?.sell_value ?? 0,
    };
  });

  const historyInsert = await supabase.from("crate_opens").insert(historyRows);
  if (historyInsert.error) {
    console.error("[crates] batch history insert failed", historyInsert.error);
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
      blessing_legendary_pity: blessingPity,
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
      icon_url: getCrateIconUrl(crate_type, (def as any).icon_url ?? null),
    }))
    .sort((a, b) => a.cost - b.cost);

  // User's inventory (joined with sample data)
  const { data: invRows, error: invError } = await supabase
    .from("user_crate_inventory")
    .select("item_id, variant, quantity")
    .eq("user_id", userId);

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
    }
  }

  // Pity counters for display (server side only for logic)
  const { data: pityProfile } = await supabase
    .from("profiles")
    .select("principessa_case_bad_luck_count, blessing_case_legendary_pity_count")
    .eq("id", userId)
    .single();

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

  const freeOpensUsedToday = await getFreeOpenUsageToday(supabase, userId);
  const crateOpenCredits = await getCrateOpenCredits(supabase, userId);

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
      blessing_legendary_pity: pityProfile?.blessing_case_legendary_pity_count ?? 0,
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
      .select("coins, principessa_case_bad_luck_count, blessing_case_legendary_pity_count")
      .eq("id", userId)
      .single();

    if (profileErr || !profile) {
      console.error("[crates] profile read failed for open", profileErr);
      return jsonError("Could not verify balance.", 500);
    }

    let principessaBadLuck = profile.principessa_case_bad_luck_count ?? 0;
    let blessingPity = profile.blessing_case_legendary_pity_count ?? 0;
    const activeEvents = await getActiveEvents(supabase);
    const freeOpensUsedToday = await getFreeOpenUsageToday(supabase, userId);
    const grantPreview = await getCrateOpenCredits(supabase, userId);
    const pricing = getCrateBatchPricing(
      crateDef.cost,
      1,
      activeEvents,
      freeOpensUsedToday[resolvedCrateType],
      grantPreview[resolvedCrateType] ?? 0,
    );
    const openCost = pricing.batchCost;

    if (profile.coins < openCost) {
      return jsonError("Not enough coins to open this crate.", 422);
    }

    let consumedGrants: ConsumedCrateGrant[] = [];
    let grantApplied = 0;
    if (pricing.grantApplied > 0) {
      try {
        const grantResult = await consumeCrateOpenGrants(supabase, userId, resolvedCrateType, pricing.grantApplied);
        consumedGrants = grantResult.consumed;
        grantApplied = grantResult.used;
      } catch (error) {
        return jsonError(error instanceof Error ? error.message : "Could not use free case keys.", 409);
      }
    }

    const finalPricing = getCrateBatchPricing(
      crateDef.cost,
      1,
      activeEvents,
      freeOpensUsedToday[resolvedCrateType],
      grantApplied,
    );
    const finalOpenCost = finalPricing.batchCost;

    if (profile.coins < finalOpenCost) {
      await restoreCrateOpenGrants(supabase, consumedGrants);
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
    const isPrincipessaPity = crateType === "principessa_case" && principessaBadLuck >= 4;
    const isBlessingPity = crateType === "blessing_case" && blessingPity >= 249;

    if (isPrincipessaPity) {
      // Bad luck protection: 
      // - First roll normally to preserve the base legendary chance (e.g. 0.5%)
      // - If it landed on legendary → keep it
      // - Otherwise force Epic (so 99.5% epic + 0.5% legendary on pity opening)
      let tempRolled = weightedRandom(possibleDrops);
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
    } else if (isBlessingPity) {
      // Legendary guarantee: force legendary only
      const legOnly = possibleDrops.filter((d) => {
        const def = SAMPLE_CRATE_ITEMS[d.item_id];
        return def && def.rarity === "legendary";
      });
      rolled = weightedRandom(legOnly.length ? legOnly : possibleDrops);
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

    // V1 self-seeding: ensure all droppable item definitions exist in crate_items.
    // This satisfies the FK constraint on user_crate_inventory.item_id (schema has REFERENCES crate_items).
    // Without this, on a fresh DB (no manual seed of the 39 items) the inventory upsert fails
    // after coins are already deducted → "Failed to grant item. Coins refunded."
    if (crateDef?.drops?.length) {
      const seeds = crateDef.drops
        .map((d) => {
          const s = SAMPLE_CRATE_ITEMS[d.item_id];
          if (!s) return null;
          return {
            item_id: d.item_id,
            name: s.name,
            description: s.description || "",
            image_url: getCrateItemImageUrl(d.item_id, (s as any).image_url),
            rarity: s.rarity,
            collection: s.collection || null,
            sell_value: s.sell_value || 0,
            enabled: true,
            metadata: {},
          };
        })
        .filter(Boolean) as any[];

      if (seeds.length > 0) {
        const { error: seedErr } = await supabase
          .from("crate_items")
          .upsert(seeds, { onConflict: "item_id" });
        if (seedErr) {
          console.warn("[crates] item definition seeding warning (continuing)", seedErr);
        }
      }
    }

    const nextCoins = profile.coins - finalOpenCost;

    // Atomic: update coins + inventory quantity + tx + history
    const { error: coinUpdateErr } = await supabase
      .from("profiles")
      .update({ coins: nextCoins, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .eq("coins", profile.coins); // optimistic / race protection

    if (coinUpdateErr) {
      console.error("[crates] coin deduction failed", coinUpdateErr);
      await restoreCrateOpenGrants(supabase, consumedGrants);
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

    const previousInventoryQty = existingInv?.quantity ?? 0;
    const newQty = rolled.item_id === "classic"
      ? 1
      : (existingInv?.quantity ?? 0) + 1;

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
      await restoreCrateOpenGrants(supabase, consumedGrants);
      return jsonError("Failed to grant item. Coins refunded.", 500);
    }

    // Record negative coin transaction (crate purchase / sink)
    const { error: txErr } = await supabase.from("coin_transactions").insert({
      user_id: userId,
      amount: -finalOpenCost,
      balance_before: profile.coins,
      balance_after: nextCoins,
      reason: "crate:open",
      metadata: {
        crate_type: crateType,
        item_id: rolled.item_id,
        variant: rolled.variant,
        rarity: wonItemDef.rarity,
        community_goal_keys_used: grantApplied,
        free_open_applied: finalPricing.eventFreeApplied,
      },
    });

    if (txErr) {
      console.error("[crates] open transaction logging failed", txErr);
      await supabase.from("profiles").update({ coins: profile.coins, updated_at: new Date().toISOString() }).eq("id", userId);
      await restoreCrateOpenGrants(supabase, consumedGrants);
      if (previousInventoryQty > 0) {
        const { error: restoreInvErr } = await supabase
          .from("user_crate_inventory")
          .update({ quantity: previousInventoryQty })
          .eq("user_id", userId)
          .eq("item_id", rolled.item_id)
          .eq("variant", rolled.variant);
        if (restoreInvErr) {
          console.error("[crates] open inventory rollback failed", restoreInvErr);
        }
      } else {
        const { error: restoreInvErr } = await supabase
          .from("user_crate_inventory")
          .delete()
          .eq("user_id", userId)
          .eq("item_id", rolled.item_id)
          .eq("variant", rolled.variant);
        if (restoreInvErr) {
          console.error("[crates] open inventory rollback delete failed", restoreInvErr);
        }
      }
      return jsonError("Crate purchase logging failed.", 500);
    }

    // Record history
    await supabase.from("crate_opens").insert({
      user_id: userId,
      crate_type: crateType,
      item_id: rolled.item_id,
      variant: rolled.variant,
      cost: finalOpenCost,
      received_sell_value: wonItemDef.sell_value,
    });

    // Update pity counters (server only)
    let updatedBadLuck = principessaBadLuck;
    let updatedBlessPity = blessingPity;
    const resultRarity = wonItemDef.rarity;

    if (crateType === "principessa_case") {
      updatedBadLuck = (resultRarity === "rare" || resultRarity === "epic" || resultRarity === "legendary")
        ? 0
        : (principessaBadLuck + 1);
    }
    if (crateType === "blessing_case") {
      updatedBlessPity = (resultRarity === "legendary")
        ? 0
        : (blessingPity + 1);
    }

    await supabase.from("profiles").update({
      principessa_case_bad_luck_count: updatedBadLuck,
      blessing_case_legendary_pity_count: updatedBlessPity,
    }).eq("id", userId);

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
        blessing_legendary_pity: updatedBlessPity,
      },
    });
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
    const { error: txErr } = await supabase.from("coin_transactions").insert({
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

    if (txErr) {
      console.error("[crates] sell transaction logging failed", txErr);
      await supabase
        .from("profiles")
        .update({ coins: profile.coins, updated_at: new Date().toISOString() })
        .eq("id", userId)
        .eq("coins", nextCoins);

      if (invRow.quantity > 0) {
        const { error: restoreInvErr } = await supabase
          .from("user_crate_inventory")
          .upsert(
            {
              user_id: userId,
              item_id: itemId,
              variant,
              quantity: invRow.quantity,
            },
            { onConflict: "user_id,item_id,variant" },
          );
        if (restoreInvErr) {
          console.error("[crates] sell inventory rollback failed", restoreInvErr);
        }
      }
      return jsonError("Sale logging failed.", 500);
    }

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

  // Bulk sell all current inventory in a single server call (one coin update, atomic-ish)
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
            itemDef.rarity !== "legendary" &&
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

    // Single coin update with race protection
    const { error: coinErr } = await supabase
      .from("profiles")
      .update({ coins: nextCoins, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .eq("coins", profile.coins);

    if (coinErr) {
      console.error("[crates] sell_all coin update failed", coinErr);
      return jsonError("Sale failed (balance changed).", 409);
    }

    // Remove only the rows that were actually sold. Protected items stay in inventory.
    const deleteResults = await Promise.all(
      sellDetails.map((detail) =>
        supabase
          .from("user_crate_inventory")
          .delete()
          .eq("user_id", userId)
          .eq("item_id", detail.item_id)
          .eq("variant", detail.variant),
      ),
    );

    const deleteFailure = deleteResults.find((result) => result.error);
    if (deleteFailure?.error) {
      console.error("[crates] sell_all inventory delete failed", deleteFailure.error);
      // Best effort refund
      await supabase.from("profiles").update({ coins: profile.coins }).eq("id", userId);
      return jsonError("Failed to clear inventory after sale. Coins refunded.", 500);
    }

    // One bulk coin transaction log
    const { error: txErr } = await supabase.from("coin_transactions").insert({
      user_id: userId,
      amount: totalSellValue,
      balance_before: profile.coins,
      balance_after: nextCoins,
      reason: "crate:sell_all",
      metadata: {
        item_count: sellDetails.length,
        items: sellDetails,
      },
    });

    if (txErr) {
      console.error("[crates] sell_all transaction logging failed", txErr);

      const { error: profileRestoreErr } = await supabase
        .from("profiles")
        .update({ coins: profile.coins, updated_at: new Date().toISOString() })
        .eq("id", userId)
        .eq("coins", nextCoins);

      if (profileRestoreErr) {
        console.error("[crates] sell_all profile rollback failed", profileRestoreErr);
      }

      for (const detail of sellDetails) {
        const { error: restoreInvErr } = await supabase
          .from("user_crate_inventory")
          .upsert(
            {
              user_id: userId,
              item_id: detail.item_id,
              variant: detail.variant,
              quantity: detail.quantity,
            },
            { onConflict: "user_id,item_id,variant" },
          );

        if (restoreInvErr) {
          console.error("[crates] sell_all inventory rollback failed", restoreInvErr);
        }
      }

      return jsonError("Sale logging failed.", 500);
    }

    // History records (one per sold stack for audit)
    await Promise.all(
      sellDetails.map((detail) =>
        supabase.from("crate_opens").insert({
          user_id: userId,
          crate_type: "sell_all",
          item_id: detail.item_id,
          variant: detail.variant,
          cost: 0,
          received_sell_value: detail.value,
        }),
      ),
    );

    return Response.json({
      success: true,
      sold_all: true,
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

      if (!itemDef || itemDef.sell_value <= 0 || itemId === "classic" || itemDef.rarity === "legendary") {
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
    const nowIso = new Date().toISOString();
    const appliedDetails: Array<{
      item_id: string;
      variant: string;
      quantity: number;
      value: number;
    }> = [];

    const { error: coinErr } = await supabase
      .from("profiles")
      .update({ coins: nextCoins, updated_at: nowIso })
      .eq("id", userId)
      .eq("coins", profile.coins);

    if (coinErr) {
      console.error("[crates] sell_many coin update failed", coinErr);
      return jsonError("Sale failed (balance changed).", 409);
    }

    for (const detail of details) {
      const currentQty = inventoryMap.get(buildInventoryKey(detail.item_id, detail.variant)) ?? 0;
      const nextQty = currentQty - detail.quantity;

      const mutation = nextQty > 0
        ? supabase
            .from("user_crate_inventory")
            .update({ quantity: nextQty })
            .eq("user_id", userId)
            .eq("item_id", detail.item_id)
            .eq("variant", detail.variant)
        : supabase
            .from("user_crate_inventory")
            .delete()
            .eq("user_id", userId)
            .eq("item_id", detail.item_id)
            .eq("variant", detail.variant);

      const { error: invUpdateErr } = await mutation;
      if (invUpdateErr) {
        console.error("[crates] sell_many inventory mutation failed", invUpdateErr);
        await supabase.from("profiles").update({ coins: profile.coins, updated_at: nowIso }).eq("id", userId).eq("coins", nextCoins);
        await Promise.all(
          appliedDetails.map((restored) =>
            supabase
              .from("user_crate_inventory")
              .upsert(
                {
                  user_id: userId,
                  item_id: restored.item_id,
                  variant: restored.variant,
                  quantity: (inventoryMap.get(buildInventoryKey(restored.item_id, restored.variant)) ?? 0),
                },
                { onConflict: "user_id,item_id,variant" },
              ),
          ),
        );
        return jsonError("Failed to clear inventory after sale. Coins refunded.", 500);
      }

      appliedDetails.push(detail);
    }

    const { error: txErr } = await supabase.from("coin_transactions").insert({
      user_id: userId,
      amount: totalSellValue,
      balance_before: profile.coins,
      balance_after: nextCoins,
      reason: "crate:sell_many",
      metadata: {
        item_count: details.length,
        items: details,
      },
    });

    if (txErr) {
      console.error("[crates] sell_many transaction logging failed", txErr);
      await supabase.from("profiles").update({ coins: profile.coins, updated_at: nowIso }).eq("id", userId).eq("coins", nextCoins);
      await Promise.all(
        details.map((detail) =>
          supabase
            .from("user_crate_inventory")
            .upsert(
              {
                user_id: userId,
                item_id: detail.item_id,
                variant: detail.variant,
                quantity: inventoryMap.get(buildInventoryKey(detail.item_id, detail.variant)) ?? 0,
              },
              { onConflict: "user_id,item_id,variant" },
            ),
        ),
      );
      return jsonError("Sale logging failed.", 500);
    }

    await Promise.all(
      details.map((detail) =>
        supabase.from("crate_opens").insert({
          user_id: userId,
          crate_type: "sell_many",
          item_id: detail.item_id,
          variant: detail.variant,
          cost: 0,
          received_sell_value: detail.value,
        }),
      ),
    );

    return Response.json({
      success: true,
      sold_many: true,
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
      if (!itemDef || itemDef.sell_value <= 0 || itemDef.rarity === "legendary") {
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
    const nowIso = new Date().toISOString();
    const appliedDetails: Array<{
      item_id: string;
      variant: string;
      quantity: number;
      value: number;
    }> = [];

    const { error: coinErr } = await supabase
      .from("profiles")
      .update({ coins: nextCoins, updated_at: nowIso })
      .eq("id", userId)
      .eq("coins", profile.coins);

    if (coinErr) {
      console.error("[crates] sell_duplicates coin update failed", coinErr);
      return jsonError("Sale failed (balance changed).", 409);
    }

    for (const detail of details) {
      const currentQty = inventoryMap.get(buildInventoryKey(detail.item_id, detail.variant)) ?? 0;
      const nextQty = Math.max(1, currentQty - detail.quantity);

      const { error: invUpdateErr } = await supabase
        .from("user_crate_inventory")
        .update({ quantity: nextQty })
        .eq("user_id", userId)
        .eq("item_id", detail.item_id)
        .eq("variant", detail.variant);

      if (invUpdateErr) {
        console.error("[crates] sell_duplicates inventory mutation failed", invUpdateErr);
        await supabase
          .from("profiles")
          .update({ coins: profile.coins, updated_at: nowIso })
          .eq("id", userId)
          .eq("coins", nextCoins);
        await Promise.all(
          appliedDetails.map((restored) =>
            supabase
              .from("user_crate_inventory")
              .upsert(
                {
                  user_id: userId,
                  item_id: restored.item_id,
                  variant: restored.variant,
                  quantity: inventoryMap.get(buildInventoryKey(restored.item_id, restored.variant)) ?? 0,
                },
                { onConflict: "user_id,item_id,variant" },
              ),
          ),
        );
        return jsonError("Failed to clear duplicates after sale. Coins refunded.", 500);
      }

      appliedDetails.push(detail);
    }

    const { error: txErr } = await supabase.from("coin_transactions").insert({
      user_id: userId,
      amount: totalSellValue,
      balance_before: profile.coins,
      balance_after: nextCoins,
      reason: "crate:sell_duplicates",
      metadata: {
        item_count: details.length,
        items: details,
      },
    });

    if (txErr) {
      console.error("[crates] sell_duplicates transaction logging failed", txErr);
      await supabase
        .from("profiles")
        .update({ coins: profile.coins, updated_at: nowIso })
        .eq("id", userId)
        .eq("coins", nextCoins);
      await Promise.all(
        details.map((detail) =>
          supabase
            .from("user_crate_inventory")
            .upsert(
              {
                user_id: userId,
                item_id: detail.item_id,
                variant: detail.variant,
                quantity: inventoryMap.get(buildInventoryKey(detail.item_id, detail.variant)) ?? 0,
              },
              { onConflict: "user_id,item_id,variant" },
            ),
        ),
      );
      return jsonError("Sale logging failed.", 500);
    }

    await Promise.all(
      details.map((detail) =>
        supabase.from("crate_opens").insert({
          user_id: userId,
          crate_type: "sell_duplicates",
          item_id: detail.item_id,
          variant: detail.variant,
          cost: 0,
          received_sell_value: detail.value,
        }),
      ),
    );

    return Response.json({
      success: true,
      sold_duplicates: true,
      total_value: totalSellValue,
      item_count: details.length,
      newCoins: nextCoins,
    });
  }

  return jsonError("Invalid action.");
}
