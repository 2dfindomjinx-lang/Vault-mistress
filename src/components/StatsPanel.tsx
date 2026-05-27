type StatsPanelProps = {
  stats: {
    coins: number;
    affection: number;
    loyaltyStreak: number;
    tributeTotal: number;
  };
};

export function StatsPanel({ stats }: StatsPanelProps) {
  const statCards = [
    ["Coins", stats.coins.toLocaleString(), "Principessa Coin balance"],
    ["Affection", `${stats.affection}/100`, "Principessa's current approval"],
    ["Loyalty Streak", `${stats.loyaltyStreak} days`, "Prototype daily streak"],
    ["Tribute Total", stats.tributeTotal.toLocaleString(), "Coins offered so far"],
  ];

  return (
    <section className="grid grid-cols-2 gap-3">
      {statCards.map(([label, value, hint]) => (
        <div
          className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-4 shadow-[0_0_28px_rgba(168,85,247,0.1)]"
          key={label}
        >
          <p className="text-xs uppercase tracking-[0.22em] text-fuchsia-200/70">
            {label}
          </p>
          <p className="mt-2 text-2xl font-black text-white sm:text-3xl">
            {value}
          </p>
          <p className="mt-1 text-xs text-zinc-400">{hint}</p>
        </div>
      ))}
    </section>
  );
}
