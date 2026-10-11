import { getDailyPetConfessionSentence, getDailyPetOwnershipOathSentence, getDailyPetPerfectWritingSentence } from "./pet-tasks-content";
import { normalizeAddressTerm } from "./address-term";
import { normalizeWritingText } from "./writing-comparison";

export const PET_REWARD_TASKS = new Set(["pet-confession-dm", "pet-ownership-oath", "pet-perfect-writing", "pet-evil-wait", "pet-false-hope", "pet-favor-roulette", "pet-affection-claim"]);
export const PET_REVIEW_TASKS = new Set(["pet-daily-report", "pet-twitter-post", "pet-voice-proof", "pet-throne-tribute"]);
export const PET_PROFILE_FIELDS = new Set(["affection", "coins", "last_pet_tax_at", "last_owner_likeness_at", "owner_likeness", "pet_unlocked_at", "pet_score", "tribute_total"]);
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function validPetWriting(taskId: string, value: unknown, addressTerm: unknown) {
  const sentence = taskId === "pet-confession-dm" ? getDailyPetConfessionSentence : taskId === "pet-ownership-oath" ? getDailyPetOwnershipOathSentence : taskId === "pet-perfect-writing" ? getDailyPetPerfectWritingSentence : null;
  return !sentence || (typeof value === "string" && value.length <= 4000 && normalizeWritingText(value) === normalizeWritingText(sentence(normalizeAddressTerm(addressTerm))));
}
// The server supplies cryptographic samples; the browser never chooses its win.
export function rollPetFavor(pickedIndex: number, random: (max: number) => number) {
  const emptyDay = random(100) < 12;
  const countRoll = random(100);
  const count = countRoll < 80 ? 1 : countRoll < 95 ? 2 : 3;
  const cards = [0, 1, 2, 3, 4];
  for (let i = cards.length - 1; i > 0; i--) { const j = random(i + 1); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  const winningIndices = emptyDay ? [] : cards.slice(0, count);
  return { pickedIndex, emptyDay, winningIndices, result: emptyDay ? "empty-day" : winningIndices.includes(pickedIndex) ? "win" : "loss" };
}
