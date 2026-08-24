import { getFurnaceRank } from "@/lib/tribute-furnace";

// Court Seals: signed, stateless share tokens. The original three were
// leaderboard badges; the newer boards are receipts - furnace burns, crate
// pulls, tribute totals - designed to be posted on X, where every share is an
// advert aimed at exactly the right audience.
export type CourtSealBoard =
  | "devotion"
  | "streak"
  | "click"
  | "furnace"
  | "crate"
  | "tribute";

export const COURT_SEAL_BOARDS: readonly CourtSealBoard[] = [
  "devotion",
  "streak",
  "click",
  "furnace",
  "crate",
  "tribute",
];

export type CourtSealPayload = {
  board: CourtSealBoard;
  rank?: number;
  streak?: number;
  clicks?: number;
  // Receipt boards. Everything here is written by the server from its own
  // records - the client only ever names the board (and, for crate, the item).
  burned?: number;
  itemId?: string;
  itemName?: string;
  rarity?: string;
  usd?: number;
  // Display name or @handle, omitted when the owner hides from leaderboards.
  handle?: string;
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
  furnace: {
    accent: "#f0821e",
    eyebrow: "THE TRIBUTE FURNACE",
    title: "Furnace Receipt",
    shareLabel: "Furnace",
  },
  crate: {
    accent: "#e879f9",
    eyebrow: "PULLED FROM HER CASES",
    title: "Case Pull",
    shareLabel: "Case pull",
  },
  tribute: {
    accent: "#e6ba73",
    eyebrow: "PRINCIPESSA'S LEDGER",
    title: "Tribute Receipt",
    shareLabel: "Tribute total",
  },
};

export function getCourtSealMetric(payload: CourtSealPayload) {
  switch (payload.board) {
    case "click":
      return payload.rank ? `Weekly Click Rank #${payload.rank}` : "Unranked this week";
    case "streak":
      return `${payload.streak ?? 0} day loyalty streak`;
    case "furnace":
      return `${(payload.burned ?? 0).toLocaleString("en-US")} Money burned for nothing`;
    case "crate":
      return payload.itemName ?? "A case was opened";
    case "tribute":
      return `$${(payload.usd ?? 0).toLocaleString("en-US")} tributed all-time`;
    default:
      return payload.rank ? `Devotion Rank #${payload.rank}` : "Unranked in Devotion";
  }
}

export function getCourtSealSecondary(payload: CourtSealPayload) {
  switch (payload.board) {
    case "click":
      return `${(payload.clicks ?? 0).toLocaleString("en-US")} weekly clicks`;
    case "furnace": {
      const rank = getFurnaceRank(payload.burned ?? 0);
      return payload.handle ? `${payload.handle} · ${rank.name}` : rank.name;
    }
    case "crate": {
      const rarity = payload.rarity ? payload.rarity.toUpperCase() : "";
      return payload.handle ? `${rarity} · pulled by ${payload.handle}` : rarity || "Sealed by Principessa's Court";
    }
    case "tribute":
      return payload.handle ?? "A member of her court";
    default:
      return "Sealed by Principessa's Court";
  }
}

// The pre-filled post text for the X intent. Short on purpose: the card image
// does the talking, the text only has to survive being quoted.
export function getCourtSealShareText(payload: CourtSealPayload) {
  switch (payload.board) {
    case "furnace":
      return `I burned ${(payload.burned ?? 0).toLocaleString("en-US")} of her Money and got nothing back.`;
    case "crate":
      return `Pulled ${payload.itemName ?? "something"} from Principessa's cases.`;
    case "tribute":
      return `$${(payload.usd ?? 0).toLocaleString("en-US")} tributed to Principessa. So far.`;
    case "streak":
      return `${payload.streak ?? 0} days of showing up for Principessa.`;
    default:
      return "Sealed by Principessa's Court.";
  }
}
