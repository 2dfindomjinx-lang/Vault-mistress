"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CrateRarity } from "@/lib/crates";
import { RARITY_COLORS, getRarityColor, CRATE_TYPES, SAMPLE_CRATE_ITEMS, RARITY_ORDER, getCrateIconUrl } from "@/lib/crates";
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
  onOpenCrate: (crateType: string) => Promise<{ success: boolean; result?: { item: WonItem; newCoins: number }; error?: string }>;
  onSellItem: (itemId: string, variant: string, quantity?: number) => Promise<{ success: boolean; newCoins?: number; error?: string }>;
  onSellAll?: () => Promise<{ success: boolean; newCoins?: number; totalValue?: number; itemCount?: number; error?: string }>;
  pityStats?: { principessa_bad_luck?: number; blessing_legendary_pity?: number };
  onCrateOpen?: () => void;
  onCrateResult?: (item: WonItem) => void;
  pending?: boolean;
};

export function CratesPanel({
  coins,
  disabled = false,
  crates,
  inventory,
  onOpenCrate,
  onSellItem,
  onSellAll,
  pityStats = { principessa_bad_luck: 0, blessing_legendary_pity: 0 },
  onCrateOpen,
  onCrateResult,
  pending = false,
}: CratesPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<"shop" | "inventory">("shop");
  const [isOpening, setIsOpening] = useState(false);
  const [openingCrate, setOpeningCrate] = useState<string | null>(null);
  const [reelItems, setReelItems] = useState<WonItem[]>([]);
  const [sellPending, setSellPending] = useState<string | null>(null);
  const [lastOpenedCrateType, setLastOpenedCrateType] = useState<string | null>(null);
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

  // Ref for direct style transform during spin (butter smooth, no React re-renders of the 50+ item list every tick)
  const stripRef = useRef<HTMLDivElement>(null);
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

  // Total sell value of current inventory (for display when viewing Inventory)
  const inventoryValue = useMemo(() => {
    return inventory.reduce((sum, item) => sum + (item.quantity || 0) * (item.sell_value || 0), 0);
  }, [inventory]);

  // Total number of items (sum of quantities) to display next to value
  const totalItemCount = useMemo(() => {
    return inventory.reduce((sum, item) => sum + (item.quantity || 0), 0);
  }, [inventory]);

  // Build a long ordered "tape" of items for the classic sliding reel.
  // Uses ONLY the actual items from this crate's drop pool (the 39 real ones).
  // Sampling is weighted by the original drop weights so the visual frequencies
  // roughly reflect the real drop ratios (commons appear a lot, legendaries rarely).
  // Progressive near-miss bias: early = mostly low tier, late = tension with
  // occasional higher tier teases.
  // For blessing_case: legendary near-misses are intentionally more frequent (high tension due to 0.6% base rate).
  // For regular cases: mostly epic/rare misses, minority legendary misses + the actual winner.
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

      // Progressive near-miss / drama layer:
      // Early: mostly pool ratios (common/uncommon heavy).
      // Late: tension via near-miss teases.
      // For blessing_case: legendary near-misses are more frequent (stronger tension, high-risk case).
      // For regular: majority epic/rare misses, minority legendary.
      // Very late still teases the actual winner sometimes.
      const boostMult = isBlessing ? 1.2 : 0.95;
      const boostChance = Math.max(0, (p - 0.4) * boostMult);

      if (Math.random() < boostChance) {
        // Decide tease tier for near-miss feel
        const r = Math.random();
        let targetTiers = [];
        if (isBlessing) {
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
      const winnerTeaseChance = isBlessing ? 0.32 : 0.18;
      if (p > 0.65 && p < 0.82 && Math.random() < winnerTeaseChance) {
        chosen = winner;
      }

      seq.push({ ...chosen });
    }
    return seq;
  }

  const openCrate = async (crate: CrateDefinition, qty: number = 1) => {
    if (disabled || pending || isOpening || coins < crate.cost * qty) return;

    if (onCrateOpen) onCrateOpen();

    // Build visual pool from the ACTUAL crate drops (principessa_case etc.)
    // This ensures the reel ONLY shows the configured 39 items (with their real names, rarities, images).
    // No more generic fakes or items outside the pool.
    const crateDef = CRATE_TYPES[crate.crate_type];
    let visualPool: WonItem[] = [];
    if (crateDef?.drops?.length) {
      visualPool = crateDef.drops
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

    // Perform multiple opens (server calls) for multi
    const results: WonItem[] = [];
    for (let i = 0; i < qty; i++) {
      const res = await onOpenCrate(crate.crate_type);
      if (!(res.success && res.result)) {
        const msg = res?.error || (res?.result ? "Something went wrong opening the case." : "Case open failed.");
        alert(msg);
        break;
      }
      results.push(res.result.item);
    }

    if (results.length === 0) return;

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
      if (onCrateResult) {
        results.forEach((item) => onCrateResult(item));
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
            if (realItem.rarity === "legendary") {
              emitSoundEvent("crate_legendary_reveal");
            } else {
              emitSoundEvent("crate_reveal");
            }
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

  // Global Sell All for the entire inventory (only available in Inventory tab)
  // Now uses a single backend call (action: "sell_all") instead of looping single sells.
  // This performs one coin update + clears the whole inventory atomically on the server.
  const sellAll = async () => {
    if (disabled || sellPending || inventory.length === 0 || inventoryValue <= 0) return;

    const confirmSell = window.confirm(
      `Sell ALL items in your inventory for ${inventoryValue} coins?\n\nThis will clear your entire collection.`
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

  const closeReveal = () => {
    setWonItems([]);
    setReelItems([]);
    setSpinSequence([]);
    setReelProgress(0);
    setLastOpenedCrateType(null);
    setIsVerticalMode(false);
    setMultiSpinSequences([]);
    verticalReelRefs.current = [];
  };

  const getDropRates = (crateType: string) => {
    const def = CRATE_TYPES[crateType];
    if (!def?.drops?.length) return [];
    const total = def.drops.reduce((sum, d) => sum + (d.weight || 1), 0);
    const rarityIndex: Record<string, number> = RARITY_ORDER.reduce((acc, r, i) => {
      acc[r] = i;
      return acc;
    }, {} as Record<string, number>);

    return def.drops
      .map((d) => {
        const info = SAMPLE_CRATE_ITEMS[d.item_id];
        if (!info) return null;
        return {
          item_id: d.item_id,
          name: info.name,
          rarity: info.rarity,
          percentage: total > 0 ? ((d.weight || 1) / total) * 100 : 0,
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
    <section className="rounded-[2rem] border border-fuchsia-200/15 bg-black/50 p-5 shadow-[0_0_44px_rgba(217,70,239,0.12)]">
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
      {!isOpening && wonItems.length === 0 && (
        <>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
                      Open cases to uncover rare collectibles, exclusive cosmetics.
          </p>

          {/* Sub-tabs */}
          <div className="mt-6 flex gap-2 border-b border-white/10 pb-2">
            {(["shop", "inventory"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveSubTab(tab)}
                className={`rounded-xl px-4 py-1.5 text-sm font-semibold transition ${
                  activeSubTab === tab
                    ? "bg-white/10 text-white"
                    : "text-pink-100/70 hover:text-pink-100"
                }`}
                disabled={isOpening || !!sellPending}
              >
                {tab === "shop" ? "Cases" : "Inventory"}
              </button>
            ))}
          </div>
        </>
      )}

      {/* CRATES / SHOP - hidden during opening for full focus on the reel */}
      {activeSubTab === "shop" && !isOpening && wonItems.length === 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {crates.length === 0 && (
            <p className="col-span-full text-sm text-zinc-400">No cases available right now.</p>
          )}

          {crates.map((crate) => {
            const currentQty = getOpenQuantity(crate.crate_type);
            const canAfford = coins >= crate.cost * currentQty;
            const isThisOpening = openingCrate === crate.crate_type;
            const isFlipped = flippedCrate === crate.crate_type;
            const dropRates = getDropRates(crate.crate_type);

            return (
              <div key={crate.crate_type} className="[perspective:1000px]">
                <div
                  className={`relative h-[260px] w-full rounded-[1.35rem] border border-white/10 bg-white/[0.035] transition-transform duration-500 [transform-style:preserve-3d]`}
                  style={{ transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)', willChange: 'transform' }}
                >
                  {/* FRONT - normal crate card */}
                  <div
                    className="absolute inset-0 p-4 flex flex-col backface-hidden"
                    style={{ backfaceVisibility: 'hidden', zIndex: isFlipped ? 0 : 2 }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFlippedCrate(crate.crate_type);
                      }}
                      className="absolute top-2 right-2 z-20 w-5 h-5 rounded-full bg-black/40 text-white/70 hover:text-white text-[11px] leading-none flex items-center justify-center border border-white/20"
                      title="View drop rates"
                    >
                      ?
                    </button>

                    <div className="flex items-start justify-between pr-8">
                      <div>
                        <p className="text-base font-black text-white">{crate.name}</p>
                        <p className="mt-1 text-xs text-zinc-400 line-clamp-2">{crate.description}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-pink-100/70">Cost</div>
                        <div className="font-black text-pink-200">
                          <CoinAmount amount={crate.cost} iconSize={13} />
                        </div>
                      </div>
                    </div>

                    {/* Principessa Case icon (or future crates).
                        Path convention: /crate-icons/principessa-case.png (auto from crate_type)
                        Drop your PNG in public/crate-icons/ — the file name will be crate_type with _ → - */}
                    <div className="mt-1 flex justify-center">
                      <img
                        src={(crate.icon_url ?? getCrateIconUrl(crate.crate_type)) ?? undefined}
                        alt={crate.name}
                        className="h-16 w-16 object-contain rounded-2xl border border-white/15 bg-black/40 p-1 shadow-[0_6px_20px_rgba(0,0,0,0.45)]"
                        onError={(e) => {
                          const t = e.target as HTMLImageElement;
                          t.style.opacity = "0.25";
                        }}
                      />
                    </div>

                    {/* Pity counters - only visible in shop grid. State update is delayed in parent until after reveal to prevent spoiling during reel spin. */}
                    {crate.crate_type === "principessa_case" && (
                      <div className="mt-0.5 text-[9px] text-center text-amber-400/80 whitespace-nowrap">
                        Bad Luck Protection: {pityStats.principessa_bad_luck ?? 0}/9
                      </div>
                    )}
                    {crate.crate_type === "blessing_case" && (
                      <div className="mt-0.5 text-[9px] text-center text-violet-400/80 whitespace-nowrap">
                        Legendary Pity: {pityStats.blessing_legendary_pity ?? 0}/150
                      </div>
                    )}

                    {/* Qty selector for multi open (up to 5) - per case */}
                    <div className="mt-2 flex justify-center gap-1 text-[10px]">
                      {[1,2,3,4,5].map(q => (
                        <button
                          key={q}
                          onClick={(e) => { e.stopPropagation(); setOpenQuantityForCase(crate.crate_type, q); }}
                          className={`px-1.5 py-0.5 rounded border border-white/20 ${currentQty === q ? 'bg-fuchsia-500 text-white' : 'bg-white/5 hover:bg-white/10'}`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>

                    <div className="flex-1" />

                    <button
                      onClick={() => openCrate(crate, currentQty)}
                      disabled={disabled || pending || isOpening || wonItems.length > 0 || coins < crate.cost * currentQty}
                      className="mt-4 w-full rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-500 py-2 text-sm font-bold text-white shadow-[0_0_18px_rgba(236,72,153,0.35)] transition active:scale-[0.985] disabled:opacity-50"
                    >
                      {isThisOpening ? "OPENING..." : coins >= crate.cost * currentQty ? `Open ${currentQty}` : "Not enough coins"}
                    </button>
                  </div>

                  {/* BACK - drop rates with internal scroll (area fixed) */}
                  <div
                    className="absolute inset-0 p-4 flex flex-col backface-hidden"
                    style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', zIndex: isFlipped ? 2 : 0 }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFlippedCrate(null);
                      }}
                      className="absolute top-2 right-2 z-20 w-5 h-5 rounded-full bg-black/40 text-white/70 hover:text-white text-[11px] leading-none flex items-center justify-center border border-white/20"
                      title="Close"
                    >
                      ✕
                    </button>

                    <div className="text-center">
                      <div className="text-xs uppercase tracking-[2px] text-fuchsia-200/70">Drop Rates</div>
                      <div className="text-sm font-semibold mt-0.5 truncate">{crate.name}</div>
                    </div>

                    <div className="mt-2 flex-1 overflow-y-auto pr-1 text-[11px] space-y-1 bg-black/30 rounded p-1">
                      {dropRates.length === 0 ? (
                        <div className="text-center text-zinc-400 py-4 text-xs">No rates available</div>
                      ) : (
                        dropRates.map((rate: any) => (
                          <div
                            key={rate.item_id}
                            className={`flex items-center justify-between rounded px-2 py-1 ${getRarityColor(rate.rarity)} bg-opacity-40`}
                          >
                            <span className="truncate font-medium text-white/90">{rate.name}</span>
                            <span className="font-mono text-[10px] opacity-80 tabular-nums ml-2">
                              {rate.percentage.toFixed(2)}%
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="text-[9px] text-center mt-1 opacity-50">
                      {dropRates.length} items • Scroll for all
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* INVENTORY - hidden during opening for full focus on the reel */}
      {activeSubTab === "inventory" && !isOpening && wonItems.length === 0 && (
        <div className="mt-6">
          {/* Inventory header: value on left, global Sell All on top-right as requested */}
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm">
              <span className="text-zinc-400">Inventory Value</span>
              <span className="ml-2 font-bold text-pink-200">
                <CoinAmount amount={inventoryValue} />
              </span>
              <span className="ml-1 text-xs text-zinc-500">({totalItemCount} item{totalItemCount === 1 ? '' : 's'})</span>
            </div>
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

          {inventory.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-zinc-400">
              Your inventory is empty. Open some cases to start hoarding.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {inventory.map((item) => {
                const key = item.item_id + item.variant;
                const isSelling = sellPending === key || sellPending === "all";

                return (
                  <article
                    key={key}
                    className={`rounded-[1.35rem] border p-4 ${getRarityColor(item.rarity)}`}
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
                              disabled={disabled || isSelling || item.quantity < 1}
                              className="flex-1 rounded-2xl border border-white/20 bg-white/5 py-1.5 text-xs font-semibold hover:bg-white/10 disabled:opacity-50"
                            >
                              {isSelling ? "SELLING..." : `Sell 1 for ${item.sell_value} coins`}
                            </button>
                            <button
                              onClick={() => sellItem(item, item.quantity)}
                              disabled={disabled || isSelling || item.quantity < 1}
                              className="flex-1 rounded-2xl border border-white/20 bg-white/5 py-1.5 text-xs font-semibold hover:bg-white/10 disabled:opacity-50"
                            >
                              {isSelling ? "SELLING..." : `Sell All (${item.quantity}) for ${item.sell_value * item.quantity} coins`}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => sellItem(item, 1)}
                            disabled={disabled || isSelling || item.quantity < 1}
                            className="mt-3 w-full rounded-2xl border border-white/20 bg-white/5 py-1.5 text-xs font-semibold hover:bg-white/10 disabled:opacity-50"
                          >
                            {isSelling ? "SELLING..." : `Sell for ${item.sell_value} coins`}
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
      )}

      {/* INLINE CRATE OPENING REEL (no more popup/overlay for desktop) */}
      {/* Desktop: classic multi-item horizontal slide showing 5 items at once + center marker */}
      {/* Mobile: single updating card (current style kept as requested) */}
      {(isOpening || wonItems.length > 0) && (
        <div className="mt-6 rounded-3xl border border-white/10 bg-[#0a0a0c] p-5 relative">
          {wonItems.length > 0 && (
            <button
              onClick={closeReveal}
              className="absolute top-2 right-2 w-9 h-9 flex items-center justify-center rounded-full border border-white/30 bg-black/50 text-white text-xl hover:bg-white/20 hover:text-red-400 transition z-30"
              title="Back to Cases"
            >
              ✕
            </button>
          )}
          <div className="mb-3 text-center">
            {!wonItems.length && openingCrate && (
              <p className="text-xs uppercase tracking-[3px] text-fuchsia-300/70">Opening {openingCrate}</p>
            )}
            {!wonItems.length && <h3 className="text-xl font-black text-white">Reel is spinning…</h3>}
          </div>

          {/* DESKTOP SLIDING REEL - exactly 5 items visible (as requested).
              Square cards because item icons are square-designed. Larger squares for visibility, overall reel area kept the same. */}
          {!isVerticalMode && !isMobile && isOpening && spinSequence.length > 0 && (
            <div className="relative mx-auto w-full max-w-[680px] overflow-hidden rounded-2xl border-2 border-white/25 bg-black/90" style={{ height: 160 }}>
              {/* The moving strip - transform is driven directly via ref during animation (high FPS, list renders once) */}
              <div
                ref={stripRef}
                className="absolute top-2 flex h-[108px] gap-2 will-change-transform"
                style={{ transform: `translateX(${CENTER_COMPENSATION}px)` }}
              >
                {spinSequence.map((item, idx) => {
                  // Square card + actual item icon (png) inside.
                  // Rarity only via colored border + bg tint (getRarityColor). No letters.
                  const isWinnerSlot = wonItems.length > 0 && wonItems.some(w => w.item_id === item.item_id);
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
              <div className="pointer-events-none absolute left-1/2 top-1.5 h-[112px] w-[112px] -translate-x-1/2 rounded-2xl border-[3.5px] border-yellow-400/95" />
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

          {/* Won items reveal - shown inline under the (stopped) reel, no popup. Supports multi open. */}
          {wonItems.length > 0 && (
            <div className="mt-4">
              <div className="text-center mb-1">
                <div className="text-sm font-semibold text-white/80">Results:</div>
              </div>

              {/* Re-select quantity for next open from result screen - per last case */}
              <div className="mb-2 flex justify-center gap-1 text-[10px]">
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

              <div className="flex gap-2 justify-center flex-wrap">
                {wonItems.map((item, idx) => (
                  <div key={idx} className="flex flex-col items-center text-[9px] border border-white/10 rounded p-1 bg-black/20 w-[120px]">
                    <div className={`inline-block overflow-hidden rounded-lg border-2 ${getRarityColor(item.rarity)}`}>
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="h-10 w-10 object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center bg-black/70 text-xl">
                          {item.rarity === "legendary" ? "👑" : "📦"}
                        </div>
                      )}
                    </div>
                    <div className="mt-0.5 font-bold text-white text-center truncate w-full text-[8px] leading-tight">{item.name}</div>
                    <button
                      onClick={async () => {
                        if (item.rarity === "legendary") {
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
                      className="mt-0.5 rounded bg-emerald-500/90 px-1 py-0 text-[7px] font-bold text-black leading-none"
                    >
                      Sell {item.sell_value}
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex justify-center gap-3">
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
                    coins < (crates.find((c) => c.crate_type === lastOpenedCrateType)?.cost || 0) * getOpenQuantity(lastOpenedCrateType || '')
                  }
                  className="rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-3 py-2 text-sm font-bold text-white shadow-[0_0_18px_rgba(236,72,153,0.35)] transition active:scale-[0.985] disabled:opacity-50"
                >
                  Open Again ({getOpenQuantity(lastOpenedCrateType || '')})
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
    </section>
  );
}
