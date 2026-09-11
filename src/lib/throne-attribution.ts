// Keep in sync with attribute_throne_debt_payment's stored-message parser.
// Multiple distinct routing codes are ambiguous; never guess who to credit.
export function extractThroneAttributionCode(message: string): string | null {
  const codes = [...new Set(
    [...message.matchAll(/\b(?:VM|PT|CK|WL|TD|P2)-[A-Z0-9]{4,8}\b/gi)]
      .map(([code]) => code.toUpperCase()),
  )];
  return codes.length === 1 ? codes[0] : null;
}

export function throneProfileCodeColumn(code: string) {
  if (code.startsWith("PT-")) return "pet_tribute_code";
  if (code.startsWith("CK-")) return "candle_code";
  if (code.startsWith("P2-")) return "court_tribute_code";
  return "tribute_code";
}
