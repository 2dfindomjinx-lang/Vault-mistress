import { formatHandle } from "@/lib/username";

// Birthday cake event - a public, no-login page at /birthday-2026 that fills a cake
// with candles as Throne tributes land during the birthday window.
//
// This file is the single source of truth for the window and the candle rate.
// The SQL function takes all three as parameters rather than hardcoding them,
// so changing a number here needs no migration.

// 22nd birthday: 14 August 2026, GMT+3.
//
// THE WINDOW IS 48 HOURS, NOT ONE CALENDAR DAY, AND THAT IS DELIBERATE.
//
// A strict GMT+3 day would run 14 Aug 00:00-24:00 local, which is 13 Aug
// 14:00 - 14 Aug 14:00 in Los Angeles. Someone tributing at 8pm on their own
// 14 August lands at 15 Aug 06:00 GMT+3 and would miss the cake entirely while
// their phone still says it is her birthday. That is the exact complaint that
// prompted this window.
//
// So the window is a flat 48 hours starting 13 Aug 14:00 GMT+3 (= 11:00 UTC).
// That covers the whole of 14 August for every inhabited time zone from UTC+13
// (Samoa/Tonga) through UTC-11 (Niue, American Samoa):
//   * UTC+13 hits 14 Aug 00:00 exactly when the window opens.
//   * UTC-11 finishes its 14 Aug exactly when the window closes.
// Only Kiritimati (UTC+14) falls outside, and nobody there is tributing.
//
// TO USE A STRICT GMT+3 DAY INSTEAD: set these to
//   "2026-08-14T00:00:00+03:00" / "2026-08-15T00:00:00+03:00".
// Nothing else changes - the SQL takes the window as a parameter.
export const BIRTHDAY_STARTS_AT = "2026-08-13T14:00:00+03:00";
export const BIRTHDAY_ENDS_AT = "2026-08-15T14:00:00+03:00";
export const BIRTHDAY_DAY = "2026-08-14T00:00:00+03:00";

// Applied only to the base Principessa Money earned from a signed Throne
// payment inside the birthday window. Existing Pet/conversion bonuses keep
// their own bases and are never multiplied by this event.
export const BIRTHDAY_MONEY_BONUS_PERCENT = 0.5;

// One candle per $10. 22 candles = $220 for a full cake.
//
// The rate is deliberately well below the $50 first floated: all-time Throne
// earnings are ~$1,753 accumulated over months, so a week at $50/candle would
// realistically light 2-6 candles. A visibly empty cake reads as "nobody
// cared", which is the opposite of what the page is for. At $10 the cake fills
// fast enough to feel alive while the full 22 stays a genuine stretch.
export const BIRTHDAY_CANDLE_USD = 10;
export const BIRTHDAY_TARGET_CANDLES = 22;
export const BIRTHDAY_TARGET_USD = BIRTHDAY_CANDLE_USD * BIRTHDAY_TARGET_CANDLES;

// Whether the public page prints the handle of whoever lit each candle.
// Only tributes that carried a tribute code can be attributed at all; the rest
// are anonymous regardless. Flip to false to make every candle anonymous.
export const BIRTHDAY_SHOW_SUPPORTER_NAMES = true;

// The page polls rather than holding a socket open - the webhook writes to the
// database and this reads it back, so a slow poll is enough to feel live.
export const BIRTHDAY_POLL_INTERVAL_MS = 25_000;

export type BirthdayCandle = {
  index: number;
  username: string | null;
  displayName: string | null;
  litAt: string | null;
};

export type BirthdayProgress = {
  raisedUsd: number;
  candleUsd: number;
  candlesLit: number;
  lit: BirthdayCandle[];
};

// Principessa's birthday wishlist. These are intentionally presented as gifts,
// never as candle bundles or progress tiers. The public page sends visitors to
// Throne for checkout, but the wishlist has its own language and visual section
// so choosing a present does not feel like buying candle progress.
//
// Every card owns its exact Throne item URL. Keeping the URL required prevents
// a wishlist card from silently falling back to the generic profile page.
export type BirthdayGift = {
  id: string;
  name: string;
  blurb: string;
  usd: number;
  accent: string;
  ribbon: string;
  url: string;
};

