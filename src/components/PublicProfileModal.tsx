"use client";

import { useEffect } from "react";
import { ProfileHeader } from "@/components/ProfileHeader";
import { PrestigeBadgeList } from "@/components/PrestigeBadgeList";
import type { PublicCommunityProfile } from "@/lib/prestige";

type PublicProfileModalProps = {
  data: PublicCommunityProfile | null;
  error?: string;
  isOpen: boolean;
  isLoading?: boolean;
  onClose: () => void;
};

export function PublicProfileModal({
  data,
  error,
  isOpen,
  isLoading = false,
  onClose,
}: PublicProfileModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const profile = data?.profile ?? null;
  const stats = data?.stats ?? [];

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-[2.2rem] border border-white/12 bg-[#120917] p-4 shadow-[0_0_70px_rgba(0,0,0,0.55)] sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-pink-100/60">Community Profile</p>
            <p className="mt-1 text-2xl font-black text-white">
              {profile?.displayName?.trim() || profile?.username || "Loading profile"}
            </p>
          </div>
          <button
            className="rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm font-black text-white transition hover:border-white/28 hover:bg-white/10"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        {isLoading ? (
          <div className="rounded-[1.6rem] border border-white/10 bg-black/25 px-4 py-12 text-center text-sm text-pink-100/72">
            Loading profile...
          </div>
        ) : error ? (
          <div className="rounded-[1.6rem] border border-red-300/18 bg-red-500/10 px-4 py-6 text-sm text-red-50/90">
            {error}
          </div>
        ) : profile ? (
          <div className="space-y-5">
            <ProfileHeader
              avatarFrameClassName={profile.frameColor ? "bg-white/10" : undefined}
              avatarFrameStyle={
                profile.frameColor
                  ? {
                      backgroundColor: profile.frameColor,
                      boxShadow: `0 0 28px ${profile.frameColor}55`,
                    }
                  : undefined
              }
              avatarFrameVariant={profile.frameVariant}
              avatarSrc=""
              coins={0}
              currentTitle={profile.titleName ?? undefined}
              displayName={profile.displayName}
              equippedAvatarSlots={profile.equippedAvatarSlots ?? {}}
              hasUncensoredAvatar={profile.hasUncensoredAvatar}
              pageLabel="Community Profile"
              badgeStrip={<PrestigeBadgeList badges={profile.badges} />}
              spendBadge={
                profile.badgeImagePath
                  ? {
                      current: {
                        id: "bronze",
                        imagePath: profile.badgeImagePath,
                        label: "",
                        minSpentCoins: 0,
                      },
                      currentLabel: "",
                      currentSpentCoins: 0,
                      imagePath: profile.badgeImagePath,
                      isEarned: true,
                      next: null,
                      nextLabel: null,
                      nextThreshold: null,
                      progress: 1,
                      summary: "",
                      tooltip: "All-time spend badge",
                    }
                  : null
              }
              showCoinStat={false}
              stats={stats.map((stat) => ({
                label: stat.label,
                value: stat.value,
              }))}
              username={profile.username}
              usernameStyle={profile.usernameStyle}
            />
          </div>
        ) : (
          <div className="rounded-[1.6rem] border border-white/10 bg-black/25 px-4 py-12 text-center text-sm text-pink-100/72">
            This profile could not be loaded.
          </div>
        )}
      </div>
    </div>
  );
}
