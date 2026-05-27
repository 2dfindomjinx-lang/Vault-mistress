type TributePanelProps = {
  affection: number;
  coins: number;
  onTribute: (amount: number) => void;
};

const tributeOptions = [
  { amount: 25, label: "Velvet Coin Drop", boost: "+1 affection" },
  { amount: 100, label: "Gilded Offering", boost: "+5 affection" },
  { amount: 500, label: "Vault Tribute", boost: "+30 affection" },
];

export function TributePanel({ affection, coins, onTribute }: TributePanelProps) {
  const isMaxAffection = affection >= 100;

  return (
    <section className="rounded-[2rem] border border-fuchsia-200/15 bg-black/50 p-5 shadow-[0_0_44px_rgba(217,70,239,0.12)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-pink-200/70">
            Tribute System
          </p>
          <h2 className="text-3xl font-black">Offer Principessa Coins</h2>
        </div>
        <p className="rounded-full border border-pink-200/20 bg-pink-500/10 px-4 py-2 text-sm font-semibold text-pink-50">
          Balance: {coins.toLocaleString()} coins
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {tributeOptions.map((option) => (
          <button
            className="group rounded-[1.5rem] border border-white/10 bg-[linear-gradient(160deg,rgba(255,255,255,0.08),rgba(236,72,153,0.08),rgba(0,0,0,0.42))] p-5 text-left transition enabled:hover:-translate-y-0.5 enabled:hover:border-pink-300/50 enabled:hover:shadow-[0_0_30px_rgba(236,72,153,0.2)] disabled:cursor-not-allowed disabled:opacity-45"
            disabled={isMaxAffection || coins < option.amount}
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
          ? "Principessa's mood is already at its peak. Tribute is locked until a future prestige system exists."
          : "Prototype note: tributes spend Principessa Coins only. This is where a future backend or Supabase ledger could record non-payment game events."}
      </p>

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
          After supporting on Throne, DM me with your app username to receive
          coins manually. 1 USD = 100 coins.
        </p>
        <p className="mt-2 text-xs leading-5 text-zinc-500">
          Coins are fantasy points and are manually granted as supporter
          rewards. No automatic payment integration yet.
        </p>
      </div>
    </section>
  );
}
