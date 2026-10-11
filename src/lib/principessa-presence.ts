// Visual progression only. XP costs, transfers and monthly resets live elsewhere.
export const PRINCIPESSA_PRESENCE_TIERS = [
  { id: "presence", level: 1, name: "Presence", detail: "Rose frame", accent: "#dda4bf" },
  { id: "adorned", level: 5, name: "Adorned", detail: "Gem-set frame", accent: "#f2a8cd" },
  { id: "crowned", level: 15, name: "Crowned", detail: "Her first crown", accent: "#e9b968" },
  { id: "sovereign", level: 30, name: "Sovereign", detail: "Laurel crest & gold seal", accent: "#f0cc85" },
  { id: "imperial", level: 50, name: "Imperial", detail: "Ruby crown & crimson frame", accent: "#f28a9f" },
  { id: "ascendant", level: 75, name: "Ascendant", detail: "Radiant crest & platinum trim", accent: "#e5d4fa" },
  { id: "absolute", level: 100, name: "Absolute", detail: "The complete royal insignia", accent: "#ffe5a6" },
] as const;

export function getPrincipessaPresence(level: number) {
  const safeLevel = Number.isFinite(level) ? Math.max(1, Math.min(100, Math.floor(level))) : 1;
  let rank = 0;
  for (let i = 1; i < PRINCIPESSA_PRESENCE_TIERS.length; i++) {
    if (safeLevel >= PRINCIPESSA_PRESENCE_TIERS[i].level) rank = i;
  }
  return { ...PRINCIPESSA_PRESENCE_TIERS[rank], rank, currentLevel: safeLevel, next: PRINCIPESSA_PRESENCE_TIERS[rank + 1] ?? null };
}
