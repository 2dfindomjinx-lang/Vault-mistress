"use client";

import Image from "next/image";
import { useState } from "react";
import { CourtDialog } from "./CourtDialog";
import { LayeredAvatar } from "./LayeredAvatar";
import { MoneyIcon } from "./MoneyIcon";
import { equipAvatarItem, getItemAvatarSlot, isFullSetItem, type EquippedAvatarSlots } from "@/lib/avatar-slots";
import type { MoneyShopEntry } from "@/lib/principessa-money";
import ui from "./PremiumExperience.module.css";

export function CollectionVitrine({ item, initialOwned, equipped, fullSet, hasUncensored, disabled, pending, money, error, onBuy, onClose, onWardrobe }: {
  item: MoneyShopEntry; initialOwned: number; equipped: EquippedAvatarSlots; fullSet?: string | null; hasUncensored?: boolean;
  disabled: boolean; pending: boolean; money: number; error: string; onBuy: () => void; onClose: () => void; onWardrobe?: () => void;
}) {
  const slot = getItemAvatarSlot(item.itemId);
  const wearable = Boolean(slot) || isFullSetItem(item.itemId);
  const [tryOn, setTryOn] = useState(wearable);
  const acquired = item.ownedFromShop > initialOwned;
  const previewEquipment = equipAvatarItem(equipped, item.itemId);
  const previewFullSet = isFullSetItem(item.itemId) ? item.itemId : slot && slot !== "toy" ? null : fullSet;
  return <CourtDialog label={item.name + " preview"} className={ui.dialog} onClose={onClose} canClose={!pending}>
    <header className={ui.dialogHeader}><div><small>Principessa’s private collection</small><h3>{item.name}</h3></div><button type="button" onClick={onClose} disabled={pending} aria-label="Close preview">×</button></header>
    <div className={ui.vitrineLayout}>
      <div className={ui.vitrine} data-acquired={acquired} data-rarity={item.rarity}>
        <span className={ui.vitrineCrest} aria-hidden="true">♛</span>
        <div className={ui.vitrineObject} key={tryOn ? "avatar" : "item"}>
          {tryOn && wearable ? <LayeredAvatar alt={item.name + " on your avatar"} equipped={previewEquipment} equippedFullSetId={previewFullSet} hasUncensored={hasUncensored} showToyEffect={slot === "toy"}/> : item.imageUrl ? <Image src={item.imageUrl} alt={item.name} fill sizes="(max-width:700px) 75vw,360px" className="object-contain p-8"/> : <span className={ui.emptyObject}>♛</span>}
        </div>
        <div className={ui.plinth}/><span className={ui.vitrineCaption}>{acquired ? "Added to your collection" : tryOn ? "Your avatar · fitting preview" : item.rarity}</span>
      </div>
      <div className={ui.vitrineDetails}>
        {wearable && <div className={ui.switcher} aria-label="Preview mode"><button type="button" aria-pressed={tryOn} onClick={() => setTryOn(true)}>Try it on</button><button type="button" aria-pressed={!tryOn} onClick={() => setTryOn(false)}>The item</button></div>}
        <p className={ui.eyebrow}>{acquired ? "The collection is yours" : "Guaranteed acquisition"}</p><h4>{acquired ? "A new possession." : "A closer look."}</h4>
        <p>{slot === "toy" ? "Try the item’s court effect with your current look." : wearable ? "See how it fits your current look before adding it to your wardrobe." : "From her private vault to your collection."}</p>
        <div className={ui.price}><MoneyIcon height={24}/>{item.pricePm.toLocaleString()} <small>PM</small></div>
        <p className={ui.muted}>Returns: {item.buybackPm.toLocaleString()} PM · In your inventory: {item.ownedInInventory}</p>
        {error && <p role="alert" className={ui.error}>{error}</p>}
        {acquired ? <div role="status" className={ui.receipt}><span>♛</span><strong>Received</strong><p>{item.name}</p></div> : <button type="button" className={ui.primary} disabled={disabled || pending || money < item.pricePm} onClick={onBuy}>{pending ? "Opening the vault…" : money < item.pricePm ? "Not enough Money" : `Acquire · ${item.pricePm.toLocaleString()} PM`}</button>}
        {(item.ownedInInventory > 0 || acquired) && wearable && onWardrobe && <button type="button" className={ui.secondary} onClick={onWardrobe}>Open wardrobe →</button>}
      </div>
    </div>
  </CourtDialog>;
}
