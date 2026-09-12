"use client";

import styles from "./CollectionSurfaces.module.css";

import Image from "next/image";
import { useState } from "react";
import { AppLicenseShelf } from "@/components/AppLicenseShelf";
import { MoneyIcon } from "@/components/MoneyIcon";
import { TributeFurnace } from "@/components/TributeFurnace";
import type { Profile } from "@/lib/supabase/client";
import {
  getMoneyConversionBreakdown,
  MONEY_CONVERSION_TIERS,
  MONEY_SHOP_BUYBACK_PERCENT,
  PM_TO_COIN_RATE,
  type MoneyShopEntry,
} from "@/lib/principessa-money";

type MoneyShopPanelProps = {
  previewMode?: boolean;
  coins: number;
  disabled?: boolean;
  error?: string;
  isLoading?: boolean;
  items: MoneyShopEntry[];
  money: number;
  pendingItemId?: string | null;
  isConverting?: boolean;
  burnedTotal?: number;
  isBurning?: boolean;
  burnError?: string;
  onAddMoney?: () => void;
  onBurn?: (amount: number) => Promise<boolean>;
  /** Called with the fresh profile after a program licence is bought. */
  onLicensePurchased?: (profile: Profile) => void;
  onBuy: (itemId: string) => void;
  onConvert: (amount: number) => void;
  onSell: (itemId: string) => void;
};

