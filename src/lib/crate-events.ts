import { type EventEffect } from "@/lib/events";
import { CRATE_TYPES, SAMPLE_CRATE_ITEMS, type CrateRarity } from "@/lib/crates";

export type CrateDropEntry = {
  item_id: string;
  weight: number;
  variant?: string;
};

function getActiveCrateEvents(activeEvents: Array<{ effect: EventEffect }>) {
  return activeEvents.filter((event) =>
    event.effect.type === "crate_cost_discount" ||
    event.effect.type === "crate_drop_adjustment" ||
    event.effect.type === "crate_free_open",
  );
}

export function getCrateCostMultiplier(activeEvents: Array<{ effect: EventEffect }>) {
  return getActiveCrateEvents(activeEvents).reduce((multiplier, event) => {
    if (event.effect.type !== "crate_cost_discount") {
      return multiplier;
    }

    return multiplier * (event.effect.multiplier || 1);
  }, 1);
}

export function hasFreeCrateOpen(activeEvents: Array<{ effect: EventEffect }>) {
  return getActiveCrateEvents(activeEvents).some((event) => event.effect.type === "crate_free_open");
}

export function getCrateOpenCost(
  baseCost: number,
  activeEvents: Array<{ effect: EventEffect }>,
  freeOpenUsedToday = false,
) {
  if (hasFreeCrateOpen(activeEvents) && !freeOpenUsedToday) {
    return 0;
  }

  return Math.round(baseCost * getCrateCostMultiplier(activeEvents));
}

export function getCrateBatchCost(
  baseCost: number,
  quantity: number,
  activeEvents: Array<{ effect: EventEffect }>,
  freeOpenUsedToday = false,
) {
  const safeQuantity = Math.max(1, Math.floor(quantity));
  const openCost = Math.round(baseCost * getCrateCostMultiplier(activeEvents));
  const freeOpenAvailable = hasFreeCrateOpen(activeEvents) && !freeOpenUsedToday;

  if (freeOpenAvailable) {
    return openCost * Math.max(0, safeQuantity - 1);
  }

  return openCost * safeQuantity;
}

function redistributeRarityGroupWeights<T extends CrateDropEntry>(
  entries: T[],
  targetTotal: number,
) {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);

  if (entries.length === 0 || total <= 0) {
    return entries.map((entry) => ({ ...entry, weight: 0 }));
  }

  if (targetTotal <= 0) {
    return entries.map((entry) => ({ ...entry, weight: 0 }));
  }

  const scaled = entries.map((entry, index) => {
    const exact = (entry.weight * targetTotal) / total;
    const floored = Math.floor(exact);
    return {
      entry,
      index,
      exact,
      floor: floored,
      fraction: exact - floored,
    };
  });

  const assigned = scaled.reduce((sum, item) => sum + item.floor, 0);
  let remainder = targetTotal - assigned;

  scaled
    .slice()
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
    .forEach((item) => {
      if (remainder <= 0) {
        return;
      }

      item.floor += 1;
      remainder -= 1;
    });

  return scaled
    .sort((a, b) => a.index - b.index)
    .map((item) => ({
      ...item.entry,
      weight: item.floor,
    }));
}

function adjustDropWeightsByRarity(
  crateType: string,
  targetTotals: Partial<Record<CrateRarity, number>>,
) {
  const baseDrops = CRATE_TYPES[crateType]?.drops ?? [];
  if (baseDrops.length === 0) {
    return baseDrops;
  }

  const grouped = new Map<CrateRarity, CrateDropEntry[]>();
  for (const drop of baseDrops) {
    const rarity = SAMPLE_CRATE_ITEMS[drop.item_id]?.rarity;
    if (!rarity) {
      continue;
    }

    const list = grouped.get(rarity) ?? [];
    list.push(drop);
    grouped.set(rarity, list);
  }

  return Array.from(grouped.entries()).flatMap(([rarity, entries]) => {
    const targetTotal = targetTotals[rarity];
    if (typeof targetTotal !== "number") {
      return entries;
    }

    return redistributeRarityGroupWeights(entries, targetTotal);
  });
}

export function getAdjustedCrateDrops(
  crateType: string,
  activeEvents: Array<{ effect: EventEffect }>,
) {
  const hasGoldenKey = getActiveCrateEvents(activeEvents).some(
    (event) => event.effect.type === "crate_drop_adjustment",
  );

  if (!hasGoldenKey) {
    return CRATE_TYPES[crateType]?.drops ?? [];
  }

  const baseDrops = CRATE_TYPES[crateType]?.drops ?? [];
  if (baseDrops.length === 0) {
    return baseDrops;
  }

  const baseTotal = baseDrops.reduce((sum, drop) => sum + drop.weight, 0);
  if (baseTotal <= 0) {
    return baseDrops;
  }

  if (crateType === "blessing_case") {
    return adjustDropWeightsByRarity(crateType, {
      common: Math.round(baseTotal * 0.99),
      legendary: Math.round(baseTotal * 0.01),
    });
  }

  if (crateType === "principessa_case") {
    return adjustDropWeightsByRarity(crateType, {
      common: Math.round(baseTotal * 0.41),
      epic: Math.round(baseTotal * 0.13),
    });
  }

  if (crateType === "premium_case") {
    return adjustDropWeightsByRarity(crateType, {
      common: Math.round(baseTotal * 0.1),
      epic: Math.round(baseTotal * 0.165),
      legendary: Math.round(baseTotal * 0.035),
    });
  }

  return baseDrops;
}

export function getActiveCrateEventKeys(activeEvents: Array<{ effect: EventEffect }>) {
  return getActiveCrateEvents(activeEvents)
    .map((event) => event.effect.crateEventKey)
    .filter((key): key is NonNullable<typeof key> => Boolean(key));
}
