// Findom wheels, shared with Principessa2DFD through public.wheel_spins - both
// sites MUST show the same wheels, so this table and the Court's copy in
// lib/wheels.ts are kept identical.
//
// A spin costs Principessa Money; the result is not a prize but an ORDER, a
// debt settled in PM by the debtor or by anyone else. Because settlement is in
// PM rather than a fixed-price Throne product, amounts are free - a wheel may
// land on $7 or $30. Chastity is the exception: its result is HOURS, applied
// on the spot, no payment involved.
//
// Weights are per-wheel percentages (each wheel adds up to 100) and are
// deliberately bottom-heavy: if the big numbers came up often nobody would
// clear their debt and every wheel would sit blocked on an unpaid spin.

export const WHEEL_IDS = ["broke", "principessa", "luxury", "chastity"] as const;
export type WheelId = (typeof WHEEL_IDS)[number];

export type WheelKind = "money" | "chastity";

export type WheelSegment = {
  // USD for money wheels, HOURS for the chastity wheel.
  amount: number;
  label: string;
  weight: number;
  throneUrl?: string;
};

// The full Throne catalogue, one entry per fixed-price item. This map is the
// ONLY place Throne item URLs live (the birthday wishlist reads it too) - when
// the wishlist is recreated on Throne, updating these ten lines fixes every
// link on the site. Item ids current as of the 2026-08-27 wishlist rebuild.
export const THRONE_ITEMS: Record<number, { name: string; url: string }> = {
  1: { name: "Click Me", url: "https://throne.com/principessa2dfd/item/180462b7-1de9-49e0-82ca-6cc370498fb5" },
  5: { name: "Broke Puppies 🐶", url: "https://throne.com/principessa2dfd/item/a33b6eb0-938c-4823-810d-0c7b5ecb5ff4" },
  10: { name: "Sweet Start", url: "https://throne.com/principessa2dfd/item/7d6fc436-a338-468c-95cf-71e0f8f46be3" },
  15: { name: "Little Treat", url: "https://throne.com/principessa2dfd/item/d1ea1dcd-abf9-415b-ab28-d8ce643d92d1" },
  25: { name: "Charmed", url: "https://throne.com/principessa2dfd/item/a940071e-3499-423c-a7b6-42d6c73e4aaf" },
  50: { name: "Kneel", url: "https://throne.com/principessa2dfd/item/f2648ab6-0b19-4eec-b07c-d603d2ed44c0" },
  75: { name: "Pampered Princess", url: "https://throne.com/principessa2dfd/item/262ea593-7e6f-48ee-a83a-950fc7378dcf" },
  100: { name: "Made Principessa's Day", url: "https://throne.com/principessa2dfd/item/dc580a5a-47ea-45a5-ac0d-7938d5d52d9c" },
  250: { name: "Huge Drain", url: "https://throne.com/principessa2dfd/item/5c5b490c-acce-4f06-b230-d09559465999" },
  500: { name: "Principessa's ATM", url: "https://throne.com/principessa2dfd/item/35da1e52-0b5e-4d5b-995f-a82b9245244c" },
};

// Debts are settled in Principessa Money, so a segment no longer has to line up
// with a fixed-price Throne product - any amount is allowed and the label is
// just the number. THRONE_ITEMS stays: the birthday wishlist still reads it.
function moneySegment(amount: number, weight: number): WheelSegment {
  return { amount, label: `$${amount}`, weight };
}

export type WheelDefinition = {
  id: WheelId;
  title: string;
  blurb: string;
  kind: WheelKind;
  spinCostPm: number;
  accent: string;
  segments: WheelSegment[];
};

