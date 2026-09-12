"use client";

import { useState } from "react";
import styles from "./HomeCourtPanels.module.css";
import { getBadgeToneClasses, type CommunityGoalStatus, type UserPrestigeBadge } from "@/lib/prestige";

type CommunityGoalWidgetProps = {
  badges?: UserPrestigeBadge[];
  goal: CommunityGoalStatus;
  onBadgesChange?: () => void;
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

export function CommunityGoalWidget({ badges = [], goal, onBadgesChange }: CommunityGoalWidgetProps) {
  const [badgeBusyId, setBadgeBusyId] = useState<string | null>(null);

  const toggleBadge = async (badge: UserPrestigeBadge) => {
    setBadgeBusyId(badge.id);
    try {
      const response = await fetch("/api/user/prestige-badges", {
        body: JSON.stringify({ badgeId: badge.id, equipped: !badge.equipped }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!response.ok) throw new Error("Badge update failed.");
      onBadgesChange?.();
    } catch (error) {
      console.error("Prestige badge update failed", error);
    } finally {
      setBadgeBusyId(null);
    }
  };

  const percent=Math.max(0,Math.min(100,goal.progressPercent));
  return <section className={styles.panel+" "+styles.goal} aria-label="Community Goal">
    <header className={styles.goalHead}><div><p className={styles.kicker}>Community Goal</p><h2>{goal.title}</h2></div><span>{goal.participantCount.toLocaleString()} participants</span></header>
    <div className={styles.goalMain}>
      <div className={styles.goalMeter} role="progressbar" aria-label="Community goal progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="51" fill="none" stroke="#c89a551f" strokeWidth="5"/><circle cx="60" cy="60" r="51" fill="none" stroke="#dab073" strokeWidth="5" strokeDasharray="320.44" strokeDashoffset={320.44*(1-percent/100)} strokeLinecap="round"/></svg><div><strong>{percent}%</strong><small>Of her goal</small></div></div>
      <div className={styles.goalTotals}><strong>{goal.progressCoins.toLocaleString()}</strong><small>of {goal.targetCoins.toLocaleString()} Coins</small><p>{formatCountdown(goal.endsAt)} remaining</p></div>
    </div>
    <div className={styles.reward}><p>The court earns</p><strong>{goal.rewardTitle}</strong><span>{goal.rewardDescription}</span></div>
    <footer className={styles.goalFooter}><div>Your contribution<strong>{goal.currentUserContributionCoins.toLocaleString()} Coins</strong></div><div>{goal.currentUserParticipating?"You’re part of it.":"Your place is waiting."}</div></footer>
    {badges.length>0&&<div className={styles.badges}><p>Your earned profile badges</p><div className={styles.badgeChoices}>{badges.map(badge=><button className={getBadgeToneClasses(badge.tone)} aria-pressed={badge.equipped} disabled={badgeBusyId===badge.id} key={badge.id} onClick={()=>void toggleBadge(badge)} title={badge.description} type="button">{badge.label} · {badge.equipped?"Equipped":"Unequipped"}</button>)}</div></div>}
  </section>;
}
