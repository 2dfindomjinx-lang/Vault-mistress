import Image from "next/image";
import {CourtGlyph} from "./court/CourtVisuals";
import styles from "./HomeCourtPanels.module.css";
import { LayeredAvatar } from "@/components/LayeredAvatar";
import { ProfileBorderFrame } from "@/components/ProfileBorderFrame";
import { PrestigeBadgeList } from "@/components/PrestigeBadgeList";
import { DEFAULT_ADDRESS_TERM } from "@/lib/address-term";
import { getAvatarBackgroundPresentation } from "@/lib/avatar-background-cosmetics";
import { getCosmeticItem, getTitleNameForAddressTerm } from "@/lib/cosmetics";
import type { HallOfFameCardData } from "@/lib/prestige";
import { normalizeEquipment } from "@/lib/avatar-slots";
import { getProfileBorderFramePresentation } from "@/lib/profile-border-presentation";

type HallOfFameSectionProps = {
  cards: HallOfFameCardData[];
  compact?: boolean;
  isLoading?: boolean;
  onSelectUser: (userId: string) => void;
};

function getFramePresentation(card: HallOfFameCardData) {
  const winner = card.winner;

  if (!winner) {
    return getProfileBorderFramePresentation(null);
  }
  return getProfileBorderFramePresentation(
    getCosmeticItem(winner.frameItemId ?? ""),
  );
}

export function HallOfFameSection({
  cards,
  compact = false,
  isLoading = false,
  onSelectUser,
}: HallOfFameSectionProps) {
  return <section className={styles.panel+" "+styles.honors} aria-label="Hall of Fame" data-compact={compact}>
    <header className={styles.panelHeader}><div><p className={styles.kicker}>Names she remembers</p><h2>Hall of Fame</h2></div><span>Community honors</span></header>
    <div className={styles.honorGrid}>
      {isLoading && cards.length === 0 ? <p className={styles.empty}>Loading honors…</p> : cards.map(card => {
        const winner = card.winner;
        const frame = getFramePresentation(card);
        const background = getAvatarBackgroundPresentation(getCosmeticItem(winner?.backgroundItemId ?? ""));
        const displayName = winner?.displayName?.trim() || winner?.username || "Unclaimed";
        return <button className={styles.honorCard} type="button" key={card.id} disabled={!winner} onClick={() => winner && onSelectUser(winner.userId)}>
          <header><p>{card.title}</p>{winner?.badgeImagePath ? <Image src={winner.badgeImagePath} alt="" width={30} height={30} unoptimized/> : <CourtGlyph symbol="crown" className={styles.honorMedal}/>}</header>
          <div className={styles.honorPerson}>
            <ProfileBorderFrame className={styles.honorAvatar} contentClassName="overflow-hidden rounded-[inherit] border border-white/10 bg-black/30" presentation={frame}>
              {winner && <LayeredAvatar alt={displayName+" avatar"} backgroundOverlayPath={background.backgroundOverlayPath} backgroundPath={background.backgroundPath} backgroundStyle={background.backgroundStyle} className="absolute inset-0" equipped={normalizeEquipment(winner.equippedAvatarSlots ?? {})} equippedFullSetId={winner.equippedFullSetId} hasUncensored={winner.hasUncensoredAvatar} imageClassName="object-contain object-center"/>}
            </ProfileBorderFrame>
            <div><p className={styles.honorName} style={winner?.usernameStyle} title={displayName}>{displayName}</p>{winner?.displayName && <small>{winner.username}</small>}<p className={styles.honorTitle}>{getTitleNameForAddressTerm(winner?.titleName, winner?.addressTerm ?? DEFAULT_ADDRESS_TERM) ?? "Awaiting the first honor"}</p></div>
          </div>
          <div className={styles.honorValue}><strong>{card.valueDisplay}</strong><span>{card.metricLabel}</span></div>
          {winner && <div className={styles.honorBadges}><PrestigeBadgeList badges={winner.badges.slice(0,2)} compact/></div>}
        </button>;
      })}
    </div>
  </section>;
}
