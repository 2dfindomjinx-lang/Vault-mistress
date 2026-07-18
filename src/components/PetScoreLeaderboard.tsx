export type PetScoreLeaderboardEntry = {
  displayName: string | null;
  petScore: number;
  rank: number;
  userId: string;
  username: string;
};

type PetScoreLeaderboardProps = {
  error?: string;
  isLoading?: boolean;
  leaders: PetScoreLeaderboardEntry[];
};

export function PetScoreLeaderboard({
  error,
  isLoading = false,
  leaders,
}: PetScoreLeaderboardProps) {
  return (
    <section className="court-feature-panel overflow-hidden rounded-[1.35rem] border border-rose-200/20 bg-[linear-gradient(150deg,rgba(136,19,55,0.22),rgba(0,0,0,0.52))] shadow-[0_0_26px_rgba(244,63,94,0.1)]">
      <div className="border-b border-rose-100/10 px-4 py-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-200/70">
          Pet Score
        </p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <h3 className="text-lg font-black text-white">Principessa&apos;s Top Pets</h3>
          <span className="rounded-full border border-rose-200/20 bg-rose-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-rose-100">
            All Time
          </span>
        </div>
        <p className="mt-2 text-xs leading-5 text-zinc-400">
          The highest Pet Scores in the vault.
        </p>
      </div>

      <div className="px-3 py-3">
        <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] gap-2 px-2 pb-2 text-[9px] font-black uppercase tracking-[0.16em] text-rose-100/45">
          <span>Rank</span>
          <span>Pet</span>
          <span>Score</span>
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-6 text-center text-xs text-rose-100/65">
            Loading Pet Scores...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-300/20 bg-red-500/10 px-3 py-4 text-xs text-red-50/90">
            {error}
          </div>
        ) : leaders.length > 0 ? (
          <div className="space-y-1.5">
            {leaders.map((entry) => {
              const mainName = entry.displayName?.trim() || entry.username;
              const isPodium = entry.rank <= 3;

              return (
                <div
                  className={`grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border px-2 py-2.5 ${
                    isPodium
                      ? "border-amber-200/20 bg-amber-400/[0.07]"
                      : "border-white/8 bg-black/25"
                  }`}
                  key={entry.userId}
                >
                  <span className={`text-center text-sm font-black ${isPodium ? "text-amber-200" : "text-rose-100/75"}`}>
                    #{entry.rank}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black text-white" title={mainName}>
                      {mainName}
                    </p>
                    {entry.displayName ? (
                      <p className="truncate text-[10px] text-rose-100/55" title={entry.username}>
                        {entry.username}
                      </p>
                    ) : null}
                  </div>
                  <span className="text-right text-sm font-black text-amber-100">
                    {entry.petScore.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-6 text-center text-xs text-rose-100/65">
            No Pet Scores have been recorded yet.
          </div>
        )}
      </div>
    </section>
  );
}
