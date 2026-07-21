import Image from "next/image";
import { LayeredAvatar } from "@/components/LayeredAvatar";
import { ProfileBorderFrame } from "@/components/ProfileBorderFrame";
import { getAvatarBackgroundPresentation } from "@/lib/avatar-background-cosmetics";
import { getCosmeticItem, getTitleNameForAddressTerm } from "@/lib/cosmetics";
import {
  type DevotionLeaderboardEntry,
  type DevotionLeaderboardResponse,
  type DevotionPeriod,
} from "@/lib/devotion";
import { normalizeEquipment } from "@/lib/avatar-slots";
import { getProfileBorderFramePresentation } from "@/lib/profile-border-presentation";

type DevotionLeaderboardProps = {
  data: DevotionLeaderboardResponse;
  error?: string;
  isLoading?: boolean;
  refreshCountdownMs: number;
  onPeriodChange: (period: DevotionPeriod) => void;
};

const periodOptions: Array<{ id: DevotionPeriod; label: string }> = [
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "all_time", label: "All Time" },
];

function getAvatarFramePresentation(entry: DevotionLeaderboardEntry) {
  return getProfileBorderFramePresentation(
    getCosmeticItem(entry.frameItemId ?? ""),
  );
}

function formatCountdown(ms: number) {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

function LeaderboardRow({
  entry,
  highlight = false,
}: {
  entry: DevotionLeaderboardEntry;
  highlight?: boolean;
}) {
  const framePresentation = getAvatarFramePresentation(entry);
  const background = getAvatarBackgroundPresentation(
    getCosmeticItem(entry.backgroundItemId ?? ""),
  );
  const mainName = entry.displayName?.trim() || entry.username;
  const titleName = getTitleNameForAddressTerm(entry.titleName, entry.addressTerm);

  return (
    <div
      className={`court-grid-card ${highlight ? "court-grid-card--gold" : ""} grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[1.5rem] border px-3 py-3 sm:px-4 ${
        highlight
          ? "border-amber-300/35 bg-[linear-gradient(135deg,rgba(245,158,11,0.14),rgba(236,72,153,0.12),rgba(0,0,0,0.5))] shadow-[0_0_30px_rgba(245,158,11,0.12)]"
          : "border-white/10 bg-black/30"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="w-10 text-center text-sm font-black text-pink-100 sm:w-12 sm:text-base">
          #{entry.rank}
        </div>
        <ProfileBorderFrame
          className="h-14 w-14 shrink-0 rounded-[1.15rem]"
          contentClassName="overflow-hidden rounded-[1rem] border border-white/12 bg-black/45"
          presentation={framePresentation}
        >
          <LayeredAvatar
            alt={`${mainName} avatar`}
            backgroundOverlayPath={background.backgroundOverlayPath}
            backgroundPath={background.backgroundPath}
            backgroundStyle={background.backgroundStyle}
            className="absolute inset-0"
            equipped={normalizeEquipment(entry.equippedAvatarSlots ?? {})}
            equippedFullSetId={entry.equippedFullSetId}
            hasUncensored={entry.hasUncensoredAvatar}
            imageClassName="object-contain object-center"
          />
        </ProfileBorderFrame>
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
        {titleName ? (
          <p className="mt-1 truncate text-[11px] font-black uppercase tracking-[0.18em] text-amber-100/75" title={titleName}>
            {titleName}
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
  refreshCountdownMs,
  onPeriodChange,
}: DevotionLeaderboardProps) {
  return (
    <section className="court-feature-panel rounded-[2rem] border border-pink-200/15 bg-[linear-gradient(150deg,rgba(0,0,0,0.7),rgba(66,12,55,0.5),rgba(107,33,58,0.22))] p-5 shadow-[0_0_44px_rgba(244,114,182,0.12)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.32em] text-amber-200/70">Devotion</p>
          <h2 className="mt-2 text-2xl font-black text-white">👑 Principessa&apos;s Favourite Pets</h2>
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

        <div className="court-feature-inset mt-4 rounded-[1.4rem] border border-white/10 bg-black/25 px-4 py-3 text-xs text-pink-100/72">
        <p className="font-black uppercase tracking-[0.2em] text-amber-100/70">Refresh schedule</p>
        <p className="mt-1">
          Updates at <span className="font-black text-white">00:00</span> and{" "}
          <span className="font-black text-white">12:00</span> GMT+3.
        </p>
        <p className="mt-1">
          Next refresh in{" "}
          <span className="font-black text-amber-200">{formatCountdown(refreshCountdownMs)}</span>.
        </p>
        <p className="mt-1 text-[11px] text-pink-100/55">
          Weekly resets at the beginning of each week. Monthly resets at the beginning of each month.
        </p>
      </div>

      <div className="court-grid court-grid--shop mt-5 grid gap-3">
        {isLoading ? (
          <div className="rounded-[1.5rem] border border-white/10 bg-black/25 px-4 py-10 text-center text-sm text-pink-100/70">
            Loading devotion leaderboard...
          </div>
        ) : error ? (
          <div className="rounded-[1.5rem] border border-red-300/20 bg-red-500/10 px-4 py-6 text-sm text-red-50/90">
            {error}
          </div>
        ) : data.leaders.length > 0 ? (
          data.leaders.map((entry) => (
            <LeaderboardRow
              entry={entry}
              key={`${entry.userId}:${entry.rank}`}
            />
          ))
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