export const BIRTHDAY_GIFTS: BirthdayGift[] = [
  {
    id: "rose",
    name: "A Rose",
    blurb: "A small devotion, chosen in her colours and left at her throne.",
    usd: 10,
    accent: "#e6ba73",
    ribbon: "#be185d",
    url: "https://throne.com/principessa2dfd/item/b3d608f2-cffa-4bc7-9a08-69b1fea22db6",
  },
  {
    id: "ribbon",
    name: "Velvet Ribbon",
    blurb: "A polished little offering with Principessa's name on the card.",
    usd: 25,
    accent: "#f0abfc",
    ribbon: "#a21caf",
    url: "https://throne.com/principessa2dfd/item/448a7307-ecc9-414c-bb40-1616dca109ef",
  },
  {
    id: "indulgence",
    name: "Private Indulgence",
    blurb: "Something selected for Principessa simply because she wants it.",
    usd: 50,
    accent: "#7dd3fc",
    ribbon: "#0369a1",
    url: "https://throne.com/principessa2dfd/item/5ff722de-06f2-47fa-9965-4cfa39f1ce90",
  },
  {
    id: "bouquet",
    name: "The Royal Bouquet",
    blurb: "A dramatic arrangement worthy of the centre of her birthday court.",
    usd: 75,
    accent: "#fda4af",
    ribbon: "#be123c",
    url: "https://throne.com/principessa2dfd/item/3fa5b9bb-f12f-4453-9a83-246b9bd76bd5",
  },
  {
    id: "velvet-box",
    name: "The Velvet Box",
    blurb: "Substantial, immaculate, and impossible for her court to overlook.",
    usd: 100,
    accent: "#fb7185",
    ribbon: "#7f1d1d",
    url: "https://throne.com/principessa2dfd/item/b6af5dad-4bb4-4451-9919-4e78f06ecba3",
  },
  {
    id: "crown-jewel",
    name: "The Crown Jewel",
    blurb: "The unforgettable gift. The one that makes the whole court look twice.",
    usd: 250,
    accent: "#fde68a",
    ribbon: "#b45309",
    url: "https://throne.com/principessa2dfd/item/6de33cb3-2c10-4d38-8bb9-cbf1c433c9cf",
  },
];

export function getBirthdayWindowState(now: Date | number | string = new Date()) {
  const nowMs = new Date(now).getTime();
  const startMs = new Date(BIRTHDAY_STARTS_AT).getTime();
  const endMs = new Date(BIRTHDAY_ENDS_AT).getTime();
  const dayMs = new Date(BIRTHDAY_DAY).getTime();

  return {
    hasEnded: nowMs >= endMs,
    hasStarted: nowMs >= startMs,
    // Live = inside the 48h counting window, which opens ~10h before GMT+3
    // midnight so the earliest time zones are already on 14 August.
    isLive: nowMs >= startMs && nowMs < endMs,
    isBirthday: nowMs >= dayMs && nowMs < dayMs + 24 * 60 * 60 * 1000,
    msUntilBirthday: Math.max(0, dayMs - nowMs),
    msUntilEnd: Math.max(0, endMs - nowMs),
    msUntilStart: Math.max(0, startMs - nowMs),
  };
}

// Dollars still needed to light the next candle. Returns 0 once every candle
// on the cake is lit - past the target there is no "next" one to chase.
export function getRemainingToNextCandle(raisedUsd: number, candlesLit: number) {
  if (candlesLit >= BIRTHDAY_TARGET_CANDLES) return 0;
  const nextCandleAt = (candlesLit + 1) * BIRTHDAY_CANDLE_USD;
  return Math.max(0, Math.round((nextCandleAt - raisedUsd) * 100) / 100);
}

export function formatUsd(amount: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    minimumFractionDigits: 2,
    style: "currency",
  }).format(Math.max(0, Number(amount) || 0));
}

// One entry per candle slot, lit or not. The unlit slots are rendered as dim
// outlines rather than omitted: seeing 19 empty holders next to 3 lit ones is
// the entire pitch of the page, and a cake that merely grows hides the target.
export function buildCandleSlots(progress: BirthdayProgress | null): BirthdayCandle[] {
  const litByIndex = new Map<number, BirthdayCandle>();
  for (const candle of progress?.lit ?? []) {
    litByIndex.set(candle.index, candle);
  }

  return Array.from({ length: BIRTHDAY_TARGET_CANDLES }, (_, offset) => {
    const index = offset + 1;
    return (
      litByIndex.get(index) ?? { displayName: null, index, litAt: null, username: null }
    );
  });
}

// The roll call prints both lines when it has them: a display name is what
// someone chose to be called, the handle is how the rest of the court finds
// them. Falling back to one line when there is no display name keeps the row
// from carrying an empty second line.
export function resolveSupporterIdentity(candle: BirthdayCandle): {
  primary: string;
  secondary: string | null;
} {
  if (!BIRTHDAY_SHOW_SUPPORTER_NAMES) return { primary: "Lit", secondary: null };
  const displayName = candle.displayName?.trim();
  const username = candle.username?.trim();
  const handle = username ? formatHandle(username) : null;
  if (displayName) return { primary: displayName, secondary: handle };
  if (handle) return { primary: handle, secondary: null };
  return { primary: "Anonymous", secondary: null };
}

// Single line, for the cake's screen-reader roster where the two-line layout
// of the roll call has nothing to hang on.
export function resolveSupporterLabel(candle: BirthdayCandle) {
  const { primary, secondary } = resolveSupporterIdentity(candle);
  return secondary ? `${primary} (${secondary})` : primary;
}

// Shown in the unlit slots of the roll call. The next holder in line gets the
// direct invitation; the rest stay quiet so the eye lands on the one that is
// actually up for grabs. Rotating several phrasings was tried first and read
// as a machine cycling through synonyms.
export function resolveEmptyCandleInvite(candleIndex: number, candlesLit: number) {
  return candleIndex === candlesLit + 1 ? "Your name could be here" : "Unclaimed";
}
