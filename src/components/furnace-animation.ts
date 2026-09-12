export const FURNACE_NOTE_MS = 950;
export function furnaceNoteInterval(amount: number) {
  return Math.max(100, Math.round(300 - Math.log2(Math.max(1, amount) + 1) * 30));
}
export function furnaceDuration(amount: number) {
  return amount > 0 ? FURNACE_NOTE_MS + (amount - 1) * furnaceNoteInterval(amount) : 0;
}
export function furnaceFrame(amount: number, elapsed: number) {
  const interval = furnaceNoteInterval(amount);
  const consumed = Math.min(amount, Math.max(0, Math.floor((elapsed - FURNACE_NOTE_MS) / interval) + 1));
  const launched = Math.min(amount, Math.max(0, Math.floor(elapsed / interval) + 1));
  return { consumed, notes: Array.from({ length: Math.max(0, launched - consumed) }, (_, offset) => {
    const index = consumed + offset;
    return { index, progress: Math.max(0, Math.min(1, (elapsed - index * interval) / FURNACE_NOTE_MS)) };
  }) };
}
