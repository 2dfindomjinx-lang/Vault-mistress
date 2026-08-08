"use client";

import type { PetScoreLeaderboardEntry } from "@/components/PetScoreLeaderboard";
import type { DevotionLeaderboardResponse, DevotionPeriod } from "@/lib/devotion";

export type CourtLeaderboardBoard = "devotion" | "pet";

// Home's left column is only minmax(0,0.95fr) of the xl grid, so this renders a
// dense text-only table: no avatars, no next/image, no ProfileBorderFrame. The
// full Devotion presentation is intentionally not reproduced here.
type CompactRow = {
  userId: string;
  rank: number;
  name: string;
  subName: string | null;
  value: number;
};

type CourtLeaderboardCompactProps = {
  board: CourtLeaderboardBoard;
  onBoardChange: (board: CourtLeaderboardBoard) => void;
  devotionData: DevotionLeaderboardResponse;
  devotionError?: string;
  devotionPeriod: DevotionPeriod;
  onDevotionPeriodChange: (period: DevotionPeriod) => void;
  isDevotionLoading?: boolean;
  petLeaders: PetScoreLeaderboardEntry[];
  petError?: string;
  isPetLoading?: boolean;
  viewerUserId?: string | null;
  limit?: number;
};

const periodOptions: Array<{ id: DevotionPeriod; label: string }> = [
  { id: "weekly", label: "Week" },
  { id: "monthly", label: "Month" },
  { id: "all_time", label: "All" },
];

export function CourtLeaderboardCompact({
  board,
  onBoardChange,
  devotionData,
  devotionError,
  devotionPeriod,
  onDevotionPeriodChange,
  isDevotionLoading = false,
  petLeaders,
  petError,
  isPetLoading = false,
  viewerUserId = null,
  limit = 5,
}: CourtLeaderboardCompactProps) {
  const isDevotion = board === "devotion";

  const rows: CompactRow[] = isDevotion
    ? (devotionData?.leaders ?? []).map((entry) => ({
        userId: entry.userId,
        rank: entry.rank,
        name: entry.displayName?.trim() || entry.username,
        subName: entry.displayName ? entry.username : null,
        value: entry.devotion,
      }))
    : petLeaders.map((entry) => ({
        userId: entry.userId,
        rank: entry.rank,
        name: entry.displayName?.trim() || entry.username,
        subName: entry.displayName ? entry.username : null,
        value: entry.petScore,
      }));

  const visibleRows = rows.slice(0, limit);
  const isLoading = isDevotion ? isDevotionLoading : isPetLoading;
  const error = isDevotion ? devotionError : petError;

  // Once the header Rank tile is gone this is the only place a user can see
  // their own devotion standing, so keep it even when they are outside the top N.
  const viewerRow =
    viewerUserId && !visibleRows.some((row) => row.userId === viewerUserId)
      ? rows.find((row) => row.userId === viewerUserId) ?? null
      : null;

  return (
    <section className="court-feature-panel overflow-hidden rounded-[1.35rem] border border-amber-200/20 bg-[linear-gradient(150deg,rgba(120,53,15,0.2),rgba(0,0,0,0.52))] shadow-[0_0_26px_rgba(251,191,36,0.1)]">
      <div className="border-b border-amber-100/10 px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] transition ${
              isDevotion
                ? "border-amber-200/40 bg-amber-400/15 text-amber-50"
                : "border-white/10 bg-black/25 text-zinc-400 hover:text-amber-100"
            }`}
            onClick={() => onBoardChange("devotion")}
            type="button"
          >
            Devotion
          </button>
          <button
            className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] transition ${
              !isDevotion
                ? "border-rose-200/40 bg-rose-400/15 text-rose-50"
                : "border-white/10 bg-black/25 text-zinc-400 hover:text-rose-100"
            }`}
            onClick={() => onBoardChange("pet")}
            type="button"
          >
            Pet Score
          </button>

          {isDevotion &&
            periodOptions.map((option) => (
              <button
                className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] transition ${
                  devotionPeriod === option.id
                    ? "border-amber-200/30 bg-amber-400/10 text-amber-100"
                    : "border-white/8 bg-black/20 text-zinc-500 hover:text-amber-100/80"
                }`}
                key={option.id}
                onClick={() => onDevotionPeriodChange(option.id)}
                type="button"
              >
                {option.label}
              </button>
            ))}
        </div>
      </div>

      <div className="px-3 py-3">
        <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] gap-2 px-2 pb-2 text-[9px] font-black uppercase tracking-[0.16em] text-amber-100/45">
          <span>Rank</span>
          <span>{isDevotion ? "Devotee" : "Pet"}</span>
          <span>{isDevotion ? "Devotion" : "Score"}</span>
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-6 text-center text-xs text-amber-100/65">
            Loading...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-300/20 bg-red-500/10 px-3 py-4 text-xs text-red-50/90">
            {error}
          </div>
        ) : visibleRows.length > 0 ? (
          <div className="space-y-1.5">
            {visibleRows.map((row) => {
              const isPodium = row.rank <= 3;
              const isViewer = row.userId === viewerUserId;

              return (
                <div
                  className={`grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border px-2 py-2 ${
                    isViewer
                      ? "border-pink-200/30 bg-pink-500/10"
                      : isPodium
                        ? "border-amber-200/20 bg-amber-400/[0.07]"
                        : "border-white/8 bg-black/25"
                  }`}
                  key={row.userId}
                >
                  <span className={`text-center text-sm font-black ${isPodium ? "text-amber-200" : "text-amber-100/75"}`}>
                    #{row.rank}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black text-white" title={row.name}>
                      {row.name}
                    </p>
                    {row.subName ? (
                      <p className="truncate text-[10px] text-amber-100/55" title={row.subName}>
                        {row.subName}
                      </p>
                    ) : null}
                  </div>
                  <span className="text-right text-sm font-black text-amber-100">
                    {row.value.toLocaleString()}
                  </span>
                </div>
              );
            })}

            {viewerRow && (
              <div className="mt-1 grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-pink-200/30 bg-pink-500/10 px-2 py-2">
                <span className="text-center text-sm font-black text-pink-100">#{viewerRow.rank}</span>
                <p className="truncate text-xs font-black text-pink-50">You</p>
                <span className="text-right text-sm font-black text-pink-100">
                  {viewerRow.value.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-6 text-center text-xs text-amber-100/65">
            {isDevotion ? "No devotion recorded yet." : "No Pet Scores have been recorded yet."}
          </div>
        )}
      </div>
    </section>
  );
}
