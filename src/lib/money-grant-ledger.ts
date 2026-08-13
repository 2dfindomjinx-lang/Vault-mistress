/**
 * How a hand-entered Principessa Money grant is written to the ledger.
 *
 * There are two kinds, and the only thing separating them is whether the public
 * Recent Tributes ticker picks the row up:
 *
 *   /money        - a real Throne payment that the webhook failed to match,
 *                   usually because the buyer left "Show Message Publicly" off
 *                   and the message (with their code) never reached us. It
 *                   happened, someone paid for it, so it belongs on the ticker.
 *
 *   /moneysilent  - anything else. Compensation, a correction, a bonus paid by
 *                   hand, a test. Real money moves, but nobody sent a tribute,
 *                   so announcing one would be a lie.
 *
 * The ticker (supabase/recent-tributes-money.sql) selects on
 * `reason = 'throne_tribute'` and reads the displayed figure from
 * `metadata.throneMoneyBaseAmount`, falling back to the raw amount. Setting the
 * base explicitly is what lets a bonus be paid separately without inflating the
 * number the court sees.
 */

export const MONEY_GRANT_PUBLIC_REASON = "throne_tribute";
export const MONEY_GRANT_SILENT_REASON = "admin:money-grant";

export type MoneyGrantVisibility = "public" | "silent";

export function getMoneyGrantReason(visibility: MoneyGrantVisibility): string {
  return visibility === "public" ? MONEY_GRANT_PUBLIC_REASON : MONEY_GRANT_SILENT_REASON;
}

/**
 * Extra metadata the ledger row needs for its visibility.
 *
 * A public grant carries the base amount so the ticker prints the tribute
 * itself rather than whatever total happens to be in the row. A silent one
 * carries a marker instead, so a row that never reached the ticker can still be
 * told apart from an ordinary automated credit when reading the ledger later.
 */
export function getMoneyGrantMetadata(
  visibility: MoneyGrantVisibility,
  amount: number,
): Record<string, unknown> {
  if (visibility === "silent") {
    return { grantVisibility: "silent" };
  }
  return {
    grantVisibility: "public",
    // Clawbacks (negative amounts) have no tribute to show.
    ...(amount > 0 ? { throneMoneyBaseAmount: Math.floor(amount) } : {}),
  };
}

export function parseMoneyGrantVisibility(value: unknown): MoneyGrantVisibility {
  return value === "silent" ? "silent" : "public";
}