export function MoneyShopPanel({
  previewMode = false,
  burnError = "",
  burnedTotal = 0,
  coins,
  disabled = false,
  error = "",
  isBurning = false,
  isConverting = false,
  isLoading = false,
  items,
  money,
  onAddMoney,
  onBurn,
  onBuy,
  onConvert,
  onLicensePurchased,
  onSell,
  pendingItemId = null,
}: MoneyShopPanelProps) {
  const [convertInput, setConvertInput] = useState("");
  const convertAmount = Math.max(0, Math.floor(Number(convertInput) || 0));
  const preview = getMoneyConversionBreakdown(convertAmount);
  const canConvert = convertAmount > 0 && convertAmount <= money && !disabled && !isConverting;

  return (
    <section className={`${styles.surface} ${styles.treasury}`} data-collection-surface="treasury">
      <div className={styles.header}>
        <div className="flex items-center gap-4">
          <MoneyIcon className="hidden shrink-0 rounded-md sm:inline-block" height={52} />
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#d7ad69]/70">The private boutique</p>
            <h2 className="text-3xl font-black">A taste for the exceptional.</h2>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="flex items-center gap-2 rounded-full border border-[#c89a55]/30 bg-[#e6ba73]/10 px-4 py-2 text-sm font-semibold text-[#fff0d2]">
            <MoneyIcon height={16} /> {money.toLocaleString()} Money
          </p>
          <p className="rounded-full border border-pink-200/20 bg-pink-500/10 px-4 py-2 text-sm font-semibold text-pink-50">
            ◉ {coins.toLocaleString()} Coins
          </p>
        </div>
      </div>

      <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
        Principessa Money is earned by tributing on Throne and nothing else. It converts down into
        coins whenever you want &mdash; coins never convert back up.
      </p>

      {/* Conversion desk */}
      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.6fr)]">
        <form className={styles.exchange} onSubmit={event=>{event.preventDefault();if(!canConvert)return;onConvert(convertAmount);setConvertInput("");}}>
          <header className={styles.exchangeHeading}><div><p>The exchange desk</p><h3>Convert to Coins</h3></div><button onClick={onAddMoney} type="button">+ Add Money</button></header>
          <div className={styles.exchangeFlow}>
            <div className={styles.exchangeFrom}><label htmlFor="convert-money">You give <span>PM</span></label><div><MoneyIcon height={22}/><input id="convert-money" aria-label="Money to convert" disabled={disabled||isConverting} inputMode="numeric" min={1} onChange={event=>setConvertInput(event.target.value.replace(/[^0-9]/g,""))} placeholder="0" type="number" value={convertInput}/><button type="button" disabled={isConverting} onClick={()=>setConvertInput(String(money))}>Max</button></div><small>{money.toLocaleString()} PM available</small></div>
            <span className={styles.exchangeArrow} aria-hidden="true">→</span>
            <div className={styles.exchangeTo}><p>You receive <span>Coins</span></p><strong>{preview.totalCoins.toLocaleString()}</strong><small>{preview.bonusCoins>0 ? "+"+preview.bonusCoins.toLocaleString()+" bonus included" : "1 PM = "+PM_TO_COIN_RATE.toLocaleString()+" Coins"}</small></div>
          </div>
          <footer className={styles.exchangeFooter}><p>{convertAmount>money ? "You have "+money.toLocaleString()+" PM available." : preview.bonusCoins>0 ? preview.baseCoins.toLocaleString()+" base + "+Math.round(preview.bonusPercent*100)+"% bonus" : "Convert 10+ PM at once for a bonus."}</p><button type="submit" disabled={!canConvert}>{isConverting?"Converting…":"Convert"}<span aria-hidden="true">↗</span></button></footer>
        </form>

        <div className={styles.rates}>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#d7ad69]/70">Rates</p>
          <p className="mt-3 text-sm text-zinc-300">
            1 Money = <span className="font-black text-[#fff0d2]">{PM_TO_COIN_RATE.toLocaleString()} coins</span>
          </p>
          <div className="mt-3 grid gap-1.5">
            {MONEY_CONVERSION_TIERS.map((tier) => (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-black/25 px-2.5 py-1.5" key={tier.pmAmount}>
                <p className="text-xs text-zinc-400">{tier.pmAmount}+ at once</p>
                <p className="text-xs font-black text-[#fff0d2]">+{Math.round(tier.bonusPercent * 100)}%</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-5 text-zinc-500">
            Coins cannot be turned back into Money.
          </p>
        </div>
      </div>

      {/* Sits with the converter on purpose: this is the screen where someone
          decides what their Money is for, and burning it is the other answer. */}
      {onBurn ? (
        <div className="mt-6">
          <TributeFurnace
            burnedTotal={burnedTotal}
            disabled={disabled}
            error={burnError}
            isBurning={isBurning}
            money={money}
            onBurn={onBurn}
          />
        </div>
      ) : null}

      {/* Her programs. Above the legendary catalogue because these are the
          only things on this screen that leave the site with you. */}
      {onLicensePurchased ? (
        <AppLicenseShelf previewMode={previewMode} disabled={disabled} money={money} onPurchased={onLicensePurchased} />
      ) : null}

      {/* Legendary catalogue */}
      <div className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#d7ad69]/70">Guaranteed</p>
            <h3 className="mt-1 text-2xl font-black text-white">Legendary Vault</h3>
          </div>
          <p className="text-[11px] text-zinc-500">
            Returns pay back {Math.round(MONEY_SHOP_BUYBACK_PERCENT * 100)}% in Money, never coins.
          </p>
        </div>

        {error ? (
          <p className="mt-3 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-50/90">{error}</p>
        ) : null}

        {isLoading ? (
          <p className="mt-4 rounded-2xl border border-white/10 px-3 py-6 text-center text-sm text-zinc-500">Loading the vault...</p>
        ) : items.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-white/10 px-3 py-6 text-center text-sm text-zinc-500">Nothing is listed right now.</p>
        ) : (
          <div className="court-grid court-grid--shop mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const isPending = pendingItemId === item.itemId;
              const canAfford = money >= item.pricePm;
              const ownsInInventory = item.ownedInInventory > 0;

              return (
                <article
                  className={`${styles.product} ${styles.moneyCard} flex min-w-0 flex-col`}
                  key={item.itemId}
                >
                  <div className={`${styles.moneyArt} relative w-full overflow-hidden`}>
                    {item.imageUrl ? (
                      <Image alt={item.name} className="object-contain p-2" fill sizes="(min-width: 1280px) 28vw, (min-width: 640px) 44vw, 90vw" src={item.imageUrl} />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-zinc-600">No image</div>
                    )}
                    <span className="absolute left-2 top-2 rounded-full border border-amber-300/40 bg-black/60 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-amber-200">
                      {item.rarity}
                    </span>
                    {item.ownedFromShop > 0 ? (
                      <span className="absolute right-2 top-2 rounded-full border border-emerald-300/40 bg-black/60 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-200">
                        Owned {item.ownedFromShop}
                      </span>
                    ) : null}
                  </div>

                  <div className={`${styles.productCopy} flex flex-1 flex-col`}>
                    <p className="truncate text-sm font-black text-white">{item.name}</p>
                    {ownsInInventory ? (
                      <p className="mt-1 text-[11px] font-semibold leading-4 text-emerald-200/80">
                        You already own this item in your inventory.
                      </p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Sells for {item.sellValueCoins.toLocaleString()} coins from a case
                    </p>

                    <div className="mt-auto pt-3">
                      <p className="flex items-center gap-1.5 text-2xl font-black leading-none text-[#fff0d2]"><MoneyIcon height={20} />{item.pricePm.toLocaleString()}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                        Returns <MoneyIcon height={11} /> {item.buybackPm.toLocaleString()}
                      </p>
                      <div className="mt-3 grid gap-1.5">
                        <button
                          className="rounded-xl border border-[#c89a55]/30 bg-[#e6ba73]/15 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#fff0d2] transition enabled:hover:border-[#c89a55]/60 disabled:cursor-not-allowed disabled:opacity-40"
                          disabled={disabled || isPending || !canAfford}
                          onClick={() => onBuy(item.itemId)}
                          type="button"
                        >
                          {isPending ? "Working..." : canAfford ? "Buy" : "Not enough Money"}
                        </button>
                        {item.ownedFromShop > 0 ? (
                          <button
                            className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-300 transition enabled:hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={disabled || isPending}
                            onClick={() => onSell(item.itemId)}
                            type="button"
                          >
                            Return for <MoneyIcon height={12} /> {item.buybackPm.toLocaleString()}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
