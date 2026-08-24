export const DASHBOARD_PAGE_CODES = {
  home: "I",
  runway: "II",
  tribute: "III",
  tasks: "IV",
  wheels: "V",
  pet: "VI",
  moneyShop: "VII",
  shop: "VIII",
  crates: "IX",
  debt: "X",
  collection: "XI",
  profile: "XII",
  devotion: "XIII",
} as const;

export type DashboardPage = keyof typeof DASHBOARD_PAGE_CODES;
