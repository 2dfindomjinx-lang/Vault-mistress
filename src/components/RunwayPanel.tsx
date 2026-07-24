"use client";

import { useCallback, useEffect, useState } from "react";
import { LayeredAvatar } from "@/components/LayeredAvatar";
import { RunwayAvatarEditor } from "@/components/RunwayAvatarEditor";
import type { CrateInventoryItem } from "@/components/CratesPanel";
import { normalizeEquipment, type EquippedAvatarSlots } from "@/lib/avatar-slots";

type RunwayPanelProps = {
  disabled?: boolean;
  ownedItems: CrateInventoryItem[];
  liveEquippedSlots: EquippedAvatarSlots;
  liveEquippedFullSetId: string | null;
};

type MyAvatar = {
  id: string;
  equippedAvatarSlots: EquippedAvatarSlots;
  equippedFullSetId: string | null;
  hasUncensoredAvatar: boolean;
  totalPoints: number;
  ratingCount: number;
  isActive: boolean;
  createdAt: string;
  activatedAt: string;
  rank: number | null;
  nextEligibleAt: string;
  canResubmit: boolean;
};

type Candidate = {
  tokenId: string;
  avatarId: string;
  ownerUserId: string;
  username: string;
  displayName: string | null;
  equippedAvatarSlots: EquippedAvatarSlots;
  equippedFullSetId: string | null;
  hasUncensoredAvatar: boolean;
  totalPoints: number;
  ratingCount: number;
  submittedAt: string;
  existingRating: number | null;
};

type LeaderboardEntry = {
  rank: number;
  avatarId: string;
  ownerUserId: string;
  username: string;
  displayName: string | null;
  equippedAvatarSlots: EquippedAvatarSlots;
  equippedFullSetId: string | null;
  hasUncensoredAvatar: boolean;
  totalPoints: number;
  ratingCount: number;
  averageRating: number | null;
  createdAt: string;
};

type LeaderboardSection = "top" | "highest_rated" | "new";

const SECTION_LABELS: Record<LeaderboardSection, string> = {
  top: "Top Avatars",
  highest_rated: "Highest Rated",
  new: "New Avatars",
};
const RUNWAY_VOTING_BACKGROUND = "/principessa-ui/generated/runway-voting-background.png";

function newIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function RunwayPanel({ disabled = false, ownedItems, liveEquippedSlots, liveEquippedFullSetId }: RunwayPanelProps) {
  const [myAvatar, setMyAvatar] = useState<MyAvatar | null>(null);
  const [canAddMultipleAvatars, setCanAddMultipleAvatars] = useState(false);
  const [loadingMe, setLoadingMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [candidate, setCandidate] = useState<Candidate | null | undefined>(undefined);
  const [selectedStars, setSelectedStars] = useState(0);
  const [voting, setVoting] = useState(false);

  const [section, setSection] = useState<LeaderboardSection>("top");
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [viewerEntry, setViewerEntry] = useState<LeaderboardEntry | null>(null);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);
  const [rewardedVotesToday, setRewardedVotesToday] = useState<number | null>(null);

  const loadMe = useCallback(async () => {
    setLoadingMe(true);
    try {
      const res = await fetch("/api/user/runway/me");
      const data = await res.json().catch(() => null);
      setMyAvatar(data?.avatar ?? null);
      setCanAddMultipleAvatars(data?.canAddMultipleAvatars === true);
    } catch (err) {
      console.error("Runway me fetch error", err);
    } finally {
      setLoadingMe(false);
    }
  }, []);

  const loadCandidate = useCallback(async () => {
    try {
      const res = await fetch("/api/user/runway/candidate");
      const data = await res.json().catch(() => null);
      const nextCandidate = (data?.candidate ?? null) as Candidate | null;
      setCandidate(nextCandidate);
      setSelectedStars(nextCandidate?.existingRating ?? 0);
    } catch (err) {
      console.error("Runway candidate fetch error", err);
      setCandidate(null);
    }
  }, []);

  const loadLeaderboard = useCallback(async (nextSection: LeaderboardSection) => {
    setLoadingLeaderboard(true);
    try {
      const res = await fetch(`/api/user/runway/leaderboard?section=${nextSection}`);
      const data = await res.json().catch(() => null);
      setLeaders(Array.isArray(data?.leaders) ? data.leaders : []);
      setViewerEntry(data?.viewer ?? null);
    } catch (err) {
      console.error("Runway leaderboard fetch error", err);
      setLeaders([]);
      setViewerEntry(null);
    } finally {
      setLoadingLeaderboard(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount data load, not a derivable value
    void loadMe();
    void loadCandidate();
  }, [loadMe, loadCandidate]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-when-section-changes data load, not a derivable value
    void loadLeaderboard(section);
  }, [section, loadLeaderboard]);

  const handleSubmit = useCallback(
    async (draft: { equippedAvatarSlots: EquippedAvatarSlots; equippedFullSetId: string | null }) => {
      if (submitting) return;
      setSubmitting(true);
      try {
        const res = await fetch("/api/user/runway/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...draft, idempotencyKey: newIdempotencyKey() }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          alert(data?.error ?? "Submission failed.");
          return;
        }
        await loadMe();
        await loadLeaderboard(section);
      } catch (err) {
        console.error("Runway submit error", err);
        alert("Submission failed.");
      } finally {
        setSubmitting(false);
      }
    },
    [submitting, loadMe, loadLeaderboard, section],
  );

  const handleVote = useCallback(
    async (stars: number) => {
      if (voting || !candidate) return;
      setVoting(true);
      try {
        const res = await fetch("/api/user/runway/vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            avatarId: candidate.avatarId,
            rating: stars,
            tokenId: candidate.tokenId,
            idempotencyKey: newIdempotencyKey(),
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          alert(data?.error ?? "Vote failed.");
          await loadCandidate();
          return;
        }
        if (typeof data?.rewardGranted === "boolean") {
          setRewardedVotesToday((prev) => {
            if (!data.rewardGranted) return prev ?? 0;
            return Math.min(5, (prev ?? 0) + 1);
          });
        }
        await loadCandidate();
        void loadLeaderboard(section);
      } catch (err) {
        console.error("Runway vote error", err);
      } finally {
        setVoting(false);
      }
    },
    [voting, candidate, loadCandidate, loadLeaderboard, section],
  );

  const handleSkip = useCallback(async () => {
    if (voting || !candidate) return;
    setVoting(true);
    try {
      await fetch("/api/user/runway/skip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatarId: candidate.avatarId,
          tokenId: candidate.tokenId,
          idempotencyKey: newIdempotencyKey(),
        }),
      });
      await loadCandidate();
    } catch (err) {
      console.error("Runway skip error", err);
    } finally {
      setVoting(false);
    }
  }, [voting, candidate, loadCandidate]);

  const canSubmit = canAddMultipleAvatars || (myAvatar ? myAvatar.canResubmit : true);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-fuchsia-200/15 bg-black/50 p-5 shadow-[0_0_44px_rgba(217,70,239,0.12)]">
        <p className="text-sm uppercase tracking-[0.3em] text-fuchsia-200/70">Runway</p>
        <h2 className="text-3xl font-black">Your Voting Avatar</h2>

        {!loadingMe && myAvatar && (
          <div className="mt-4 flex gap-3 rounded-[1.25rem] border border-white/10 bg-black/30 p-3">
            <div className="relative h-[152px] w-[56px] shrink-0 overflow-hidden rounded-xl border border-pink-300/25 bg-black/40">
              <LayeredAvatar
                alt="Your active voting avatar"
                backgroundPath={RUNWAY_VOTING_BACKGROUND}
                equipped={normalizeEquipment(myAvatar.equippedAvatarSlots)}
                equippedFullSetId={myAvatar.equippedFullSetId}
                hasUncensored={myAvatar.hasUncensoredAvatar}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-pink-100/65">Currently in the voting pool</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Rank" value={myAvatar.rank ? `#${myAvatar.rank}` : "Unranked"} />
            <StatTile label="Total Points" value={String(myAvatar.totalPoints)} />
            <StatTile
              label="Average"
              value={myAvatar.ratingCount > 0 ? (myAvatar.totalPoints / myAvatar.ratingCount).toFixed(2) : "—"}
            />
            <StatTile label="Votes" value={String(myAvatar.ratingCount)} />
              </div>
            </div>
          </div>
        )}

        <div className="mt-4">
          <RunwayAvatarEditor
            ownedItems={ownedItems}
            liveEquippedSlots={liveEquippedSlots}
            liveEquippedFullSetId={liveEquippedFullSetId}
            canSubmit={!disabled && canSubmit}
            submitting={submitting}
            nextEligibleAt={myAvatar?.nextEligibleAt ?? null}
            canAddMultipleAvatars={canAddMultipleAvatars}
            onSubmit={handleSubmit}
          />
        </div>
      </section>

      <section className="rounded-[2rem] border border-fuchsia-200/15 bg-black/50 p-5 shadow-[0_0_44px_rgba(217,70,239,0.12)]">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black">Vote</h2>
          <p className="text-xs text-zinc-400">
            {rewardedVotesToday ?? 0}/5 rewarded votes today
          </p>
        </div>

        {candidate === undefined ? (
          <p className="mt-4 text-sm text-zinc-400">Loading...</p>
        ) : candidate === null ? (
          <p className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-sm text-zinc-400">
            No one else has a look in the pool right now. Check back soon.
          </p>
        ) : (
          <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-black/30 p-4">
            <div className="flex gap-4">
              <div className="relative h-[220px] w-[74px] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                <LayeredAvatar
                  alt={`${candidate.username}'s voting avatar`}
                  backgroundPath={RUNWAY_VOTING_BACKGROUND}
                  equipped={normalizeEquipment(candidate.equippedAvatarSlots)}
                  equippedFullSetId={candidate.equippedFullSetId}
                  hasUncensored={candidate.hasUncensoredAvatar}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-black text-white">{candidate.username}</p>
                <p className="text-xs text-zinc-400">
                  Submitted {new Date(candidate.submittedAt).toLocaleDateString()}
                </p>
                <p className="mt-1 text-xs text-pink-100/80">
                  {candidate.totalPoints} points · {candidate.ratingCount} votes
                </p>

                <div className="mt-3 flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      disabled={voting || disabled}
                      onClick={() => {
                        setSelectedStars(star);
                        void handleVote(star);
                      }}
                      className={`text-2xl transition ${star <= selectedStars ? "text-amber-300" : "text-white/20 hover:text-white/40"}`}
                      aria-label={`Rate ${star} star${star === 1 ? "" : "s"}`}
                    >
                      ★
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={voting || disabled}
                  onClick={() => void handleSkip()}
                  className="mt-3 rounded-xl border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold hover:bg-white/10 disabled:opacity-40"
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-[2rem] border border-fuchsia-200/15 bg-black/50 p-5 shadow-[0_0_44px_rgba(217,70,239,0.12)]">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SECTION_LABELS) as LeaderboardSection[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSection(key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] ${
                section === key ? "border-pink-300 bg-pink-500/10 text-pink-100" : "border-white/15 text-zinc-400"
              }`}
            >
              {SECTION_LABELS[key]}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          {loadingLeaderboard ? (
            <p className="text-sm text-zinc-400">Loading...</p>
          ) : leaders.length === 0 ? (
            <p className="text-sm text-zinc-400">Nothing here yet.</p>
          ) : (
            leaders.map((entry) => <LeaderboardRow key={entry.avatarId} entry={entry} />)
          )}
          {viewerEntry && !leaders.some((entry) => entry.avatarId === viewerEntry.avatarId) && (
            <div className="pt-2">
              <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">Your position</p>
              <LeaderboardRow entry={viewerEntry} highlight />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-center">
      <p className="text-lg font-black text-white">{value}</p>
      <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-400">{label}</p>
    </div>
  );
}

function LeaderboardRow({ entry, highlight = false }: { entry: LeaderboardEntry; highlight?: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-[1.25rem] border px-3 py-2.5 ${
        highlight ? "border-amber-300/35 bg-amber-500/5" : "border-white/10 bg-black/30"
      }`}
    >
      <div className="w-10 shrink-0 text-center text-sm font-black text-pink-100">#{entry.rank}</div>
      <div className="relative h-16 w-8 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/40">
        <LayeredAvatar
          alt={`${entry.username}'s voting avatar`}
          backgroundPath={RUNWAY_VOTING_BACKGROUND}
          equipped={normalizeEquipment(entry.equippedAvatarSlots)}
          equippedFullSetId={entry.equippedFullSetId}
          hasUncensored={entry.hasUncensoredAvatar}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-white">{entry.displayName?.trim() || entry.username}</p>
        <p className="text-xs text-zinc-400">
          {entry.totalPoints} pts · {entry.ratingCount} votes
          {entry.averageRating !== null ? ` · ★${entry.averageRating.toFixed(2)}` : ""}
        </p>
      </div>
    </div>
  );
}