export const WHEELS: Record<WheelId, WheelDefinition> = {
  broke: {
    id: "broke",
    title: "Broke Wheel",
    blurb: "For wallets that flinch. Small orders, no excuses.",
    kind: "money",
    spinCostPm: 1,
    accent: "#a1a1aa",
    segments: [
      moneySegment(1, 24),
      moneySegment(2, 28),
      moneySegment(3, 28),
      moneySegment(5, 17),
      moneySegment(10, 3),
    ],
  },
  principessa: {
    id: "principessa",
    title: "Principessa Wheel",
    blurb: "Her standard table. Anything from pocket change to a proper tribute.",
    kind: "money",
    spinCostPm: 3,
    accent: "#ec4899",
    segments: [
      moneySegment(1, 5),
      moneySegment(3, 8),
      moneySegment(5, 17),
      moneySegment(7, 18),
      moneySegment(10, 23),
      moneySegment(15, 16),
      moneySegment(20, 9),
      moneySegment(25, 4),
    ],
  },
  luxury: {
    id: "luxury",
    title: "Luxury Wheel",
    blurb: "No small numbers on this one. Spin it only if you mean it.",
    kind: "money",
    spinCostPm: 5,
    accent: "#e6ba73",
    segments: [
      moneySegment(5, 3),
      moneySegment(7, 5),
      moneySegment(10, 10),
      moneySegment(15, 14),
      moneySegment(20, 17),
      moneySegment(25, 21),
      moneySegment(30, 17),
      moneySegment(40, 8),
      moneySegment(50, 3),
      moneySegment(75, 1),
      moneySegment(100, 1),
    ],
  },
  chastity: {
    id: "chastity",
    title: "Chastity Wheel",
    blurb: "Not money. Hours. The counter runs whether you like the number or not.",
    kind: "chastity",
    spinCostPm: 1,
    accent: "#a78bfa",
    segments: [
      { amount: 4, label: "4h", weight: 3 },
      { amount: 8, label: "8h", weight: 5 },
      { amount: 12, label: "12h", weight: 7 },
      { amount: 18, label: "18h", weight: 10 },
      { amount: 24, label: "24h", weight: 15 },
      { amount: 30, label: "30h", weight: 15 },
      { amount: 36, label: "36h", weight: 13 },
      { amount: 48, label: "48h", weight: 10 },
      { amount: 60, label: "60h", weight: 7 },
      { amount: 72, label: "72h", weight: 5 },
      { amount: 90, label: "90h", weight: 3 },
      { amount: 100, label: "100h", weight: 3 },
      { amount: 120, label: "120h", weight: 2 },
      { amount: 180, label: "180h", weight: 1 },
      { amount: 240, label: "240h", weight: 1 },
    ],
  },
};

export function isWheelId(value: unknown): value is WheelId {
  return typeof value === "string" && WHEEL_IDS.includes(value as WheelId);
}

// Server-side only in practice, but pure: the route rolls, the client animates
// to whatever index the server reports.
export function pickWheelSegmentIndex(wheelId: WheelId, roll: number): number {
  const segments = WHEELS[wheelId].segments;
  const total = segments.reduce((sum, segment) => sum + segment.weight, 0);
  let cursor = Math.max(0, Math.min(0.999999, roll)) * total;
  for (let index = 0; index < segments.length; index += 1) {
    cursor -= segments[index].weight;
    if (cursor < 0) return index;
  }
  return segments.length - 1;
}

export type WheelVisualSlice = WheelSegment & { segmentIndex: number };

// A physical-looking wheel needs repeated equal-size slices, not one equal
// slice per unique result. Twenty-four slices keep labels readable while the
// number of appearances tracks the real weights. Exact percentages remain in
// the legend; this array only decides where the already-rolled result lands.
export function buildWheelVisualSlices(wheelId: WheelId, targetSlices = 24): WheelVisualSlice[] {
  const segments = WHEELS[wheelId].segments;
  const sliceCount = Math.max(segments.length, Math.floor(targetSlices));
  const totalWeight = segments.reduce((sum, segment) => sum + segment.weight, 0);
  const rawCounts = segments.map((segment) => (segment.weight / totalWeight) * sliceCount);
  const counts = rawCounts.map(Math.floor);
  let assigned = counts.reduce((sum, count) => sum + count, 0);

  const remainderOrder = rawCounts
    .map((count, index) => ({ fraction: count - Math.floor(count), index }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);
  for (let cursor = 0; assigned < sliceCount; cursor += 1) {
    counts[remainderOrder[cursor % remainderOrder.length].index] += 1;
    assigned += 1;
  }

  // Even the rarest result gets a visible slice. Borrow it from the most
  // common result so every possible outcome exists on the face.
  for (let index = 0; index < counts.length; index += 1) {
    if (counts[index] > 0) continue;
    let donor = 0;
    for (let candidate = 1; candidate < counts.length; candidate += 1) {
      if (counts[candidate] > counts[donor]) donor = candidate;
    }
    if (counts[donor] > 1) {
      counts[donor] -= 1;
      counts[index] = 1;
    }
  }

  // Smooth weighted round-robin spreads duplicates around the wheel instead
  // of merging them into one misleadingly wide block.
  const scores = counts.map(() => 0);
  const used = counts.map(() => 0);
  const slices: WheelVisualSlice[] = [];
  for (let position = 0; position < sliceCount; position += 1) {
    let selected = -1;
    for (let index = 0; index < counts.length; index += 1) {
      if (used[index] >= counts[index]) continue;
      scores[index] += counts[index];
      if (selected === -1 || scores[index] > scores[selected]) selected = index;
    }
    if (selected === -1) break;
    scores[selected] -= sliceCount;
    used[selected] += 1;
    slices.push({ ...segments[selected], segmentIndex: selected });
  }

  return slices;
}

export type WheelSpinRecord = {
  id: string;
  wheelId: WheelId;
  segmentLabel: string;
  amount: number;
  kind: WheelKind;
  payCode: string | null;
  amountOwedUsd: number;
  amountPaidUsd: number;
  status: "unpaid" | "paid" | "settled" | "waived";
  createdAt: string;
};
