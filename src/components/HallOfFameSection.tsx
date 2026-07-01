import Image from "next/image";
import { LayeredAvatar } from "@/components/LayeredAvatar";
import { PrestigeBadgeList } from "@/components/PrestigeBadgeList";
import { getAvatarBackgroundPresentation } from "@/lib/avatar-background-cosmetics";
import { getCosmeticItem } from "@/lib/cosmetics";
import type { HallOfFameCardData } from "@/lib/prestige";
import { normalizeEquipment } from "@/lib/avatar-slots";
import { getProfileBorderFramePresentation } from "@/lib/profile-border-presentation";

type HallOfFameSectionProps = {
  cards: HallOfFameCardData[];
  isLoading?: boolean;
  onSelectUser: (userId: string) => void;
};

function getFramePresentation(card: HallOfFameCardData) {
  const winner = card.winner;

  if (!winner) {
    return {
      frameClassName: "bg-white/10",
      frameStyle: undefined,
    };
  }
  const presentation = getProfileBorderFramePresentation(
    getCosmeticItem(winner.frameItemId ?? ""),
  );

  return {
    frameClassName: presentation.backgroundClassName,
    frameStyle: presentation.backgroundStyle,
  };
}

export function HallOfFameSection({
  cards,
  isLoading = false,
  onSelectUser,
}: HallOfFameSectionProps) {
  return (
    <section className="overflow-hidden rounded-[2.25rem] border border-amber-200/20 bg-[linear-gradient(145deg,rgba(10,7,2,0.96),rgba(74,22,12,0.74),rgba(111,35,27,0.32))] p-5 shadow-[0_0_56px_rgba(251,191,36,0.12)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.34em] text-amber-200/72">Hall of Fame</p>
          <h2 className="mt-2 text-3xl font-black text-white">Community Prestige</h2>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-amber-50/72">
          Community highlights refresh automatically so visible support, devotion, streak discipline,
          and case obsession always feel noticed.
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {isLoading && cards.length === 0 ? (
          <div className="rounded-[1.8rem] border border-white/10 bg-black/25 px-4 py-10 text-sm text-amber-50/75 md:col-span-2 2xl:col-span-4">
            Loading community honors...
          </div>
        ) : (
          cards.map((card) => {
            const winner = card.winner;
            const frame = getFramePresentation(card);
            const background = getAvatarBackgroundPresentation(
              getCosmeticItem(winner?.backgroundItemId ?? ""),
            );
            const displayName = winner?.displayName?.trim() || winner?.username || "No winner yet";

            return (
              <button
                className="group rounded-[1.8rem] border border-amber-200/18 bg-[linear-gradient(160deg,rgba(255,255,255,0.05),rgba(0,0,0,0.28),rgba(0,0,0,0.52))] p-4 text-left transition hover:border-amber-200/40 hover:bg-[linear-gradient(160deg,rgba(255,255,255,0.08),rgba(126,34,206,0.08),rgba(0,0,0,0.5))]"
                disabled={!winner}
                key={card.id}
                onClick={() => winner && onSelectUser(winner.userId)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-100/74">
                      {card.title}
                    </p>
                    <p className="mt-2 text-2xl font-black text-white">{card.valueDisplay}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-amber-100/55">
                      {card.metricLabel}
                    </p>
                  </div>
                  {winner?.badgeImagePath ? (
                    <Image
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-full object-contain"
                      height={36}
                      src={winner.badgeImagePath}
                      unoptimized
                      width={36}
                    />
                  ) : null}
                </div>

                <div className="mt-4 flex items-center gap-4">
                  <div
                    className={`relative h-20 w-20 shrink-0 rounded-[1.45rem] p-[3px] ${frame.frameClassName}`}
                    style={frame.frameStyle}
                  >
                    <div className="relative h-full w-full overflow-hidden rounded-[1.25rem] border border-white/12 bg-black/45">
                      {winner ? (
                        <LayeredAvatar
                          alt={`${displayName} avatar`}
                          backgroundOverlayPath={background.backgroundOverlayPath}
                          backgroundPath={background.backgroundPath}
                          backgroundStyle={background.backgroundStyle}
                          className="absolute inset-0"
                          equipped={normalizeEquipment(winner.equippedAvatarSlots ?? {})}
                          hasUncensored={winner.hasUncensoredAvatar}
                          imageClassName="object-contain object-center"
                        />
                      ) : null}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <p
                      className="truncate text-lg font-black text-white transition group-hover:text-amber-100"
                      style={winner?.usernameStyle}
                      title={displayName}
                    >
                      {displayName}
                    </p>
                    {winner?.displayName ? (
                      <p className="truncate text-xs text-amber-50/55">{winner.username}</p>
                    ) : null}
                    <p className="mt-1 truncate text-[11px] font-black uppercase tracking-[0.18em] text-amber-100/70">
                      {winner?.titleName ?? "Awaiting first honor"}
                    </p>
                  </div>
                </div>

                {winner ? (
                  <div className="mt-4">
                    <PrestigeBadgeList badges={winner.badges.slice(0, 2)} compact />
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-amber-50/55">No qualifying community activity yet.</p>
                )}
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
