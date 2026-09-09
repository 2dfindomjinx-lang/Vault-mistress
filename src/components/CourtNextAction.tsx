"use client";
import type { DashboardPage } from "@/lib/dashboard-navigation";
import type { TaskItem } from "@/lib/types";
import { useCourtStorage } from "@/hooks/use-court-storage";
export function CourtNextAction({
  tasks,
  coins,
  userKey,
  onNavigate,
}: {
  tasks: TaskItem[];
  coins: number;
  userKey: string;
  onNavigate: (page: DashboardPage) => void;
}) {
  const [dismissed, setDismissed] = useCourtStorage("court-welcome:" + userKey);
  const login = tasks.find((task) => task.id === "daily-login");
  const gameIds = new Set([
    "typing-accuracy",
    "high-low",
    "number-pick",
    "case-opening",
    "vertical-motion",
    "wait-obediently",
  ]);
  const ready = tasks.some(
    (task) => gameIds.has(task.id) && !task.claimed && !task.cooldownUntil,
  );
  const action =
    login && !login.claimed && !login.cooldownUntil
      ? {
          title: "Your daily reward is ready",
          detail: "Start with your daily Coins, then choose a game.",
          label: "Open Games",
          page: "tasks" as const,
        }
      : ready
        ? {
            title: "A new challenge awaits",
            detail: "Play a daily game and earn Coins for your collection.",
            label: "Choose a game",
            page: "tasks" as const,
          }
        : coins >= 300
          ? {
              title: "Build your collection",
              detail:
                "Choose a memory in the Gallery or set one as your next goal.",
              label: "Visit Gallery",
              page: "collection" as const,
            }
          : {
              title: "Make your court record yours",
              detail:
                "Try your wardrobe and choose a title. Your next daily rewards will return tomorrow.",
              label: "Open wardrobe",
              page: "profile" as const,
            };
  return (
    <section className="court-panel space-y-4" aria-label="Your next step">
      {!dismissed && (
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p className="font-serif text-xl text-[#fff0d2]">
              Your place in the court
            </p>
            <p className="mt-1 text-sm leading-6 text-zinc-300">
              Play to earn Coins. Collect memories and outfits. Return for your
              next challenge. Principessa Money comes from Throne and can be
              converted into Coins.
            </p>
          </div>
          <button
            aria-label="Dismiss introduction"
            className="shrink-0 px-3 py-2 text-sm text-zinc-300"
            onClick={() => setDismissed("yes")}
            type="button"
          >
            Got it
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="court-eyebrow">Your next step</p>
          <h2 className="mt-1 font-serif text-2xl text-[#fff0d2]">
            {action.title}
          </h2>
          <p className="mt-2 text-sm text-zinc-300">{action.detail}</p>
        </div>
        <button
          className="court-button"
          onClick={() => onNavigate(action.page)}
          type="button"
        >
          {action.label} →
        </button>
      </div>
    </section>
  );
}
