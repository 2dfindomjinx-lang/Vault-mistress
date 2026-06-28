import { getBadgeToneClasses, type UserPrestigeBadge } from "@/lib/prestige";

type PrestigeBadgeListProps = {
  badges: UserPrestigeBadge[];
  compact?: boolean;
};

export function PrestigeBadgeList({ badges, compact = false }: PrestigeBadgeListProps) {
  if (badges.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((badge) => (
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 font-black ${
            compact ? "text-[10px] uppercase tracking-[0.18em]" : "text-xs tracking-[0.14em]"
          } ${getBadgeToneClasses(badge.tone)}`}
          key={`${badge.id}:${badge.earnedAt}`}
          title={`${badge.label} · ${badge.description}`}
        >
          {compact ? badge.shortLabel : badge.label}
        </span>
      ))}
    </div>
  );
}
