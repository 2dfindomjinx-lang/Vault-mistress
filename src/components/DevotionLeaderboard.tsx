import Image from "next/image";
import { LayeredAvatar } from "@/components/LayeredAvatar";
import {
  type DevotionLeaderboardEntry,
  type DevotionLeaderboardResponse,
  type DevotionPeriod,
} from "@/lib/devotion";
import { normalizeEquipment } from "@/lib/avatar-slots";

type DevotionLeaderboardProps = {
  data: DevotionLeaderboardResponse;
  error?: string;
  isLoading?: boolean;
  onPeriodChange: (period: DevotionPeriod) => void;
};

const periodOptions: Array<{ id: DevotionPeriod; label: string }> = [
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "all_time", label: "All Time" },
];

function getAvatarFrameClasses(entry: DevotionLeaderboardEntry) {
  const frameClassName = entry.frameColor
    ? "bg-white/10"
    : entry.frameVariant === "rainbow"
      ? "bg-[conic-gradient(from_180deg,rgba(244,114,182,0.26)_0deg,rgba(168,85,247,0.28)_60deg,rgba(34,211,238,0.28)_120deg,rgba(16,185,129,0.26)_180deg,rgba(245,158,11,0.26)_240deg,rgba(244,63,94,0.28)_300deg,rgba(244,114,182,0.26)_360deg)]"
      : entry.frameVariant === "runner"
        ? "bg-[linear-gradient(135deg,rgba(255,255,255,0.15),rgba(251,113,133,0.22),rgba(236,72,153,0.24),rgba(255,255,255,0.1))]"
        : "bg-white/10";

  const frameStyle = entry.frameColor
    ? {
        backgroundColor: entry.frameColor,
        boxShadow: `0 0 24px ${entry.frameColor}55`,
      }
    : entry.frameVariant === "rainbow"
      ? {
          boxShadow: "0 0 16px rgba(168, 85, 247, 0.18), 0 0 28px rgba(34, 211, 238, 0.12)",
        }
      : entry.frameVariant === "runner"
        ? {
            boxShadow: "0 0 16px rgba(236, 72, 153, 0.18), 0 0 24px rgba(251, 113, 133, 0.12)",
          }
        : undefined;

  return { frameClassName, frameStyle };
}

function LeaderboardRow({ entry, highlight = false }: { entry: DevotionLeaderboardEntry; highlight?: boolean }) {
  const { frameClassName, frameStyle } = getAvatarFrameClasses(entry);
  const mainName = entry.displayName?.trim() || entry.username;

  return (
    <div
      className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[1.5rem] border px-3 py-3 sm:px-4 ${
        highlight
          ? "border-amber-300/35 bg-[linear-gradient(135deg,rgba(245,158,11,0.14),rgba(236,72,153,0.12),rgba(0,0,0,0.5))] shadow-[0_0_30px_rgba(245,158,11,0.12)]"
          : "border-white/10 bg-black/30"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="w-10 text-center text-sm font-black text-pink-100 sm:w-12 sm:text-base">
          #{entry.rank}
        </div>
        <div className={`relative h-14 w-14 shrink-0 rounded-[1.15rem] p-[2px] ${frameClassName}`} style={frameStyle}>
          <div className="relative h-full w-full overflow-hidden rounded-[1rem] border border-white/12 bg-black/45">
            <LayeredAvatar
              alt={`${mainName} avatar`}
              className="absolute inset-0"
              equipped={normalizeEquipment(entry.equippedAvatarSlots ?? {})}
              hasUncensored={entry.hasUncensoredAvatar}
              imageClassName="object-contain object-center"
            />
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <p
            className="truncate text-sm font-black text-white sm:text-base"
            style={entry.usernameStyle}
            title={mainName}
          >
            {mainName}
          </p>
          {entry.badgeImagePath ? (
            <Image
              alt="Badge"
              className="h-6 w-6 shrink-0 object-contain"
              height={24}
              src={entry.badgeImagePath}
              unoptimized
              width={24}
            />
          ) : null}
        </div>
        {entry.displayName ? (
          <p className="truncate text-xs text-pink-100/60" title={entry.username}>
            {entry.username}
          </p>
        ) : null}
        {entry.titleName ? (
          <p className="mt-1 truncate text-[11px] font-black uppercase tracking-[0.18em] text-amber-100/75" title={entry.titleName}>
            {entry.titleName}
          </p>
        ) : null}
      </div>

      <div className="text-right">
        <p className="text-xs uppercase tracking-[0.18em] text-pink-100/55">Devotion</p>
        <p className="text-lg font-black text-amber-200 sm:text-xl">{entry.devotion.toLocaleString()}</p>
      </div>
    </div>
  );
}

export function DevotionLeaderboard({
  data,
  error,
  isLoading = false,
  onPeriodChange,
}: DevotionLeaderboardProps) {
  return (
    <section className="rounded-[2rem] border border-pink-200/15 bg-[linear-gradient(150deg,rgba(0,0,0,0.7),rgba(66,12,55,0.5),rgba(107,33,58,0.22))] p-5 shadow-[0_0_44px_rgba(244,114,182,0.12)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.32em] text-amber-200/70">Devotion</p>
          <h2 className="mt-2 text-2xl font-black text-white">👑 Mistress&apos; Favourite Pets</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {periodOptions.map((option) => {
            const active = data.period === option.id;

            return (
              <button
                className={`rounded-full border px-4 py-2 text-sm font-black transition ${
                  active
                    ? "border-amber-200/55 bg-amber-400/15 text-amber-50 shadow-[0_0_18px_rgba(245,158,11,0.18)]"
                    : "border-white/10 bg-black/25 text-pink-100 hover:border-pink-300/35 hover:bg-pink-500/10"
                }`}
                key={option.id}
                onClick={() => onPeriodChange(option.id)}
                type="button"
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {isLoading ? (
          <div className="rounded-[1.5rem] border border-white/10 bg-black/25 px-4 py-10 text-center text-sm text-pink-100/70">
            Loading devotion leaderboard...
          </div>
        ) : error ? (
          <div className="rounded-[1.5rem] border border-red-300/20 bg-red-500/10 px-4 py-6 text-sm text-red-50/90">
            {error}
          </div>
        ) : data.leaders.length > 0 ? (
          data.leaders.map((entry) => <LeaderboardRow entry={entry} key={`${entry.userId}:${entry.rank}`} />)
        ) : (
          <div className="rounded-[1.5rem] border border-white/10 bg-black/25 px-4 py-10 text-center text-sm text-pink-100/70">
            No devotion has been recorded for this period yet.
          </div>
        )}
      </div>

      {data.currentUserEntry ? (
        <div className="mt-5 border-t border-dashed border-white/12 pt-5">
          <LeaderboardRow entry={data.currentUserEntry} highlight />
        </div>
      ) : null}
    </section>
  );
}
