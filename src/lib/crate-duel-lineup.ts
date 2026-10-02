// A Crate Duel's lineup: one crate type per round, in the order they open.
// Shared by the API (pricing, rolling) and the client (labels, previews) so a
// lineup is priced and described the same way everywhere.

import { CRATE_TYPES } from "@/lib/crates";

export type LineupGroup = { count: number; crateType: string; name: string };

/** Total plain listed cost of a lineup. Unknown crates count as 0. */
export function lineupCost(crates: readonly string[]) {
  return crates.reduce((sum, crateType) => sum + (CRATE_TYPES[crateType]?.cost ?? 0), 0);
}

/** Consecutive-or-not repeats collapsed to one entry, in first-appearance order. */
export function groupLineup(crates: readonly string[]): LineupGroup[] {
  const groups = new Map<string, LineupGroup>();
  for (const crateType of crates) {
    const existing = groups.get(crateType);
    if (existing) existing.count += 1;
    else groups.set(crateType, { count: 1, crateType, name: CRATE_TYPES[crateType]?.name ?? crateType });
  }
  return Array.from(groups.values());
}

/** "5x Principessa Case" or "3x Principessa Case + 2x Premium Case". */
export function lineupLabel(crates: readonly string[]) {
  return groupLineup(crates)
    .map((group) => `${group.count}x ${group.name}`)
    .join(" + ");
}
