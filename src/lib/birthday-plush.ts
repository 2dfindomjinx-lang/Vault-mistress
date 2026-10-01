// Her 2026 birthday plush: the one "ultimate" item in the catalogue.
//
// It is in no drop table and no shop. The only way to hold one is to have sent
// through Throne inside the 48-hour birthday window, and it is granted once per
// user after the window closes.
//
// Everything it confers is conditional on still holding it - the title, the
// twin ornament beside your name, and the weekly stipend all read live from the
// inventory. Selling it for its 25,000 coins takes all three away, which is the
// point: the item is meant to be worth more kept than cashed.

export const PLUSH_ITEM_ID = "fatass_principessa_plush";
export const PLUSH_IMAGE_PATH = "/crate-items/fatass_principessa_plush.png";
export const PLUSH_TITLE_ID = "birthday-2026-plush-keeper";

/** Coins paid to every holder, once per week, by the Monday cron. */
export const PLUSH_WEEKLY_COIN_REWARD = 1_000;

/**
 * Sell value is 25,000. At 1,000 a week the stipend alone passes that in about
 * six months, before counting the title and the ornament - so holding is the
 * better play on any horizon past half a year, without the item ever being made
 * unsellable.
 */
export const PLUSH_SELL_VALUE = 25_000;

// What holding the plush gives, in the words shown to the player (item card
// and sell confirmation). The three perks live elsewhere - the weekly cron,
// the item-gated title and the item-gated profile frame - so this list is the
// one place their plain-language summary is kept; update it with them.
export const PLUSH_PERKS = [
  `${PLUSH_WEEKLY_COIN_REWARD.toLocaleString("en-US")} coins every week`,
  "A profile title",
  "A profile frame",
] as const;

/** Appended to any "sell this?" prompt; empty for every other item. */
export function plushSellNote(itemId: string) {
  if (itemId !== PLUSH_ITEM_ID) return "";
  const perks = PLUSH_PERKS.map((perk) => `- ${perk}`).join("\n");
  return `\n\nWhile you hold it you get:\n${perks}\n\nSelling it ends all of them.`;
}

export function ownsPlush(inventory: Array<{ item_id: string; quantity?: number | null }>): boolean {
  return inventory.some((row) => row.item_id === PLUSH_ITEM_ID && Number(row.quantity ?? 0) > 0);
}
