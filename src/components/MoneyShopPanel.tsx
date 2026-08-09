"use client";

import Image from "next/image";
import { useState } from "react";
import { MoneyIcon } from "@/components/MoneyIcon";
import {
  getMoneyConversionBreakdown,
  MONEY_CONVERSION_TIERS,
  MONEY_SHOP_BUYBACK_PERCENT,
  PM_TO_COIN_RATE,
  type MoneyShopEntry,
} from "@/lib/principessa-money";

type MoneyShopPanelProps = {
  coins: number;
  disabled?: boolean;
  error?: string;
  isLoading?: boolean;
  items: MoneyShopEntry[];
  money: number;
  pendingItemId?: string | null;
  isConverting?: boolean;
  onAddMoney?: () => void;
  onBuy: (itemId: string) => void;
  onConvert: (amount: number) => void;
  onSell: (itemId: string) => void;
};

export function MoneyShopPanel({
  coins,
  disabled = false,
  error = "",
  isConverting = false,
  isLoading = false,
  items,
  money,
  onAddMoney,
  onBuy,
  onConvert,
  onSell,
  pendingItemId = null,
}: MoneyShopPanelProps) {
  const [convertInput, setConvertInput] = useState("");
  const convertAmount = Math.max(0, Math.floor(Number(convertInput) || 0));
  const preview = getMoneyConversionBreakdown(convertAmount);
  const canConvert = convertAmount > 0 && convertAmount <= money && !disabled && !isConverting;

  return (
    <section className="court-feature-panel rounded-[2rem] border border-[#c89a55]/25 bg-black/50 p-5 shadow-[0_0_44px_rgba(230,186,115,0.12)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-4">
          <MoneyIcon className="hidden shrink-0 rounded-md sm:inline-block" height={52} />
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#d7ad69]/70">Paid in full</p>
            <h2 className="text-3xl font-black">Money Shop</h2>
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
        <div className="rounded-[1.35rem] border border-[#c89a55]/20 bg-black/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#d7ad69]/70">Convert to Coins</p>
            <button
              className="rounded-full border border-[#c89a55]/30 bg-[#e6ba73]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#fff0d2] transition hover:border-[#c89a55]/60"
              onClick={onAddMoney}
              type="button"
            >
              + Add Money
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              className="w-32 rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-sm text-white outline-none focus:border-[#c89a55]/50"
              disabled={disabled || isConverting}
              inputMode="numeric"
              min={1}
              onChange={(event) => setConvertInput(event.target.value.replace(/[^0-9]/g, ""))}
              placeholder="0"
              type="number"
              value={convertInput}
            />
            <p className="text-xs text-zinc-500">Money to spend</p>
            <button
              className="rounded-full border border-[#c89a55]/30 bg-[#e6ba73]/15 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#fff0d2] transition enabled:hover:border-[#c89a55]/60 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!canConvert}
              onClick={() => {
                onConvert(convertAmount);
                setConvertInput("");
              }}
              type="button"
            >
              {isConverting ? "Converting..." : "Convert"}
            </button>
            <button
              className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500 transition hover:text-zinc-200"
              onClick={() => setConvertInput(String(money))}
              type="button"
            >
              Max
            </button>
          </div>

          {convertAmount > 0 ? (
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm">
              <p className="text-zinc-300">
                {convertAmount.toLocaleString()} Money &rarr;{" "}
                <span className="font-black text-[#fff0d2]">{preview.totalCoins.toLocaleString()} coins</span>
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {preview.baseCoins.toLocaleString()} base
                {preview.bonusCoins > 0
                  ? ` + ${preview.bonusCoins.toLocaleString()} bonus (${Math.round(preview.bonusPercent * 100)}%)`
                  : " - convert 10 or more at once to earn a bonus"}
              </p>
              {convertAmount > money ? (
                <p className="mt-1 text-xs text-rose-200/80">You only have {money.toLocaleString()} Money.</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="rounded-[1.35rem] border border-white/10 bg-black/30 p-4">
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
                  className="court-grid-card court-grid-card--gold flex min-w-0 flex-col overflow-hidden rounded-[1.25rem] border border-[#c89a55]/20 bg-[linear-gradient(155deg,rgba(120,53,15,0.22),rgba(0,0,0,0.55))]"
                  key={item.itemId}
                >
                  <div className="relative h-36 w-full overflow-hidden bg-black/45">
                    {item.imageUrl ? (
                      <Image alt={item.name} className="object-contain p-2" fill sizes="220px" src={item.imageUrl} />
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

                  <div className="flex flex-1 flex-col p-3">
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
