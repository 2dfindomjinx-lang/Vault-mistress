import type { CommunityGoalStatus } from "@/lib/prestige";

type CommunityGoalWidgetProps = {
  goal: CommunityGoalStatus;
};

function formatCountdown(targetIso: string) {
  const diff = Math.max(0, new Date(targetIso).getTime() - Date.now());
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours.toString().padStart(2, "0")}h`;
  }

  return `${hours.toString().padStart(2, "0")}h ${minutes.toString().padStart(2, "0")}m`;
}

export function CommunityGoalWidget({ goal }: CommunityGoalWidgetProps) {
  return (
    <section className="rounded-[2rem] border border-emerald-200/18 bg-[linear-gradient(145deg,rgba(2,22,18,0.9),rgba(6,78,59,0.48),rgba(0,0,0,0.62))] p-5 shadow-[0_0_40px_rgba(16,185,129,0.12)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.32em] text-emerald-200/74">Community Goal</p>
          <h2 className="mt-2 text-2xl font-black text-white">{goal.title}</h2>
        </div>
        <p className="rounded-full border border-emerald-200/20 bg-emerald-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-emerald-50">
          {goal.participantCount.toLocaleString()} participants
        </p>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-black text-white">{goal.progressCoins.toLocaleString()} / {goal.targetCoins.toLocaleString()}</span>
          <span className="font-black text-emerald-200">{goal.progressPercent}%</span>
        </div>
        <div className="mt-3 h-4 overflow-hidden rounded-full bg-black/50">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#34d399,#facc15,#fb7185)] shadow-[0_0_24px_rgba(52,211,153,0.28)]"
            style={{ width: `${goal.progressPercent}%` }}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[1.35rem] border border-white/10 bg-black/25 p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100/70">Reward</p>
          <p className="mt-2 text-lg font-black text-white">{goal.rewardTitle}</p>
          <p className="mt-1 text-sm leading-6 text-emerald-50/72">{goal.rewardDescription}</p>
        </div>
        <div className="rounded-[1.35rem] border border-white/10 bg-black/25 p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100/70">Status</p>
          <p className="mt-2 text-lg font-black text-white">
            {goal.currentUserParticipating ? "You are contributing" : "You have not contributed yet"}
          </p>
          <p className="mt-1 text-sm leading-6 text-emerald-50/72">
            Goal ends in <span className="font-black text-white">{formatCountdown(goal.endsAt)}</span>.
          </p>
          <p className="mt-1 text-sm leading-6 text-emerald-50/72">
            You contributed: <span className="font-black text-white">{goal.currentUserContributionCoins.toLocaleString()}</span>
          </p>
        </div>
      </div>
    </section>
  );
}
