import Image from "next/image";
import {
  SHRINE_IMAGE_UNLOCK_COST,
  SHRINE_LEVEL_COIN_INTERVAL,
  SHRINE_PURCHASE_OPTIONS,
  type ShrineStatus,
} from "@/lib/shrine";

type TributePanelProps = {
  affection: number;
  coins: number;
  disabled?: boolean;
  hideAffectionOffer?: boolean;
  pending?: boolean;
  shrine?: ShrineStatus | null;
  shrinePending?: boolean;
  onShrinePurchase?: (amount: number) => void;
  onTribute: (amount: number) => void;
};

const tributeOptions = [
  { amount: 250, label: "Velvet Coin Drop", boost: "+1 affection" },
  { amount: 1000, label: "Gilded Offering", boost: "+5 affection" },
  { amount: 5000, label: "Vault Tribute", boost: "+30 affection" },
];

export function TributePanel({
  affection,
  coins,
  disabled = false,
  hideAffectionOffer = false,
  pending = false,
  shrine = null,
  shrinePending = false,
  onShrinePurchase,
  onTribute,
}: TributePanelProps) {
  const isMaxAffection = affection >= 100;

  return (
    <section className="rounded-[2rem] border border-fuchsia-200/15 bg-black/50 p-5 shadow-[0_0_44px_rgba(217,70,239,0.12)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-pink-200/70">
            Tribute System
          </p>
          <h2 className="text-3xl font-black">{hideAffectionOffer ? "Shrine of Principessa" : "Offer Principessa Coins"}</h2>
        </div>
        <p className="rounded-full border border-pink-200/20 bg-pink-500/10 px-4 py-2 text-sm font-semibold text-pink-50">
          Balance: {coins.toLocaleString()} coins
        </p>
      </div>

      {!hideAffectionOffer && (
        <>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {tributeOptions.map((option) => (
              <button
                className="group rounded-[1.5rem] border border-white/10 bg-[linear-gradient(160deg,rgba(255,255,255,0.08),rgba(236,72,153,0.08),rgba(0,0,0,0.42))] p-5 text-left transition enabled:hover:-translate-y-0.5 enabled:hover:border-pink-300/50 enabled:hover:shadow-[0_0_30px_rgba(236,72,153,0.2)] disabled:cursor-not-allowed disabled:opacity-45"
                disabled={disabled || pending || isMaxAffection || coins < option.amount}
                key={option.amount}
                onClick={() => onTribute(option.amount)}
                type="button"
              >
                <p className="text-sm font-semibold text-fuchsia-100">
                  {option.label}
                </p>
                <p className="mt-4 text-4xl font-black text-white">
                  {option.amount}
                </p>
                <p className="mt-1 text-sm text-zinc-400">coins</p>
                <p className="mt-5 rounded-full border border-pink-200/20 bg-black/30 px-3 py-2 text-center text-xs font-bold uppercase tracking-[0.2em] text-pink-100 group-hover:bg-pink-500/15">
                  {option.boost}
                </p>
              </button>
            ))}
          </div>

          <p className="mt-5 text-sm leading-6 text-zinc-400">
            {isMaxAffection
              ? "Principessa's mood is already at its peak. Ordinary tribute rests now, but the Shrine still welcomes offerings."
              : disabled
                ? "Timeout is active. Tribute actions are locked until the timer ends."
              : "Prototype note: tributes spend Principessa Coins only. This is where a future backend or Supabase ledger could record non-payment game events."}
          </p>
        </>
      )}

      {hideAffectionOffer && (
        <div className="mt-5 rounded-[1.6rem] border border-amber-200/15 bg-[linear-gradient(155deg,rgba(120,53,15,0.28),rgba(88,28,135,0.16),rgba(0,0,0,0.5))] p-5 shadow-[0_0_34px_rgba(251,191,36,0.12)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.26em] text-amber-100/70">
                Sacred Offerings
              </p>
              <h3 className="mt-2 text-2xl font-black text-white">
                Deepen your devotion through sacred offerings.
              </h3>
              <p className="mt-2 text-sm leading-6 text-amber-50/80">
                Each offering increases your Tribute Score, grants Devotion, and contributes toward revealing new Shrine Memories.
                Every {SHRINE_IMAGE_UNLOCK_COST.toLocaleString()} shrine coins reveals a memory, and every {SHRINE_LEVEL_COIN_INTERVAL.toLocaleString()} coins raises Worship Level.
              </p>
            </div>
            <div className="rounded-2xl border border-amber-200/15 bg-black/30 px-4 py-3 text-sm text-amber-50/85">
              <p className="font-semibold">Offered at the Shrine: {shrine?.totalSpent.toLocaleString() ?? "0"} coins</p>
              <p className="mt-1">
                Memories Revealed: {shrine?.unlockedImageCount ?? 0}/{shrine?.availableImageCount ?? 0}
              </p>
              <p className="mt-1">
                Worship Level: {shrine?.level.toLocaleString() ?? "0"}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(16rem,0.55fr)]">
            <div className="grid gap-3 md:grid-cols-3">
              {SHRINE_PURCHASE_OPTIONS.map((option) => (
                <button
                  className="group rounded-[1.35rem] border border-amber-200/15 bg-[linear-gradient(160deg,rgba(251,191,36,0.12),rgba(236,72,153,0.1),rgba(0,0,0,0.45))] p-4 text-left transition enabled:hover:-translate-y-0.5 enabled:hover:border-amber-200/40 enabled:hover:shadow-[0_0_24px_rgba(251,191,36,0.16)] disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={disabled || shrinePending || coins < option.amount}
                  key={option.amount}
                  onClick={() => onShrinePurchase?.(option.amount)}
                  type="button"
                >
                  <p className="text-sm font-semibold text-amber-50">{option.label}</p>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-3xl font-black text-white">{option.amount.toLocaleString()}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-400">coins offered</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-300">{option.description}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-amber-50/85">
                    <span className="rounded-full border border-amber-200/20 bg-black/25 px-2.5 py-1.5">
                      +{option.devotionReward} Devotion
                    </span>
                    <span className="rounded-full border border-pink-200/20 bg-black/25 px-2.5 py-1.5">
                      +{option.amount.toLocaleString()} Tribute
                    </span>
                    <span className="rounded-full border border-sky-200/20 bg-black/25 px-2.5 py-1.5">
                      +{Math.floor(option.amount / SHRINE_LEVEL_COIN_INTERVAL)} Worship
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <div className="grid gap-4">
            <div className="rounded-[1.35rem] border border-white/10 bg-black/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-100/70">
                  Latest Shrine Memory
                </p>
                {shrine?.coinsUntilNextUnlock !== null ? (
                  <span className="rounded-full border border-amber-200/15 bg-amber-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-amber-50">
                    {shrine?.coinsUntilNextUnlock?.toLocaleString() ?? "0"} to next reveal
                  </span>
                ) : (
                  <span className="rounded-full border border-emerald-200/15 bg-emerald-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-50">
                    Every current memory revealed
                  </span>
                )}
              </div>

              <div className="mt-4 overflow-hidden rounded-[1.1rem] border border-amber-200/15 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.18),rgba(0,0,0,0.62))]">
                {shrine?.currentImagePath ? (
                  <div>
                    <Image
                      alt={shrine.currentMemory?.title ?? "Current Shrine Memory"}
                      className="h-40 w-full object-cover"
                      height={320}
                      src={shrine.currentImagePath}
                      width={480}
                    />
                    {shrine.currentMemory?.title ? (
                      <div className="border-t border-amber-200/10 bg-black/35 px-3 py-2.5">
                        <p className="text-sm font-semibold text-amber-50">{shrine.currentMemory.title}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-amber-100/60">
                          Full Shrine Memories now live in Gallery
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex min-h-[12rem] flex-col items-center justify-center px-5 py-8 text-center">
                    <p className="text-sm font-black uppercase tracking-[0.24em] text-amber-50/70">
                      Awaiting Shrine Memories
                    </p>
                    <p className="mt-3 max-w-xs text-sm leading-6 text-zinc-300">
                      Future Shrine Memories can be placed in `public/shrine`, and each new one will become part of the next revelation cycle.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/35">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#f59e0b,#ec4899,#fde68a)] transition-[width]"
                  style={{
                    width: `${Math.max(
                      6,
                      Math.min(
                        100,
                        shrine?.coinsUntilNextUnlock === null
                          ? 100
                          : (((shrine?.totalSpent ?? 0) % SHRINE_IMAGE_UNLOCK_COST) / SHRINE_IMAGE_UNLOCK_COST) * 100,
                      ),
                    )}%`,
                  }}
                />
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                {shrine?.availableImageCount
                  ? `${shrine?.unlockedImageCount ?? 0} of ${shrine?.availableImageCount ?? 0} Shrine Memories have been revealed. Browse the full collection in Gallery.`
                  : "No Shrine Memories have been placed yet, but your offerings are already being remembered."}
              </p>
            </div>
              <div className="rounded-[1.35rem] border border-amber-200/15 bg-black/30 p-4">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-100/70">
                  Top 5 Worshippers
                </p>
                <div className="mt-3 grid gap-2">
                  {(shrine?.topWorshippers ?? []).length > 0 ? (
                    shrine?.topWorshippers.map((worshipper, index) => (
                      <div
                        className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2"
                        key={worshipper.userId}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-white">
                            #{index + 1} {worshipper.displayName || worshipper.username}
                          </p>
                          {worshipper.displayName ? (
                            <p className="truncate text-xs text-amber-100/55">{worshipper.username}</p>
                          ) : null}
                        </div>
                        <p className="shrink-0 text-sm font-black text-amber-50">
                          {worshipper.totalSpent.toLocaleString()}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-zinc-400">
                      No Shrine offerings yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-[1.5rem] border border-pink-200/20 bg-[linear-gradient(145deg,rgba(236,72,153,0.12),rgba(0,0,0,0.34))] p-4 shadow-[0_0_28px_rgba(236,72,153,0.12)]">
        <a
          className="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-5 py-3 text-center text-sm font-black uppercase tracking-[0.16em] text-white shadow-[0_0_24px_rgba(236,72,153,0.28)] transition hover:scale-[1.01] sm:w-auto"
          href="https://throne.com/principessa2dfd"
          rel="noopener noreferrer"
          target="_blank"
        >
          Get Coins / Tribute on Throne
        </a>
        <p className="mt-4 text-sm leading-6 text-pink-50">
          After supporting on Throne, DM @VMPrincipessa with your app username
          to receive coins manually. 1 USD = 1000 coins.
        </p>
        <p className="mt-2 text-xs leading-5 text-zinc-500">
          Coins are fantasy points and are manually granted as supporter
          rewards. No automatic payment integration yet.
        </p>
        <div className="mt-4 overflow-hidden rounded-2xl border border-fuchsia-200/15 bg-black/35 shadow-[0_0_22px_rgba(217,70,239,0.1)]">
          <Image
            alt="Bonus coin reward tiers"
            className="h-auto w-full"
            height={1024}
            src="/bonus-coin-rewards.jpg"
            width={1536}
          />
        </div>
      </div>
    </section>
  );
}
