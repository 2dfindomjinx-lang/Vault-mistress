export type CourtSealBoard = "devotion" | "streak" | "click";

export type CourtSealPayload = {
  board: CourtSealBoard;
  rank?: number;
  streak?: number;
  clicks?: number;
  createdAt: number;
};

export const COURT_SEAL_BOARD_COPY: Record<
  CourtSealBoard,
  {
    accent: string;
    eyebrow: string;
    title: string;
    shareLabel: string;
  }
> = {
  devotion: {
    accent: "#f9a8d4",
    eyebrow: "PRINCIPESSA'S DEVOTION LADDER",
    title: "Devotion Seal",
    shareLabel: "Devotion",
  },
  click: {
    accent: "#fcd34d",
    eyebrow: "PRINCIPESSA'S CLICK CHAMPIONS",
    title: "Click Champion Seal",
    shareLabel: "Click rank",
  },
  streak: {
    accent: "#c4b5fd",
    eyebrow: "PRINCIPESSA'S LOYAL COURT",
    title: "Loyalty Seal",
    shareLabel: "Loyalty streak",
  },
};

export function getCourtSealMetric(payload: CourtSealPayload) {
  switch (payload.board) {
    case "click":
      return payload.rank ? `Weekly Click Rank #${payload.rank}` : "Unranked this week";
    case "streak":
      return `${payload.streak ?? 0} day loyalty streak`;
    default:
      return payload.rank ? `Devotion Rank #${payload.rank}` : "Unranked in Devotion";
  }
}

export function getCourtSealSecondary(payload: CourtSealPayload) {
  if (payload.board === "click") {
    return `${(payload.clicks ?? 0).toLocaleString("en-US")} weekly clicks`;
  }
  return "Sealed by Principessa's Court";
}
