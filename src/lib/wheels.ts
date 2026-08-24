// Findom wheels. A spin costs Principessa Money; the result is not a prize but
// an ORDER - the exact Throne item the wheel landed on, to be sent with the
// spin's WL- pay code. Chastity is the exception: its result is days, settled
// on the spot, no payment involved.
//
// Segments map 1:1 onto real Throne items because Throne does not accept
// custom amounts - a wheel that lands on $12 would be an order nobody can
// place. Weights are deliberately bottom-heavy: if $100 came up often, nobody
// would pay their debt and every wheel would sit blocked on an unpaid spin.

export const WHEEL_IDS = ["broke", "principessa", "luxury", "chastity"] as const;
export type WheelId = (typeof WHEEL_IDS)[number];

export type WheelKind = "money" | "chastity";

export type WheelSegment = {
  // USD for money wheels, days for the chastity wheel.
  amount: number;
  label: string;
  weight: number;
  throneUrl?: string;
};

// The full Throne catalogue, one entry per fixed-price item.
export const THRONE_ITEMS: Record<number, { name: string; url: string }> = {
  1: { name: "Click Click Click", url: "https://throne.com/principessa2dfd/item/591d37f2-5212-4468-a3d4-c478d786310a" },
  5: { name: "Little Treat", url: "https://throne.com/principessa2dfd/item/7e929c6d-70b9-49b4-9cbd-54867a4cbc76" },
  10: { name: "Broke Puppies", url: "https://throne.com/principessa2dfd/item/b3d608f2-cffa-4bc7-9a08-69b1fea22db6" },
  15: { name: "Vault Mistress", url: "https://throne.com/principessa2dfd/item/076cfe74-0112-4870-8b61-75474d126d26" },
  25: { name: "Spoil Me", url: "https://throne.com/principessa2dfd/item/448a7307-ecc9-414c-bb40-1616dca109ef" },
  50: { name: "Premium Spoil", url: "https://throne.com/principessa2dfd/item/5ff722de-06f2-47fa-9965-4cfa39f1ce90" },
  75: { name: "Great Treatment", url: "https://throne.com/principessa2dfd/item/3fa5b9bb-f12f-4453-9a83-246b9bd76bd5" },
  100: { name: "Goddess Level", url: "https://throne.com/principessa2dfd/item/b6af5dad-4bb4-4451-9919-4e78f06ecba3" },
  250: { name: "Good Boy", url: "https://throne.com/principessa2dfd/item/6de33cb3-2c10-4d38-8bb9-cbf1c433c9cf" },
  500: { name: "ATM", url: "https://throne.com/principessa2dfd/item/f20d9bbd-dbe7-4c23-961d-d7d4af0d6043" },
};

function moneySegment(amount: number, weight: number): WheelSegment {
  const item = THRONE_ITEMS[amount];
  return { amount, label: item.name, throneUrl: item.url, weight };
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
      moneySegment(1, 40),
      moneySegment(5, 30),
      moneySegment(10, 20),
      moneySegment(15, 10),
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
      moneySegment(1, 18),
      moneySegment(5, 22),
      moneySegment(10, 20),
      moneySegment(15, 14),
      moneySegment(25, 12),
      moneySegment(50, 8),
      moneySegment(75, 4),
      moneySegment(100, 2),
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
      moneySegment(25, 35),
      moneySegment(50, 30),
      moneySegment(75, 18),
      moneySegment(100, 12),
      moneySegment(250, 5),
    ],
  },
  chastity: {
    id: "chastity",
    title: "Chastity Wheel",
    blurb: "Not money. Days. The counter runs whether you like the number or not.",
    kind: "chastity",
    spinCostPm: 1,
    accent: "#a78bfa",
    segments: [
      { amount: 1, label: "1 day", weight: 30 },
      { amount: 2, label: "2 days", weight: 25 },
      { amount: 3, label: "3 days", weight: 20 },
      { amount: 5, label: "5 days", weight: 12 },
      { amount: 7, label: "7 days", weight: 8 },
      { amount: 10, label: "10 days", weight: 4 },
      { amount: 14, label: "14 days", weight: 1 },
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
