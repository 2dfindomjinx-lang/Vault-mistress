"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CrateRarity } from "@/lib/crates";
import {
  RARITY_COLORS,
  getRarityColor,
  CRATE_TYPES,
  SAMPLE_CRATE_ITEMS,
  RARITY_ORDER,
  getCrateIconUrl,
  getCrateItemImageUrl,
} from "@/lib/crates";
import { getAdjustedCrateDrops, getCrateCostMultiplier, hasFreeCrateOpen } from "@/lib/crate-events";
import type { RandomEvent } from "@/lib/events";
import { CoinAmount } from "@/components/CoinAmount";
import { emitSoundEvent } from "@/lib/sound";

export type CrateDefinition = {
  crate_type: string;
  name: string;
  description: string;
  cost: number;
  icon_url?: string;
};

export type CrateInventoryItem = {
  item_id: string;
  name: string;
  description: string;
  image_url?: string | null;
  rarity: CrateRarity;
  collection?: string | null;
  sell_value: number;
  variant: string;
  quantity: number;
};

type WonItem = {
  item_id: string;
  name: string;
  description: string;
  image_url?: string | null;
  rarity: CrateRarity;
  collection?: string | null;
  sell_value: number;
  variant: string;
};

type CratesPanelProps = {
  coins: number;
  disabled?: boolean;
  crates: CrateDefinition[];
  inventory: CrateInventoryItem[];
  onOpenCrate: (
    crateType: string,
    quantity?: number,
  ) => Promise<{
    success: boolean;
    result?: { item?: WonItem; items?: WonItem[]; newCoins: number };
    error?: string;
  }>;
  onSellItem: (itemId: string, variant: string, quantity?: number) => Promise<{ success: boolean; newCoins?: number; error?: string }>;
  onSellAll?: () => Promise<{ success: boolean; newCoins?: number; totalValue?: number; itemCount?: number; error?: string }>;
  onSellDuplicates?: () => Promise<{ success: boolean; newCoins?: number; totalValue?: number; itemCount?: number; error?: string }>;
  onSellWonItems?: (items: Array<{ itemId: string; variant: string; quantity: number }>) => Promise<{
    success: boolean;
    newCoins?: number;
    totalValue?: number;
    itemCount?: number;
    error?: string;
  }>;
  pityStats?: { principessa_bad_luck?: number; blessing_legendary_pity?: number };
  activeEvents?: RandomEvent[];
  crateOpenCredits?: Record<string, number>;
  freeOpensUsedToday?: Record<string, boolean>;
  onCrateOpen?: () => void;
  onCrateResult?: (item: WonItem) => void;
  pending?: boolean;
};

function CrateResultIconFrame({ item }: { item: WonItem }) {
  const imageUrl = getCrateItemImageUrl(item.item_id, item.image_url ?? null);

  return (
    <div className="relative mx-auto mt-4 h-28 w-28">
      <div className={`absolute inset-0 rounded-[1.4rem] border-2 ${getRarityColor(item.rarity)} bg-black/65 shadow-[0_0_34px_rgba(244,114,182,0.2)]`} />
      <div className="pointer-events-none absolute inset-0 animate-[spin_5s_linear_infinite]">
        <span className="absolute left-1/2 top-1 h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_16px_rgba(255,255,255,0.95)]" />
        <span className="absolute bottom-1 left-1/2 h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-pink-200 shadow-[0_0_16px_rgba(244,114,182,0.95)]" />
      </div>
      <div className="pointer-events-none absolute inset-[7px] animate-[spin_5s_linear_infinite_reverse]">
        <span className="absolute left-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-white/90 shadow-[0_0_14px_rgba(255,255,255,0.85)]" />
        <span className="absolute right-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-fuchsia-200 shadow-[0_0_14px_rgba(244,114,182,0.85)]" />
      </div>
      <div className="absolute inset-[10px] overflow-hidden rounded-[1rem] border border-white/10 bg-black/60 p-3">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.name}
            className="h-full w-full object-contain"
            onError={(event) => {
              const target = event.target as HTMLImageElement;
              target.style.display = "none";
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">
            {item.rarity === "legendary" ? "👑" : "📦"}
          </div>
        )}
      </div>
    </div>
  );
}

