export const PREMIUM_TITLE_ID = "premium-vault-royalty";

export type PremiumTitleConfig = {
  id: typeof PREMIUM_TITLE_ID;
  name: string;
  description: string;
  price: number;
  expiresAt: string;
  next: {
    name: string;
    description: string;
    price: number;
    startsAt: string | null;
  } | null;
};

export function isPremiumTitleActive(config: PremiumTitleConfig, now = Date.now()) {
  return new Date(config.expiresAt).getTime() > now;
}
