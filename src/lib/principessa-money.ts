// Principessa Money (PM) - the paid-only hard currency.
//
// Rules that the rest of the codebase must not break:
//   * 1 USD = 1 PM, exactly. PM is never minted by tasks, games, gambling or
//     sell-backs - only by a real Throne payment being credited.
//   * PM -> Coin is allowed. Coin -> PM is NOT. The one-way valve is the whole
//     point: it keeps farmed coins from ever becoming paid currency.
//   * 1 PM = 1000 Coins at base rate. Larger conversions earn a bonus (the
//     ladder that used to live on the Throne payout, see below).
export const PM_TO_COIN_RATE = 1000;
export const PM_PER_USD = 1;

// Ported verbatim from getPetThroneGiveBonusPercent in src/lib/pet-throne.ts.
// There the thresholds were written in coins (10k/20k/50k/100k) against a base
// of amount*1000, so they are the same numbers once expressed in PM. Moving the
// bonus here is what lets the Throne payout stay exactly 1 USD = 1 PM while the
// incentive to convert in bulk survives.
export function getMoneyConversionBonusPercent(pmAmount: number) {
  if (pmAmount >= 100) return 0.25;
  if (pmAmount >= 50) return 0.2;
  if (pmAmount >= 20) return 0.15;
  if (pmAmount >= 10) return 0.1;
  return 0;
}

export function getMoneyConversionBreakdown(pmAmount: number) {
  const safeAmount = Math.max(0, Math.floor(Number(pmAmount) || 0));
  const baseCoins = safeAmount * PM_TO_COIN_RATE;
  const bonusPercent = getMoneyConversionBonusPercent(safeAmount);
  const bonusCoins = Math.floor(baseCoins * bonusPercent);

  return {
    baseCoins,
    bonusCoins,
    bonusPercent,
    pmAmount: safeAmount,
    totalCoins: baseCoins + bonusCoins,
  };
}

export const MONEY_CONVERSION_TIERS = [10, 20, 50, 100].map((pmAmount) => ({
  bonusPercent: getMoneyConversionBonusPercent(pmAmount),
  pmAmount,
}));

// Guaranteed acquisition still has to cost more than the item is worth when
// liquidated, but not punitively so - x1.5 on the coin sell value puts a
// 25,000-coin legendary at 38 PM. Chasing that same specific legendary through
// the Blessing Case runs ~333,000 coins on average, so the shop stays a clear
// win for anyone paying, which is the point: it converts real money.
//
// The multiplier must stay above 1. At or below it, a PM purchase would be
// worth more liquidated than it cost, and the shop would become a cheaper
// PM -> Coin exchange than the conversion route.
export const MONEY_SHOP_PRICE_MULTIPLIER = 1.5;

export function getMoneyShopPrice(sellValueCoins: number) {
  const safeValue = Math.max(0, Math.floor(Number(sellValueCoins) || 0));
  return Math.max(1, Math.ceil((safeValue / PM_TO_COIN_RATE) * MONEY_SHOP_PRICE_MULTIPLIER));
}

// Buying back a PM purchase refunds PM, never coins. Refunding coins would let
// a 50 PM item become 25,000 coins and turn the shop into a second, cheaper
// PM -> Coin exchange that bypasses the conversion route entirely.
export const MONEY_SHOP_BUYBACK_PERCENT = 0.7;

export function getMoneyBuybackAmount(pmPrice: number) {
  const safePrice = Math.max(0, Math.floor(Number(pmPrice) || 0));
  return Math.max(0, Math.round(safePrice * MONEY_SHOP_BUYBACK_PERCENT));
}

// Above this, a /money grant has to be approved in the Companion App even for
// an allowlisted admin - same posture as the coin ladder, expressed in PM.
// 50 PM is the coin threshold's exact equivalent (50,000 coins) at base rate.
export const LARGE_MONEY_GRANT_AMOUNT = Math.max(
  1,
  Number(process.env.ADMIN_SECURITY_LARGE_MONEY_AMOUNT ?? 50),
);

export function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US").format(Math.max(0, Math.floor(Number(amount) || 0)));
}

export type MoneyShopEntry = {
  itemId: string;
  name: string;
  rarity: string;
  imageUrl: string | null;
  sellValueCoins: number;
  pricePm: number;
  buybackPm: number;
  ownedFromShop: number;
};
