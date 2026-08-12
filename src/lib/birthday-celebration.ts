export const BIRTHDAY_WISH_MAX_LENGTH = 180;

export type BirthdayWish = {
  id: string;
  displayName: string | null;
  username: string | null;
  message: string;
  createdAt: string;
  isMine: boolean;
};

export type BirthdayCelebration = {
  canModerate: boolean;
  roseCount: number;
  wishCount: number;
  hasLeftRose: boolean;
  myWish: BirthdayWish | null;
  wishes: BirthdayWish[];
};

export function normalizeBirthdayWish(value: unknown) {
  if (typeof value !== "string") return null;
  const message = value.replace(/\s+/g, " ").trim();
  if (!message || message.length > BIRTHDAY_WISH_MAX_LENGTH) return null;
  if (/[<>]/.test(message) || /(?:https?:\/\/|www\.|[a-z0-9-]+\.(?:com|net|org|io|gg|co)\b)/i.test(message)) {
    return null;
  }
  return message;
}
