import { getLeadershipRank } from "@/lib/leadership";

type StatsPanelProps = {
  stats: {
    coins: number;
    affection: number;
    loyaltyStreak: number;
    tributeTotal: number;
  };
};

export function StatsPanel({ stats }: StatsPanelProps) {
  const leadership = getLeadershipRank(stats.tributeTotal);
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
      <div className="col-span-2 rounded-[1.5rem] border border-pink-200/20 bg-pink-500/[0.08] p-4 shadow-[0_0_34px_rgba(236,72,153,0.14)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-fuchsia-200/70">
              Leadership
            </p>
            <p className="mt-2 text-2xl font-black text-white sm:text-3xl">
              {leadership.currentRank.title}
            </p>
          </div>
          <p className="rounded-full border border-pink-200/20 bg-black/35 px-3 py-1 text-xs font-bold text-pink-100">
            {stats.tributeTotal.toLocaleString()} prestige
          </p>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/55">
          <div
            className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-pink-500 to-rose-400 shadow-[0_0_18px_rgba(236,72,153,0.65)]"
            style={{ width: `${leadership.progress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          {leadership.nextRank
            ? `${leadership.remaining.toLocaleString()} more Tribute Total to reach ${leadership.nextRank.title}.`
            : "Maximum leadership rank reached."}
        </p>
      </div>
    </section>
  );
}
