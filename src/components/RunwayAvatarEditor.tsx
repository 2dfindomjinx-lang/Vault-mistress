"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { LayeredAvatar } from "@/components/LayeredAvatar";
import type { CrateInventoryItem } from "@/components/CratesPanel";
import { RARITY_ORDER, type CrateRarity } from "@/lib/crates";
import {
  AVATAR_SLOT_ORDER,
  SLOT_LABELS,
  equipAvatarItem,
  getItemAvatarSlot,
  isAvatarEquippableItem,
  isFullSetItem,
  resolveAvatarItemIconPath,
  unequipAvatarSlot,
  type AvatarSlot,
  type EquippedAvatarSlots,
} from "@/lib/avatar-slots";

type RunwayAvatarEditorProps = {
  ownedItems: CrateInventoryItem[];
  liveEquippedSlots: EquippedAvatarSlots;
  liveEquippedFullSetId: string | null;
  canSubmit: boolean;
  submitting: boolean;
  nextEligibleAt: string | null;
  onSubmit: (draft: { equippedAvatarSlots: EquippedAvatarSlots; equippedFullSetId: string | null }) => void;
};

export function RunwayAvatarEditor({
  ownedItems,
  liveEquippedSlots,
  liveEquippedFullSetId,
  canSubmit,
  submitting,
  nextEligibleAt,
  onSubmit,
}: RunwayAvatarEditorProps) {
  const [draftSlots, setDraftSlots] = useState<EquippedAvatarSlots>({});
  const [draftFullSetId, setDraftFullSetId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<AvatarSlot | "fullSet" | null>(null);

  const equippableItems = useMemo(
    () => ownedItems.filter((item) => item.quantity > 0 && isAvatarEquippableItem(item.item_id)),
    [ownedItems],
  );

  const itemsBySlot = useMemo(() => {
    const groups: Partial<Record<AvatarSlot, CrateInventoryItem[]>> = {};
    for (const item of equippableItems) {
      const slot = getItemAvatarSlot(item.item_id);
      if (!slot) continue;
      (groups[slot] ??= []).push(item);
    }
    Object.keys(groups).forEach((slot) => {
      groups[slot as AvatarSlot]!.sort((a, b) => {
        const ia = RARITY_ORDER.indexOf((a.rarity || "").toLowerCase() as CrateRarity);
        const ib = RARITY_ORDER.indexOf((b.rarity || "").toLowerCase() as CrateRarity);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });
    });
    return groups;
  }, [equippableItems]);

  const fullSetItems = useMemo(
    () => ownedItems.filter((item) => item.quantity > 0 && isFullSetItem(item.item_id)),
    [ownedItems],
  );

  const equipSlotItem = (itemId: string) => {
    setDraftFullSetId(null);
    setDraftSlots((prev) => equipAvatarItem(prev, itemId));
  };

  const unequipSlot = (slot: AvatarSlot) => {
    setDraftSlots((prev) => unequipAvatarSlot(prev, slot));
  };

  const equipFullSet = (itemId: string) => {
    setDraftSlots({});
    setDraftFullSetId(itemId);
  };

  const clearDraft = () => {
    setDraftSlots({});
    setDraftFullSetId(null);
  };

  const copyCurrentLook = () => {
    setDraftSlots(liveEquippedSlots);
    setDraftFullSetId(liveEquippedFullSetId);
  };

  const hasAnyDraft = draftFullSetId !== null || Object.keys(draftSlots).length > 0;
  const cooldownActive = !canSubmit && Boolean(nextEligibleAt);

  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-black/30 p-4">
      <p className="text-sm font-black uppercase tracking-[0.2em] text-pink-100/80">Voting Avatar Editor</p>
      <p className="mt-1 text-xs text-zinc-400">
        Build a look for the pool from items you own. This never changes your live profile avatar.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[200px_1fr]">
        <div className="relative mx-auto h-[300px] w-[100px] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/40 lg:mx-0">
          <LayeredAvatar
            alt="Voting avatar draft preview"
            equipped={draftSlots}
            equippedFullSetId={draftFullSetId}
            hasUncensored={false}
          />
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyCurrentLook}
              className="rounded-xl border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
            >
              Copy my current look
            </button>
            <button
              type="button"
              onClick={clearDraft}
              disabled={!hasAnyDraft}
              className="rounded-xl border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold hover:bg-white/10 disabled:opacity-40"
            >
              Reset draft
            </button>
          </div>

          {fullSetItems.length > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-pink-100/70">Full Set</p>
                {draftFullSetId && (
                  <button
                    type="button"
                    onClick={() => setDraftFullSetId(null)}
                    className="text-[10px] uppercase tracking-[0.14em] text-pink-300 hover:underline"
                  >
                    Unequip
                  </button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {fullSetItems.map((item) => {
                  const isEquipped = draftFullSetId === item.item_id;
                  const icon = resolveAvatarItemIconPath(item.item_id);
                  return (
                    <button
                      key={item.item_id}
                      type="button"
                      onClick={() => equipFullSet(item.item_id)}
                      className={`relative aspect-square overflow-hidden rounded-xl border ${isEquipped ? "border-pink-300 ring-1 ring-pink-300/50" : "border-white/10 hover:border-white/30"}`}
                      title={item.name}
                    >
                      {icon ? (
                        <Image alt={item.name} className="object-contain p-1" fill src={icon} unoptimized />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setCategoryFilter(null)}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${categoryFilter === null ? "border-pink-300 bg-pink-500/10 text-pink-100" : "border-white/15 text-zinc-400"}`}
            >
              All
            </button>
            {AVATAR_SLOT_ORDER.filter((slot) => (itemsBySlot[slot]?.length ?? 0) > 0).map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setCategoryFilter(slot)}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${categoryFilter === slot ? "border-pink-300 bg-pink-500/10 text-pink-100" : "border-white/15 text-zinc-400"}`}
              >
                {SLOT_LABELS[slot]}
              </button>
            ))}
          </div>

          <div className="mt-3 max-h-[360px] space-y-4 overflow-y-auto pr-1">
            {AVATAR_SLOT_ORDER.filter((slot) => (categoryFilter === null || categoryFilter === slot) && (itemsBySlot[slot]?.length ?? 0) > 0).map((slot) => (
              <div key={slot}>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-pink-100/70">{SLOT_LABELS[slot]}</p>
                  {draftSlots[slot] && (
                    <button
                      type="button"
                      onClick={() => unequipSlot(slot)}
                      className="text-[10px] uppercase tracking-[0.14em] text-pink-300 hover:underline"
                    >
                      Unequip
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {itemsBySlot[slot]!.map((item) => {
                    const isEquipped = draftSlots[slot] === item.item_id;
                    const icon = resolveAvatarItemIconPath(item.item_id);
                    return (
                      <button
                        key={item.item_id}
                        type="button"
                        onClick={() => equipSlotItem(item.item_id)}
                        className={`relative aspect-square overflow-hidden rounded-xl border ${isEquipped ? "border-pink-300 ring-1 ring-pink-300/50" : "border-white/10 hover:border-white/30"}`}
                        title={item.name}
                      >
                        {icon ? (
                          <Image alt={item.name} className="object-contain p-1" fill src={icon} unoptimized />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {equippableItems.length === 0 && fullSetItems.length === 0 && (
              <p className="text-xs text-zinc-500">You don&apos;t own any equippable items yet.</p>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            {cooldownActive ? (
              <p className="text-xs text-amber-300">
                You can resubmit on {new Date(nextEligibleAt as string).toLocaleString()}.
              </p>
            ) : (
              <span />
            )}
            <button
              type="button"
              disabled={!canSubmit || submitting || !hasAnyDraft}
              onClick={() => onSubmit({ equippedAvatarSlots: draftSlots, equippedFullSetId: draftFullSetId })}
              className="rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-4 py-2 text-sm font-bold text-white shadow-[0_0_18px_rgba(236,72,153,0.35)] transition disabled:opacity-40"
            >
              {submitting ? "Submitting..." : "Submit to Voting Pool"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
