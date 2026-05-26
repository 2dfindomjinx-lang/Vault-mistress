import type { TaskItem } from "@/lib/types";

type TaskListProps = {
  tasks: TaskItem[];
  onClaim: (taskId: string) => void;
};

export function TaskList({ onClaim, tasks }: TaskListProps) {
  return (
    <section className="rounded-[2rem] border border-fuchsia-200/15 bg-black/50 p-5 shadow-[0_0_44px_rgba(217,70,239,0.12)]">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-pink-200/70">
          Daily Tasks
        </p>
        <h2 className="text-3xl font-black">Earn Vault Coins</h2>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {tasks.map((task) => (
          <article
            className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-4"
            key={task.id}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-white">{task.title}</h3>
                <p className="mt-1 text-sm text-zinc-400">
                  Reward: {task.reward} fake coins
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  task.claimed
                    ? "bg-emerald-400/15 text-emerald-100"
                    : task.completed
                      ? "bg-pink-500/20 text-pink-100"
                      : "bg-white/10 text-zinc-300"
                }`}
              >
                {task.claimed ? "Claimed" : task.completed ? "Ready" : "Open"}
              </span>
            </div>

            <button
              className="mt-4 w-full rounded-2xl border border-pink-200/20 bg-pink-500/10 px-4 py-3 text-sm font-bold text-pink-50 transition enabled:hover:border-pink-300/60 enabled:hover:bg-pink-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!task.completed || task.claimed}
              onClick={() => onClaim(task.id)}
              type="button"
            >
              {task.claimed ? "Reward Claimed" : "Claim Reward"}
            </button>
          </article>
        ))}
      </div>

      <p className="mt-5 text-sm leading-6 text-zinc-400">
        Future hook: task progress can later be calculated server-side so
        rewards cannot be duplicated across devices.
      </p>
    </section>
  );
}