export function CratesPanel({
  coins,
  disabled = false,
  crates,
  inventory,
  onOpenCrate,
  onSellItem,
  onSellAll,
  onSellDuplicates,
  onSellWonItems,
  pityStats = { principessa_bad_luck: 0, blessing_legendary_pity: 0 },
  activeEvents = [],
  crateOpenCredits = {},
  freeOpensUsedToday = {},
  onCrateOpen,
  onCrateResult,
  pending = false,
}: CratesPanelProps) {
  const [isOpening, setIsOpening] = useState(false);
  const [openingCrate, setOpeningCrate] = useState<string | null>(null);
  const [reelItems, setReelItems] = useState<WonItem[]>([]);
  const [sellPending, setSellPending] = useState<string | null>(null);
  const [lastOpenedCrateType, setLastOpenedCrateType] = useState<string | null>(null);
  const [lastOpenedBatchCost, setLastOpenedBatchCost] = useState(0);
  const [flippedCrate, setFlippedCrate] = useState<string | null>(null);

  // Responsive: desktop = classic multi-item horizontal slide reel (5 visible)
  // mobile = current single updating item style (kept as user requested)
  const [isMobile, setIsMobile] = useState(false);
  const [spinSequence, setSpinSequence] = useState<WonItem[]>([]);
  const [reelProgress, setReelProgress] = useState(0);

  const [isVerticalMode, setIsVerticalMode] = useState(false);
  const [openQuantityByCase, setOpenQuantityByCase] = useState<Record<string, number>>({});
  const [wonItems, setWonItems] = useState<WonItem[]>([]);
  const [multiSpinSequences, setMultiSpinSequences] = useState<WonItem[][]>([]);

  const getOpenQuantity = (caseType: string) => openQuantityByCase[caseType] || 1;
  const setOpenQuantityForCase = (caseType: string, q: number) => {
    setOpenQuantityByCase(prev => ({ ...prev, [caseType]: q }));
  };

  const hasFreeOpenToday = (crateType: string) => Boolean(freeOpensUsedToday[crateType]);
  const getGrantedOpenCount = (crateType: string) => Math.max(0, Math.floor(crateOpenCredits[crateType] ?? 0));
  const getBatchOpenCost = (crate: CrateDefinition, qty: number) => {
    const safeQuantity = Math.max(1, Math.floor(qty));
    const grantsApplied = Math.min(safeQuantity, getGrantedOpenCount(crate.crate_type));
    const remainingAfterGrants = Math.max(0, safeQuantity - grantsApplied);
    const eventFreeApplied = hasFreeCrateOpen(activeEvents) && !hasFreeOpenToday(crate.crate_type) && remainingAfterGrants > 0;
    const paidQuantity = Math.max(0, remainingAfterGrants - (eventFreeApplied ? 1 : 0));
    return Math.round(crate.cost * getCrateCostMultiplier(activeEvents)) * paidQuantity;
  };
  const getDisplayedCost = (crate: CrateDefinition) => getBatchOpenCost(crate, 1);

  // Square cards for better icon visibility (icons are square-designed).
  // Exactly 5 visible during slide. Larger squares, same overall area.
  const ITEM_WIDTH = 104;
  const ITEM_GAP = 8; // matches gap-2
  const FULL_SLOT = ITEM_WIDTH + ITEM_GAP;
  const VISIBLE_COUNT = 5;
  const CENTER_INDEX = 2; // middle of 5 (0-based)

  // Compensation so that when progress = someIndex, that item is visually centered under the marker.
  // Using approx center of the 680px container.
  const CENTER_COMPENSATION = 340 - (ITEM_WIDTH / 2); // ~288

  // For animation we use FULL_SLOT as the step
  const SLOT_WIDTH = FULL_SLOT; // for progress calculations
  const CENTER_OFFSET = CENTER_COMPENSATION; // for compatibility with previous naming in some places

  const WINNER_SLOT = 43; // fixed position in the built sequence where the real winner is placed (for exact final centering in result phase too)

  // Ref for direct style transform during spin (butter smooth, no React re-renders of the 50+ item list every tick)
  const stripRef = useRef<HTMLDivElement>(null);
  const reelPanelRef = useRef<HTMLDivElement>(null);
  const verticalReelRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Real-looking item pool for the spinning reel visuals.
  // This lets us show actual item icons (from /crate-items/) during the slide instead of letters.
  // Rarity is conveyed via the colored frame/background (getRarityColor).


  // Mobile detection (affects only the reel visual, not logic)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setIsMobile(window.innerWidth < 768);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (!isMobile || !(isOpening || wonItems.length > 0)) {
      return;
    }

    const target = reelPanelRef.current;
    if (!target) {
      return;
    }

    const timer = window.setTimeout(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);

    return () => window.clearTimeout(timer);
  }, [isMobile, isOpening, wonItems.length]);

  // Total sell value of current inventory (for display when viewing Inventory)
  const inventoryValue = useMemo(() => {
    return inventory.reduce((sum, item) => sum + (item.quantity || 0) * (item.sell_value || 0), 0);
  }, [inventory]);

  // Total number of items (sum of quantities) to display next to value
  const totalItemCount = useMemo(() => {
    return inventory.reduce((sum, item) => sum + (item.quantity || 0), 0);
  }, [inventory]);

  const duplicateInventoryValue = useMemo(() => {
    return inventory.reduce((sum, item) => {
      const duplicateCount = Math.max(0, (item.quantity || 0) - 1);
      const isProtected = item.item_id === "classic" || item.rarity === "legendary";
      if (isProtected || item.sell_value <= 0) {
        return sum;
      }

      return sum + duplicateCount * (item.sell_value || 0);
    }, 0);
  }, [inventory]);

  const duplicateStackCount = useMemo(() => {
    return inventory.reduce((sum, item) => {
      const isProtected = item.item_id === "classic" || item.rarity === "legendary";
      return sum + (!isProtected && (item.quantity || 0) > 1 && item.sell_value > 0 ? 1 : 0);
    }, 0);
  }, [inventory]);

  // Build a long ordered "tape" of items for the classic sliding reel.
  // Uses ONLY the actual items from this crate's drop pool (the 39 real ones).
  // Sampling is weighted by the original drop weights so the visual frequencies
  // roughly reflect the real drop ratios (commons appear a lot, legendaries rarely).
  // Progressive near-miss bias: early = mostly low tier, late = tension with
  // occasional higher tier teases.
  // For blessing_case: legendary near-misses more frequent (high tension due to low base rate).
  // For premium_case: legendary near-misses *extremely* frequent (almost every open has 1-2 box kenarda leg tease).
  //   This is PURELY VISUAL / animation only. Does not affect real drop rates or results at all
  //   (server already decided the winner before building the sequence).
  // For regular: majority epic/rare misses, minority legendary.
  function buildSpinSequence(pool: WonItem[], winner: WonItem, crateType: string = 'principessa_case'): WonItem[] {
    const seq: WonItem[] = [];
    const total = 52;
    const winnerSlot = 43;

    // Weighted picker that respects the configured weights (so visual "oranlarını yansıtacak şekilde")
    const pickWeighted = (): WonItem => {
      const p = pool as any[];
      const totalW = p.reduce((sum, it) => sum + (it.weight || 1), 0);
      let r = Math.random() * totalW;
      for (const it of p) {
        r -= (it.weight || 1);
        if (r <= 0) return it as WonItem;
      }
      return p[p.length - 1] as WonItem;
    };

    for (let i = 0; i < total; i++) {
      if (i === winnerSlot) {
        seq.push({ ...winner });
        continue;
      }

      const p = i / total;

      // Base pick always respects real drop weights/ratios
      let chosen: WonItem = pickWeighted();

      const isBlessing = crateType === 'blessing_case';
      const isPremium = crateType === 'premium_case';

      // Progressive near-miss / drama layer:
      // Early: mostly pool ratios (common/uncommon heavy).
      // Late: tension via near-miss teases.
      // For blessing_case: legendary near-misses more frequent.
      // For premium_case: legendary near-misses extremely frequent (neredeyse her açışta, 1-2 box kenarda).
      //   Pure visual only — real result already decided server-side, no drop rate impact.
      // For regular: majority epic/rare misses, minority legendary.
      // Very late still teases the actual winner sometimes.
      const boostMult = isPremium ? 1.2 : (isBlessing ? 1.2 : 0.95);
      const boostChance = Math.max(0, (p - 0.45) * boostMult);

      if (Math.random() < boostChance) {
        // Decide tease tier for near-miss feel
        const r = Math.random();
        let targetTiers = [];
        if (isPremium) {
          // Premium case: legendary near-misses frequent but toned down from previous exaggerated version.
          // Still much more than normal cases (for tension on this high-cost no-pity case), but not almost every spin.
          if (p > 0.65) {
            targetTiers = ["legendary"];
          } else if (r < 0.55) {
            targetTiers = ["legendary", "epic"];
          } else {
            targetTiers = ["epic", "rare"];
          }
        } else if (isBlessing) {
          // Blessing case: legendary misses more frequent, especially mid-late
          if (p > 0.65 && r < 0.38) {
            targetTiers = ["legendary"];
          } else if (r < 0.55) {
            targetTiers = ["epic", "rare", "legendary"];
          } else {
            targetTiers = ["rare", "uncommon"];
          }
        } else {
          if (p > 0.78 && r < 0.12) {
            // small chance for legendary tease very late (minority)
            targetTiers = ["legendary"];
          } else if (r < 0.72) {
            // majority epic (sometimes rare) for epic misses
            targetTiers = ["epic", "rare"];
          } else {
            targetTiers = ["rare", "uncommon"];
          }
        }

        let candidates = pool.filter((it: any) =>
          targetTiers.includes(it.rarity) ||
          (p > 0.72 && it.item_id === winner.item_id)
        );

        if (candidates.length > 0) {
          // Prefer the actual winner in very late phase for the final tease
          const preferWinnerChance = isBlessing ? 0.55 : 0.5;
          if (p > 0.78 && Math.random() < preferWinnerChance) {
            const winMatch = candidates.find((it: any) => it.item_id === winner.item_id);
            if (winMatch) {
              chosen = winMatch;
            } else {
              chosen = candidates[Math.floor(Math.random() * candidates.length)];
            }
          } else {
            chosen = candidates[Math.floor(Math.random() * candidates.length)];
          }
        }
      }

      // Occasional winner near-miss tease in the final slowdown (classic CS feel)
      // For blessing_case: higher frequency so legendary misses feel more common
      // For premium_case: much higher to create extra tension / near-miss drama
      const winnerTeaseChance = isPremium ? 0.5 : (isBlessing ? 0.32 : 0.18);
      if (p > 0.65 && p < 0.82 && Math.random() < winnerTeaseChance) {
        chosen = winner;
      }

      // Premium-case specific: force legendary near-miss 1 or 2 slots before the winner.
      // Frequent "1 veya 2 box kenarda" legendary miss for premium (much more than normal cases, but toned down from previous exaggerated version).
      // Purely visual (post real-roll), does not touch drop rates or the actual result.
      if (isPremium && (i === winnerSlot - 1 || i === winnerSlot - 2)) {
        if (Math.random() < 0.45) {  // 45% per slot → ~70% of opens have at least one close leg tease (frequent but not abartı)
          const legItems = (pool as any[]).filter((it: any) => it.rarity === "legendary");
          if (legItems.length > 0) {
            chosen = legItems[Math.floor(Math.random() * legItems.length)];
          }
        }
      }

      seq.push({ ...chosen });
    }
    return seq;
  }

  const openCrate = async (crate: CrateDefinition, qty: number = 1) => {
    const batchCost = getBatchOpenCost(crate, qty);
    if (disabled || pending || isOpening || coins < batchCost) return;

    if (onCrateOpen) onCrateOpen();

    // Build visual pool from the ACTUAL crate drops (principessa_case etc.)
    // This ensures the reel ONLY shows the configured 39 items (with their real names, rarities, images).
    // No more generic fakes or items outside the pool.
    const crateDef = CRATE_TYPES[crate.crate_type];
    let visualPool: WonItem[] = [];
    if (crateDef?.drops?.length) {
      const adjustedDrops = getAdjustedCrateDrops(crate.crate_type, activeEvents);
      visualPool = adjustedDrops
        .map((d) => {
          const s = SAMPLE_CRATE_ITEMS[d.item_id];
          if (!s) return null;
          return {
            item_id: d.item_id,
            name: s.name,
            description: s.description || "",
            image_url: s.image_url || `/crate-items/${d.item_id}.png`,
            rarity: s.rarity,
            sell_value: s.sell_value || 0,
            variant: d.variant || "normal",
            weight: d.weight || 1,  // carry original drop weight for realistic visual sampling
          } as any; // extra weight for sampling, not in base WonItem type
        })
        .filter((x): x is WonItem => x !== null);
    }

    // Fallback (should rarely happen)
    if (visualPool.length === 0) {
      visualPool = Array.from({ length: 32 }).map((_, i) => ({
        item_id: `fallback-${i}`,
        name: "Mystery Item",
        description: "",
        rarity: "common" as CrateRarity,
        sell_value: 0,
        variant: "normal",
        image_url: null,
      }));
    }

    // Visual "fake" reel for animation: sample from the real droppables
    const fakeReel: WonItem[] = Array.from({ length: 32 }).map(() => {
      const pick = visualPool[Math.floor(Math.random() * visualPool.length)];
      return { ...pick };
    });

    setReelItems(fakeReel);

    const res = await onOpenCrate(crate.crate_type, qty);
    if (!(res.success && res.result)) {
      const msg = res?.error || "Case open failed.";
      alert(msg);
      return;
    }

    const results: WonItem[] = res.result.items ?? (res.result.item ? [res.result.item] : []);
    if (results.length === 0) return;
    setLastOpenedBatchCost(batchCost);

    // Helper for multi-open outcome based speech category (reuses the crate_result_* pools)
    // Ranges relative to the case's single cost C.
    // net = total won sell values - (C * qty)
    function getOutcomeRarity(net: number, caseCost: number, hasLegendary: boolean): CrateRarity {
      if (net <= -2 * caseCost) {
        return "common"; // aşırı zarar
      } else if (net < 0) {
        return "uncommon"; // zarar
      } else if (net < caseCost) {
        return "rare"; // amorti / küçük kâr
      } else if (net < 5 * caseCost || !hasLegendary) {
        return "epic"; // kâr
      } else {
        return "legendary"; // aşırı kâr + en az 1 legendary
      }
    }

    try {
      // Only NOW start the opening UI + reel (server accepted, we have a real result).
      // This prevents "Reel is spinning" + no animation when API fails (auth, coins, etc.).
      setIsOpening(true);
      setOpeningCrate(crate.name);
      setLastOpenedCrateType(crate.crate_type);
    setWonItems([]);
    setSpinSequence([]);
    setReelProgress(0);
    setReelItems([]);

      setIsVerticalMode(qty > 1);

      setReelItems(fakeReel);

      if (qty > 1) {
        verticalReelRefs.current = Array.from({ length: qty }, () => null);
        const sequences = results.map(r => buildSpinSequence(visualPool, r, crate.crate_type));
        setMultiSpinSequences(sequences);
        // wait for render so refs are assigned
        await new Promise(resolve => setTimeout(resolve, 0));
        await runCrateAnimation(fakeReel, results[0], sequences, true);
      } else {
        setMultiSpinSequences([]);
        const sequence = buildSpinSequence(visualPool, results[0], crate.crate_type);
        setSpinSequence(sequence);
        await runCrateAnimation(fakeReel, results[0], sequence, false);
      }

      setWonItems(results);
      // Play reveal sound based on whether the batch result includes a legendary (for multi or single)
      // This ensures the special legendary reveal sound plays when a legendary is won, tied to the result reveal.
      const hasLegInResult = results.some(r => r.rarity === "legendary");
      if (hasLegInResult) {
        emitSoundEvent("crate_legendary_reveal");
      } else if (results.length > 0) {
        emitSoundEvent("crate_reveal");
      }
      if (onCrateResult && results.length > 0) {
        if (results.length > 1) {
          // Multi-open: use net outcome to decide speech category (reuses crate_result_* message pools)
          // net = total value won - the actual batch cost we paid
          const totalWon = results.reduce((s, r) => s + r.sell_value, 0);
          const batchNet = totalWon - lastOpenedBatchCost;
          const hasLeg = results.some(r => r.rarity === "legendary");
          const effectiveRarity = getOutcomeRarity(batchNet, Math.max(1, lastOpenedBatchCost || crate.cost), hasLeg);
          const dummyItem: WonItem = {
            item_id: "multi-outcome",
            name: "Multi Outcome",
            description: "",
            rarity: effectiveRarity,
            sell_value: 0,
            variant: "normal",
          };
          onCrateResult(dummyItem);
        } else {
          onCrateResult(results[0]);
        }
      }
      // Parent will have already updated coins via response
    } finally {
      setIsOpening(false);
      setOpeningCrate(null);
    }
  };

  async function runCrateAnimation(fakeReel: WonItem[], realItem: WonItem, sequence: WonItem[] | WonItem[][], isVertical: boolean = false) {
    // Proper optimized animation using requestAnimationFrame for true smooth 60fps+ slide.
    // Time-based easing over ~8.2 seconds. Direct ref.style.transform updates (no per-frame React re-renders of the strip).
    // Sounds scheduled separately to preserve the dramatic slowing "reel tick" rhythm without affecting visual smoothness.
    // The pre-built sequence already has near-miss bias (mostly epic/rare teases, few legendary) + winner placement for classic case opening feel.
    return new Promise<void>((resolve) => {
      const duration = 8200; // ms — solid 8+ seconds as requested
      const startTime = performance.now();

      // Winner placement from buildSpinSequence.
      // We drive progress so that the item at WINNER_SLOT is the one centered at the end.
      const WINNER_SLOT = 43;
      const TARGET_PROGRESS = WINNER_SLOT; // the logical index we want under the marker at the end

      const ITEM_SIZE = 104;
      const ITEM_GAP = 8;
      const STEP = ITEM_SIZE + ITEM_GAP;
      const VISIBLE_SIZE = 120;
      const CENTER_OFFSET = (VISIBLE_SIZE - ITEM_SIZE) / 2; // 8px to center item in visible area

      // Sound scheduler: mimics the old variable-delay ticks for authentic feel (independent of visual rAF)
      let soundTick = 0;
      const maxSoundTicks = 65;
      const scheduleSoundTick = (delay: number) => {
        setTimeout(() => {
          if (soundTick < maxSoundTicks) {
            emitSoundEvent("crate_reel_tick");
            soundTick++;
            const p = soundTick / maxSoundTicks;
            const nextDelay = Math.floor(38 + (240 - 38) * Math.pow(p, 1.7));
            scheduleSoundTick(nextDelay);
          }
        }, delay);
      };
      scheduleSoundTick(38); // kick off the rhythmic ticks

      // Pure rAF visual animation — buttery smooth motion
      const animate = (now: number) => {
        const elapsed = now - startTime;
        const p = Math.min(1, elapsed / duration);

        // IMPORTANT: fast start, strong slowdown at the end (classic case opening feel)
        // Early: strip flies by quickly. Late: crawls for near-miss suspense, then stops.
        // Using ease-out on the reel progress (opposite of ease-in).
        const eased = 1 - Math.pow(1 - p, 1.85);
        const newProg = Math.min(TARGET_PROGRESS, eased * TARGET_PROGRESS);

        // Direct DOM update = high FPS, no React overhead during spin
        if (isVertical) {
          const seqs = sequence as WonItem[][];
          seqs.forEach((s, i) => {
            const strip = verticalReelRefs.current[i];
            if (strip) {
              const y = -newProg * STEP + CENTER_OFFSET;
              strip.style.transform = `translateY(${y}px)`;
            }
          });
        } else if (stripRef.current) {
          const x = -newProg * FULL_SLOT + CENTER_COMPENSATION;
          stripRef.current.style.transform = `translateX(${x}px)`;
        }

        // Very light state for mobile single-view sampling (throttled) - skip for vertical multi
        if (!isVertical && isMobile && soundTick % 3 === 0) {
          const approxCenter = Math.max(0, Math.min((sequence as WonItem[]).length - 1, Math.round(newProg)));
          const displayForMobile = (sequence as WonItem[])[approxCenter] || realItem;
          const newReel = [...fakeReel];
          newReel[newReel.length - 1] = displayForMobile;
          setReelItems(newReel);
          setReelProgress(newProg);
        }

        if (p < 1) {
          requestAnimationFrame(animate);
        } else {
          // Final settle - force exact centering of the winner (the item we placed at WINNER_SLOT in the sequence)
          // This guarantees that the item visually under the marker at the end of the spin is the exact real result.
          const winnerIndexInSeq = WINNER_SLOT;
          if (isVertical) {
            const seqs = sequence as WonItem[][];
            seqs.forEach((s, i) => {
              const strip = verticalReelRefs.current[i];
              if (strip) {
                const exactY = -(winnerIndexInSeq * STEP) + CENTER_OFFSET;
                strip.style.transform = `translateY(${exactY}px)`;
              }
            });
          } else if (stripRef.current) {
            const exactX = -(winnerIndexInSeq * FULL_SLOT) + CENTER_COMPENSATION;
            stripRef.current.style.transform = `translateX(${exactX}px)`;
          }

          // Ensure mobile shows the winner (skip for vertical)
          if (!isVertical) {
            const finalReel = [...fakeReel];
            finalReel[finalReel.length - 1] = realItem;
            setReelItems(finalReel);
            setReelProgress(TARGET_PROGRESS);
          }

          // One final reel tick just as the slide settles (landing clunk), before the reveal sound
          emitSoundEvent("crate_reel_tick");

          // Reveal sound (after the slide has stopped)
          setTimeout(() => {
            resolve();
          }, 280);
        }
      };

      // Prime the strip at starting position
      if (isVertical) {
        const seqs = sequence as WonItem[][];
        seqs.forEach((s, i) => {
          const strip = verticalReelRefs.current[i];
          if (strip) {
            strip.style.transform = `translateY(${CENTER_OFFSET}px)`;
          }
        });
      } else if (stripRef.current) {
        stripRef.current.style.transform = `translateX(${CENTER_COMPENSATION}px)`;
      }

      requestAnimationFrame(animate);
    });
  }

  const sellItem = async (item: CrateInventoryItem, qty: number = 1) => {
    if (disabled || sellPending) return;
    if (item.item_id === "classic") return;

    // Only show confirmation for Legendary items
    if (item.rarity === "legendary") {
      const confirmSell = window.confirm(
        `Sell ${qty} "${item.name}" for ${item.sell_value * qty} coins?`
      );
      if (!confirmSell) return;
    }

    setSellPending(item.item_id + item.variant);

    try {
      const res = await onSellItem(item.item_id, item.variant, qty);
      if (res.success) {
        emitSoundEvent("cosmetic_purchased");
        // Parent component should refetch or update state
      } else {
        alert("Sale failed. You may no longer own this item.");
      }
    } catch (e) {
      console.error("Sell error", e);
      alert("Failed to sell item.");
    } finally {
      setSellPending(null);
    }
  };

  const sellAllWonItems = async () => {
    if (!wonItems.length) return;

    const sellableWonItems = wonItems.filter((item) => item.item_id !== "classic" && item.rarity !== "legendary");
    if (sellableWonItems.length === 0) {
      alert("There are no sellable won items. Legendary items stay locked and must be sold one by one.");
      return;
    }

    const totalValue = sellableWonItems.reduce((sum, item) => sum + item.sell_value, 0);
    const confirmSell = window.confirm(
      `Sell ${sellableWonItems.length} sellable won items for ${totalValue} coins?\n\nLegendary items in this batch will stay locked and are not included.`
    );
    if (!confirmSell) return;

    const grouped = Array.from(
      sellableWonItems.reduce((map, item) => {
        const key = `${item.item_id}:${item.variant}`;
        const current = map.get(key) ?? {
          itemId: item.item_id,
          variant: item.variant,
          quantity: 0,
        };
        current.quantity += 1;
        map.set(key, current);
        return map;
      }, new Map<string, { itemId: string; variant: string; quantity: number }>()),
    ).map(([, value]) => value);

    const res = onSellWonItems
      ? await onSellWonItems(grouped)
      : ({ success: false } as const);

    if (!res.success) {
      alert(("error" in res && res.error) || "Sale failed. You may no longer own some of these items.");
      return;
    }

    emitSoundEvent("cosmetic_purchased");
    closeReveal();
  };

  // Global Sell All for the entire inventory (only available in Inventory tab)
  // Now uses a single backend call (action: "sell_all") instead of looping single sells.
  // This performs one coin update + clears the whole inventory atomically on the server.
  const sellAll = async () => {
    if (disabled || sellPending || inventory.length === 0 || inventoryValue <= 0) return;

    const confirmSell = window.confirm(
      `Sell ALL non-legendary items in your inventory for ${inventoryValue} coins?\n\nLegendary items will remain in your inventory and must be sold one by one with the extra confirmation.`
    );
    if (!confirmSell) return;

    setSellPending("all");

    try {
      const res = await (onSellAll ? onSellAll() : Promise.resolve({ success: false } as any));
      if (res.success) {
        // Play one purchase sound for the bulk operation
        emitSoundEvent("cosmetic_purchased");
      } else {
        alert(res?.error || "Sale failed. You may no longer own some of these items.");
      }
    } catch (e) {
      console.error("Sell all error", e);
      alert("Failed to sell all items.");
    } finally {
      setSellPending(null);
    }
  };

  const sellDuplicates = async () => {
    if (disabled || sellPending || duplicateStackCount === 0 || duplicateInventoryValue <= 0) return;

    const confirmSell = window.confirm(
      `Sell duplicate copies only for ${duplicateInventoryValue} coins?\n\nOne copy of each sellable item will remain in your inventory. Legendary items and Classic stay untouched.`
    );
    if (!confirmSell) return;

    setSellPending("duplicates");

    try {
      const res = await (onSellDuplicates ? onSellDuplicates() : Promise.resolve({ success: false } as any));
      if (res.success) {
        emitSoundEvent("cosmetic_purchased");
      } else {
        alert(res?.error || "Duplicate sale failed.");
      }
    } catch (e) {
      console.error("Sell duplicates error", e);
      alert("Failed to sell duplicate items.");
    } finally {
      setSellPending(null);
    }
  };

  const closeReveal = () => {
    setWonItems([]);
    setReelItems([]);
    setSpinSequence([]);
    setReelProgress(0);
    setLastOpenedCrateType(null);
    setLastOpenedBatchCost(0);
    setIsVerticalMode(false);
    setMultiSpinSequences([]);
    verticalReelRefs.current = [];
  };

  const getDropRates = (crateType: string) => {
    const drops = getAdjustedCrateDrops(crateType, activeEvents);
    if (!drops.length) return [];
    const total = drops.reduce((sum, d) => sum + (d.weight || 1), 0);
    const rarityIndex: Record<string, number> = RARITY_ORDER.reduce((acc, r, i) => {
      acc[r] = i;
      return acc;
    }, {} as Record<string, number>);

    return drops
      .map((d) => {
        const info = SAMPLE_CRATE_ITEMS[d.item_id];
        if (!info) return null;
        return {
          item_id: d.item_id,
          name: info.name,
          rarity: info.rarity,
          percentage: total > 0 ? ((d.weight || 1) / total) * 100 : 0,
          sell_value: info.sell_value ?? 0,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => {
        const ra = rarityIndex[a.rarity] ?? 99;
        const rb = rarityIndex[b.rarity] ?? 99;
        if (ra !== rb) return ra - rb; // common first, then uncommon, rare, epic, legendary
        return b.percentage - a.percentage; // within rarity, highest probability first
      });
  };

  return (
    <section className="court-feature-panel rounded-[2rem] border border-fuchsia-200/15 bg-black/50 p-5 shadow-[0_0_44px_rgba(217,70,239,0.12)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-fuchsia-200/70">Cosmetics • Collectibles</p>
          <h2 className="text-3xl font-black">Vault Mistress Cases</h2>
        </div>
        <p className="rounded-full border border-pink-200/20 bg-pink-500/10 px-3 py-1 text-xs font-bold text-pink-100">
          <CoinAmount amount={coins} iconSize={15} label="coins" />
        </p>
      </div>

      {/* When opening a crate we give the ENTIRE remaining area to the opening experience (no tabs, no grids, full focus).
          After the user claims/closes it returns to normal crate view. */}
      {! (isOpening || wonItems.length > 0) && (
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Open cases to uncover rare collectibles, exclusive cosmetics.
        </p>
      )}

      {/* Static cases area */}
      { ! (isOpening || wonItems.length > 0) && (
      <div className="court-feature-inset mt-6 rounded-3xl border border-white/10 bg-[#0a0a0c] p-5 min-h-[560px]">
          <div className="court-grid court-grid--collection grid min-h-[520px] content-center gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {crates.length === 0 && (
            <p className="col-span-full text-sm text-zinc-400">No cases available right now.</p>
          )}

          {crates.map((crate) => {
            const currentQty = getOpenQuantity(crate.crate_type);
            const batchCost = getBatchOpenCost(crate, currentQty);
            const displayCost = getDisplayedCost(crate);
            const freeOpenAvailable = hasFreeCrateOpen(activeEvents) && !hasFreeOpenToday(crate.crate_type);
            const grantedOpenCount = getGrantedOpenCount(crate.crate_type);
            const grantedOpenApplied = Math.min(currentQty, grantedOpenCount);
            const canAfford = coins >= batchCost;
            const isThisOpening = openingCrate === crate.crate_type;
            const isFlipped = flippedCrate === crate.crate_type;
            const dropRates = getDropRates(crate.crate_type);
            const protectionLabel =
              crate.crate_type === "principessa_case"
                ? `Bad Luck Protection: ${pityStats.principessa_bad_luck ?? 0}/4`
                : crate.crate_type === "blessing_case"
                  ? `Legendary Pity: ${pityStats.blessing_legendary_pity ?? 0}/250`
                  : "Protection: None";

            return (
              <div key={crate.crate_type} className="court-grid-card court-grid-card--violet w-full p-2">
                <div
                  className="relative h-[340px] sm:h-[364px] w-full [perspective:1200px]"
                  onClick={() => {
                    if (!isFlipped) {
                      setFlippedCrate(crate.crate_type);
                    }
                  }}
                >
                  <div
                    className="relative h-full w-full transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] [transform-style:preserve-3d]"
                    style={{ transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
                  >
                    <div className="absolute inset-0 flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-4 [backface-visibility:hidden]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFlippedCrate(crate.crate_type);
                        }}
                        className="absolute top-2 right-2 z-20 flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-black/40 text-[11px] leading-none text-white/70 hover:text-white"
                        title="View drop rates"
                        >
                          ?
                        </button>

                      <div className="flex min-w-0 items-start justify-between gap-3 pr-8">
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-black text-white">{crate.name}</p>
                        </div>
                        <div className="min-w-[92px] shrink-0 text-right">
                          <div className="flex items-center justify-end gap-1 text-xs text-pink-100/70">
                            <span>{currentQty > 1 ? "Total cost" : "Cost"}</span>
                            {currentQty > 1 && (
                              <span className="rounded-full border border-pink-200/20 bg-pink-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-pink-100/80">
                                x{currentQty}
                              </span>
                            )}
                          </div>
                          <div className="font-black text-pink-200">
                            {batchCost === 0 ? "FREE" : <CoinAmount amount={batchCost} iconSize={13} />}
                          </div>
                          {freeOpenAvailable && (
                            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                              Free open today
                            </div>
                          )}
                          {grantedOpenCount > 0 && (
                            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                              {grantedOpenCount} Premium Key{grantedOpenCount === 1 ? "" : "s"}
                            </div>
                          )}
                          {!freeOpenAvailable && grantedOpenCount === 0 && displayCost < crate.cost && (
                            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">
                              Lucky Key
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-1 flex-col justify-center py-3">
                        <div className="flex justify-center">
                          <img
                            src={(crate.icon_url ?? getCrateIconUrl(crate.crate_type)) ?? undefined}
                            alt={crate.name}
                            className="h-32 w-32 rounded-2xl border border-white/15 bg-black/40 object-contain p-2 shadow-[0_6px_20px_rgba(0,0,0,0.45)] sm:h-36 sm:w-36"
                            onError={(e) => {
                              const t = e.target as HTMLImageElement;
                              t.style.opacity = "0.25";
                            }}
                          />
                        </div>

                        <div className="mt-3 min-h-[18px] text-center text-[9px] whitespace-nowrap text-white/55">
                          {crate.crate_type === "principessa_case" ? (
                            <span className="text-amber-400/80">{protectionLabel}</span>
                          ) : crate.crate_type === "blessing_case" ? (
                            <span className="text-violet-400/80">{protectionLabel}</span>
                          ) : (
                            protectionLabel
                          )}
                        </div>

                        <div className="mt-3 flex justify-center gap-1 text-[10px]">
                          {[1, 2, 3, 4, 5].map((q) => (
                            <button
                              key={q}
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenQuantityForCase(crate.crate_type, q);
                              }}
                              className={`rounded border border-white/20 px-1.5 py-0.5 ${currentQty === q ? "bg-fuchsia-500 text-white" : "bg-white/5 hover:bg-white/10"}`}
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void openCrate(crate, currentQty);
                        }}
                        disabled={disabled || pending || isOpening || wonItems.length > 0 || !canAfford}
                        className="mt-auto w-full rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-500 py-2.5 text-sm font-bold text-white shadow-[0_0_18px_rgba(236,72,153,0.35)] transition active:scale-[0.985] disabled:opacity-50"
                      >
                        {isThisOpening
                          ? "OPENING..."
                          : canAfford
                            ? grantedOpenApplied > 0
                              ? `Open ${currentQty} (${grantedOpenApplied} key${grantedOpenApplied === 1 ? "" : "s"})`
                              : `Open ${currentQty}`
                            : "Not enough coins"}
                      </button>
                    </div>

                    <div className="absolute inset-0 flex h-full w-full flex-col overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-4 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFlippedCrate(null);
                        }}
                        className="absolute top-2 right-2 z-20 flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-black/40 text-[11px] leading-none text-white/70 hover:text-white"
                        title="Close"
                      >
                        x
                      </button>

                      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 p-3">
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/45 shadow-[0_0_22px_rgba(255,255,255,0.06)]">
                          <img
                            alt={crate.name}
                            className="h-full w-full object-contain p-2"
                            src={crate.icon_url ?? getCrateIconUrl(crate.crate_type) ?? undefined}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs uppercase tracking-[2px] text-fuchsia-200/70">Drop Rates</div>
                          <div className="mt-0.5 truncate text-sm font-semibold">{crate.name}</div>
                          <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-zinc-400">
                            {crate.description}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex-1 overflow-y-auto pr-1 space-y-1 rounded bg-black/30 p-1 text-[11px]">
                        {dropRates.length === 0 ? (
                          <div className="py-4 text-center text-xs text-zinc-400">No rates available</div>
                        ) : (
                          dropRates.map((rate: any) => {
                            const icon = getCrateItemImageUrl(rate.item_id, rate.image_url ?? null) ?? undefined;
                            return (
                              <div
                                key={rate.item_id}
                                className={`flex items-center gap-2 rounded px-2 py-1 ${getRarityColor(rate.rarity)} bg-opacity-40`}
                              >
                                <img
                                  src={icon}
                                  alt={rate.name}
                                  className="h-7 w-7 shrink-0 rounded-md border border-white/15 bg-black/30 object-contain p-0.5"
                                  onError={(e) => {
                                    const t = e.target as HTMLImageElement;
                                    t.style.opacity = "0.2";
                                  }}
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-medium text-white/90">{rate.name}</p>
                                  <p className="truncate text-[9px] uppercase tracking-[0.18em] text-white/55">
                                    {rate.rarity}
                                  </p>
                                </div>
                                <div className="ml-2 shrink-0 text-right">
                                  <div className="font-mono text-[10px] tabular-nums opacity-80">
                                    {rate.percentage.toFixed(2)}%
                                  </div>
                                  <div className="mt-0.5 text-[9px] font-medium text-emerald-300/80">
                                    {rate.sell_value ?? 0} coins
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      <div className="mt-2 text-center text-[9px] opacity-50">
                        {dropRates.length} items • Scroll for all
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </div>
      )}

      <div className="cases-stack relative z-[5] mt-6 flex flex-col">
      {/* INVENTORY under Cases static */}
      <div className="inventory-section relative z-[1] order-last">
          {/* Inventory header: value on left, global Sell All on top-right as requested */}
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm">
              <span className="text-zinc-400">Inventory Value</span>
              <span className="ml-2 font-bold text-pink-200">
                <CoinAmount amount={inventoryValue} />
              </span>
              <span className="ml-1 text-xs text-zinc-500">({totalItemCount} item{totalItemCount === 1 ? '' : 's'})</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={sellDuplicates}
                disabled={disabled || !!sellPending || duplicateStackCount === 0}
                className="rounded-xl border border-white/20 bg-white/5 px-3 py-1 text-xs font-semibold transition hover:bg-white/10 disabled:opacity-50"
                title={
                  duplicateStackCount > 0
                    ? `${duplicateStackCount} duplicate stack${duplicateStackCount === 1 ? "" : "s"} ready`
                    : "No sellable duplicates yet"
                }
              >
                Sell Duplicates
                <span className="ml-1 rounded-full border border-white/15 bg-black/25 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-pink-100/80">
                  {duplicateStackCount}
                </span>
              </button>
              {inventory.length > 0 && (
                <button
                  onClick={sellAll}
                  disabled={disabled || !!sellPending}
                  className="rounded-xl border border-white/20 bg-white/5 px-3 py-1 text-xs font-semibold hover:bg-white/10 disabled:opacity-50 transition"
                >
                  Sell All
                </button>
              )}
            </div>
          </div>

          {inventory.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-zinc-400">
              Your inventory is empty. Open some cases to start hoarding.
            </div>
          ) : (
            <div className="court-grid court-grid--collection grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {inventory.map((item) => {
                const key = item.item_id + item.variant;
                const isSelling = sellPending === key || sellPending === "all";
                const isClassicDefault = item.item_id === "classic";
                const isProtected = isClassicDefault;

                return (
                  <article
                    key={key}
                    className={`court-grid-card court-grid-card--violet rounded-[1.35rem] border p-4 ${getRarityColor(item.rarity)}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`relative mt-0.5 h-14 w-14 shrink-0 overflow-hidden rounded-2xl border-2 shadow-lg ${getRarityColor(item.rarity)}`}>
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="h-full w-full object-cover transition-transform hover:scale-110"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-black/70 text-3xl" aria-hidden>
                            {item.rarity === "legendary" ? "👑" : "📦"}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate font-black text-white">{item.name}</p>
                          <span className="rounded bg-black/40 px-1.5 py-px text-[10px] font-mono uppercase tracking-widest">
                            {item.rarity}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-pink-100/80">{item.description}</p>

                        <div className="mt-3 flex items-center justify-between text-xs">
                          <div>
                            Qty: <span className="font-mono text-white">{item.quantity}</span>
                          </div>
                          <div className="text-right">
                            Sell for <span className="font-bold text-emerald-300">{item.sell_value}</span> each
                          </div>
                        </div>

                        {item.quantity > 1 ? (
                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => sellItem(item, 1)}
                              disabled={disabled || isSelling || item.quantity < 1 || isProtected}
                              className="flex-1 rounded-2xl border border-white/20 bg-white/5 py-1.5 text-xs font-semibold hover:bg-white/10 disabled:opacity-50"
                            >
                              {isProtected
                                ? "Locked"
                                : isSelling
                                  ? "SELLING..."
                                  : `Sell 1 for ${item.sell_value} coins`}
                            </button>
                            <button
                              onClick={() => sellItem(item, item.quantity)}
                              disabled={disabled || isSelling || item.quantity < 1 || isProtected}
                              className="flex-1 rounded-2xl border border-white/20 bg-white/5 py-1.5 text-xs font-semibold hover:bg-white/10 disabled:opacity-50"
                            >
                              {isProtected
                                ? "Locked"
                                : isSelling
                                  ? "SELLING..."
                                  : `Sell All (${item.quantity}) for ${item.sell_value * item.quantity} coins`}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => sellItem(item, 1)}
                            disabled={disabled || isSelling || item.quantity < 1 || isProtected}
                            className="mt-3 w-full rounded-2xl border border-white/20 bg-white/5 py-1.5 text-xs font-semibold hover:bg-white/10 disabled:opacity-50"
                          >
                            {isProtected
                              ? "Locked"
                              : isSelling
                                ? "SELLING..."
                                : `Sell for ${item.sell_value} coins`}
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

      {/* Reel and cases area now same fixed size h-[440px] */}
      {(isOpening || wonItems.length > 0) && (
        <div
          ref={reelPanelRef}
          className="case-opening-panel relative z-[10] order-first mt-6 scroll-mt-24 rounded-3xl border border-white/10 bg-[#0a0a0c] p-5 min-h-[560px] md:order-none"
        >
          {wonItems.length > 0 && (
            <button
              onClick={closeReveal}
              className="absolute top-2 right-2 w-9 h-9 flex items-center justify-center rounded-full border border-white/30 bg-black/50 text-white text-xl hover:bg-white/20 hover:text-red-400 transition z-30"
              title="Back to Cases"
            >
              ✕
            </button>
          )}
          {!wonItems.length && (
            <div className="mb-3 text-center">
              {openingCrate && (
                <p className="text-xs uppercase tracking-[3px] text-fuchsia-300/70">Opening {openingCrate}</p>
              )}
              <h3 className="text-xl font-black text-white">Reel is spinning…</h3>
            </div>
          )}

          {/* DESKTOP SLIDING REEL - exactly 5 items visible (as requested).
              Square cards because item icons are square-designed. Larger squares for visibility, overall reel area kept the same.
              Shown both during spin and in result for single open (so result screen matches reel width). */}
          {!isVerticalMode && !isMobile && (isOpening || wonItems.length > 0) && spinSequence.length > 0 && (
            <div className="relative mx-auto w-full max-w-[680px] overflow-hidden rounded-2xl border-2 border-white/25 bg-black/90" style={{ height: 180 }}>
              {/* The moving strip - transform is driven directly via ref during animation (high FPS, list renders once) */}
              <div
                ref={stripRef}
                className="absolute top-8 flex h-[112px] gap-2 items-center will-change-transform"
                style={
                  isOpening 
                    ? { transform: `translateX(${CENTER_COMPENSATION}px)` } 
                    : { transform: `translateX(${ -(WINNER_SLOT * FULL_SLOT) + CENTER_COMPENSATION }px)` }
                }  // in result phase we explicitly set the exact final transform (same as animation's final settle) so the stopped reel stays perfectly centered under the marker, no shift to the side
              >
                {spinSequence.map((item, idx) => {
                  // Square card + actual item icon (png) inside.
                  // Rarity only via colored border + bg tint (getRarityColor). No letters.
                  const isWinnerSlot = wonItems.length > 0 && idx === WINNER_SLOT; // exact winner position in the tape (precise highlight on landed item, even with near-miss teases around it)
                  return (
                    <div
                      key={idx}
                      className={`w-[104px] h-[104px] shrink-0 rounded-xl border-2 p-2 flex items-center justify-center transition-all ${getRarityColor(item.rarity)} ${isWinnerSlot ? "ring-1 ring-yellow-400/70" : "opacity-95"}`}
                    >
                      <img
                        src={item.image_url || `/crate-items/${item.item_id}.png`}
                        alt={item.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          const t = e.target as HTMLImageElement;
                          t.style.display = "none";
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Fixed center selector / pointer (frames the middle square) */}
              <div className="pointer-events-none absolute left-1/2 top-8 h-[112px] w-[112px] -translate-x-1/2 rounded-2xl border-[3.5px] border-yellow-400/95" />
            </div>
          )}

          {/* VERTICAL SLIDE for multi-open (saves horizontal space, only 1 item visible at a time) */}
          {isVerticalMode && (isOpening || wonItems.length > 0) && multiSpinSequences.length > 0 && (
            <div className="flex gap-2 justify-center flex-wrap">
              {multiSpinSequences.map((seq, idx) => (
                <div key={idx} className="relative w-[120px] h-[120px] overflow-hidden rounded-2xl border-2 border-white/25 bg-black/90 flex-shrink-0">
                  <div
                    ref={el => { verticalReelRefs.current[idx] = el; }}
                    className="absolute left-1/2 -translate-x-1/2 top-[8px] flex flex-col will-change-transform gap-2"
                  >
                    {seq.map((item, sidx) => (
                      <div
                        key={sidx}
                        className={`w-[104px] h-[104px] shrink-0 rounded-xl border-2 p-2 flex items-center justify-center transition-all ${getRarityColor(item.rarity)}`}
                      >
                        <img
                          src={item.image_url || `/crate-items/${item.item_id}.png`}
                          alt={item.name}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            const t = e.target as HTMLImageElement;
                            t.style.display = "none";
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  {/* Fixed center slot exactly matching the item box */}
                  <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[104px] h-[104px] rounded-xl border-[3.5px] border-yellow-400/95" />
                </div>
              ))}
            </div>
          )}

          {/* MOBILE: single updating item (the previous popup content, now inline & contained) - skip for vertical */}
          {!isVerticalMode && isMobile && isOpening && (
            <div className="my-2 h-28 overflow-hidden rounded-2xl border border-white/10 bg-black/80 p-3">
              <div className="flex h-full flex-col items-center justify-center text-center">
                {reelItems.length > 0 && (
                  <div className={`inline-block rounded-2xl px-6 py-3 text-base font-bold transition-all ${getRarityColor(reelItems[reelItems.length - 1]?.rarity || "common")}`}>
                    {reelItems[reelItems.length - 1]?.name || "???"}
                    <div className="mt-0.5 text-[10px] opacity-70">{reelItems[reelItems.length - 1]?.rarity?.toUpperCase()}</div>
                  </div>
                )}
                {isOpening && reelItems.length === 0 && (
                  <div className="text-pink-100/60 text-sm">Spinning…</div>
                )}
              </div>
            </div>
          )}

          {/* Won items reveal - shown inline under the (stopped) reel, no popup. Supports multi open.
              For single: the reel above stays stopped (full width like during spin) + name label here.
              For multi: vertical reels stay + compact list below. */}
          {wonItems.length > 0 && (
            <div className="mt-4">
              {/* Single result: prominent name/desc matching the full reel width (not the narrow 120px cards) */}
              {wonItems.length === 1 ? (
                <div className="mx-auto mb-1 w-full max-w-[680px] text-center">
                  <CrateResultIconFrame item={wonItems[0]} />
                  <div className={`inline-flex items-center gap-2 rounded-xl border px-4 py-1 ${getRarityColor(wonItems[0].rarity)} bg-opacity-30`}>
                    <span className="font-black text-base text-white">{wonItems[0].name}</span>
                    <span className="text-[10px] uppercase tracking-widest opacity-70">{wonItems[0].rarity}</span>
                  </div>
                  {wonItems[0].description && <div className="mx-auto mt-1 max-w-md text-[11px] text-white/70">{wonItems[0].description}</div>}
                  {(() => {
                    const totalWon = wonItems[0].sell_value;
                    const netProfit = totalWon - lastOpenedBatchCost;
                    const netColor = netProfit >= 0 ? "text-emerald-300" : "text-red-400";
                    const netSign = netProfit >= 0 ? "+" : "";
                    return (
                      <div className="mt-2 flex items-center justify-center gap-2">
                        <div className="text-sm font-bold text-emerald-300">+{totalWon} coins</div>
                        <div className={`text-sm font-bold ${netColor}`}>
                          (Net: {netSign}{netProfit})
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="text-center mb-1 flex items-center justify-center gap-2">
                  <div className="text-sm font-semibold text-white/80">Results:</div>
                  {(() => {
                    const totalWon = wonItems.reduce((sum, item) => sum + item.sell_value, 0);
                    const netProfit = totalWon - lastOpenedBatchCost;
                    const netColor = netProfit >= 0 ? 'text-emerald-300' : 'text-red-400';
                    const netSign = netProfit >= 0 ? '+' : '';
                    return (
                      <>
                        <div className="text-sm font-bold text-emerald-300">+{totalWon} coins</div>
                        <div className={`text-sm font-bold ${netColor}`}>
                          (Net: {netSign}{netProfit})
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Compact result cards only for multi (side-by-side verticals need labels + per-item sells) */}
              {wonItems.length > 1 && (
                <div className="flex gap-3 justify-center flex-wrap">
                  {wonItems.map((item, idx) => (
                    <div key={idx} className="flex flex-col items-center text-xs border border-white/10 rounded p-2.5 bg-black/20 w-40">
                      {(() => {
                        const isLockedItem = item.item_id === "classic";
                        const isLegendary = item.rarity === "legendary";
                        const isSellBlocked = isLockedItem;

                        return (
                          <>
                      <div className={`inline-block overflow-hidden rounded-lg border-2 ${getRarityColor(item.rarity)}`}>
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="h-14 w-14 object-cover" />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center bg-black/70 text-3xl">
                            {item.rarity === "legendary" ? "👑" : "📦"}
                          </div>
                        )}
                      </div>
                      <div className="mt-1.5 font-bold text-white text-center truncate w-full text-sm leading-tight">{item.name}</div>
                      <button
                        onClick={async () => {
                          if (isLockedItem) {
                            return;
                          }
                          if (isLegendary) {
                            const confirmSell = window.confirm(
                              `Sell "${item.name}" for ${item.sell_value} coins?`
                            );
                            if (!confirmSell) return;
                          }
                          await onSellItem(item.item_id, item.variant, 1);
                          emitSoundEvent("cosmetic_purchased");
                          setWonItems(prev => prev.filter((_, i) => i !== idx));
                          if (wonItems.length <= 1) {
                            closeReveal();
                          }
                        }}
                        disabled={isSellBlocked}
                        className="mt-1.5 rounded bg-emerald-500/90 px-3 py-1 text-xs font-bold text-black leading-none"
                      >
                        {isSellBlocked ? "Locked" : `Sell for ${item.sell_value}`}
                      </button>
                          </>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              )}

              {/* Re-select quantity for next open from result screen - per last case.
                  Positioned between the sonuç ekranı (name label or Results+cards) and the action buttons (incl. Open Again). */}
              <div className="mt-2 mb-1 flex justify-center gap-1 text-[10px]">
                <span className="self-center mr-1 text-zinc-400">Next open:</span>
                {[1,2,3,4,5].map(q => {
                  const caseType = lastOpenedCrateType || '';
                  const current = getOpenQuantity(caseType);
                  return (
                    <button
                      key={q}
                      onClick={() => setOpenQuantityForCase(caseType, q)}
                      className={`px-1.5 py-0.5 rounded border border-white/20 ${current === q ? 'bg-fuchsia-500 text-white' : 'bg-white/5 hover:bg-white/10'}`}
                    >
                      {q}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex justify-center gap-3">
              {wonItems.length === 1 && wonItems[0] && (
                <button
                  onClick={async () => {
                    const item = wonItems[0];
                    if (item.item_id === "classic") {
                      return;
                    }
                    if (item.rarity === "legendary") {
                      const confirmSell = window.confirm(
                        `Sell "${item.name}" for ${item.sell_value} coins?`
                      );
                      if (!confirmSell) return;
                    }
                    await onSellItem(item.item_id, item.variant, 1);
                    emitSoundEvent("cosmetic_purchased");
                    closeReveal();
                  }}
                  disabled={wonItems[0].item_id === "classic"}
                  className="rounded-2xl bg-emerald-500/90 px-3 py-2 text-sm font-bold text-black"
                >
                  {wonItems[0].item_id === "classic" ? "Locked" : `Sell for ${wonItems[0].sell_value} coins`}
                </button>
              )}
                {wonItems.length > 1 && (
                  <button
                    onClick={sellAllWonItems}
                    className="rounded-2xl bg-emerald-500/90 px-3 py-2 text-sm font-bold text-black"
                  >
                    Sell All
                  </button>
                )}
                <button
                  onClick={() => {
                    const crateToReopen = crates.find((c) => c.crate_type === lastOpenedCrateType);
                    const caseType = lastOpenedCrateType || '';
                    const qty = getOpenQuantity(caseType);
                    if (crateToReopen) {
                      openCrate(crateToReopen, qty);
                    }
                  }}
                  disabled={
                    disabled ||
                    pending ||
                    !lastOpenedCrateType ||
                    !crates.find((c) => c.crate_type === lastOpenedCrateType) ||
                    coins < getBatchOpenCost(
                      crates.find((c) => c.crate_type === lastOpenedCrateType)!,
                      getOpenQuantity(lastOpenedCrateType || "")
                    )
                  }
                  className="rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-3 py-2 text-sm font-bold text-white shadow-[0_0_18px_rgba(236,72,153,0.35)] transition active:scale-[0.985] disabled:opacity-50"
                >
                  Open Again
                </button>
              </div>
            </div>
          )}

          {isOpening && wonItems.length === 0 && (
          <p className="mt-3 text-center text-xs text-pink-100/50">
              The result was decided server-side the moment your coins were accepted.
            </p>
          )}
        </div>
      )}
      </div>
    </section>
  );
}
