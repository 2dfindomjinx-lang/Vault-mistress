import { getDailyGmt3CooldownUntil, isSameGmt3Day } from "@/lib/time";

type TypingTaskRow = {
  claimed_at?: string | null;
  completed_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

function today(value: unknown, now: Date) {
  return (
    typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    isSameGmt3Day(value, now)
  );
}

export function getTypingTaskProgress(
  row: TypingTaskRow | null | undefined,
  now = new Date(),
) {
  const meta = row?.metadata ?? {};
  const attemptedAt = meta.attemptedAt ?? meta.failedAt ?? row?.completed_at;
  const attemptsRemaining = today(attemptedAt, now)
    ? Math.max(0, Math.min(3, Number(meta.attemptsRemaining ?? 3) || 0))
    : 3;
  // Older sync code wrote failedAt even when hearts remained. Those rows are
  // still playable/claimable; only exhausting all hearts starts a failure wait.
  const failedAt =
    attemptsRemaining === 0 && today(meta.failedAt, now)
      ? String(meta.failedAt)
      : null;
  const cooldownUntil =
    getDailyGmt3CooldownUntil(row?.claimed_at, now) ??
    getDailyGmt3CooldownUntil(failedAt, now);
  return {
    attemptsRemaining,
    claimed: Boolean(cooldownUntil),
    completed: !cooldownUntil && today(row?.completed_at, now),
    cooldownUntil,
  };
}

export function buildTypingTaskUpdate(
  existing: TypingTaskRow | null,
  incoming: TypingTaskRow,
  now = new Date(),
) {
  const progress = getTypingTaskProgress(existing, now);
  if (progress.cooldownUntil) throw new Error("Task is still on cooldown.");
  if (incoming.claimed_at)
    throw new Error("Claim the reward using the claim button.");
  if (progress.completed) {
    if (incoming.completed_at) return existing!;
    throw new Error("Your text is complete. Claim your reward.");
  }
  const success = Boolean(incoming.completed_at);
  const attemptsRemaining = success
    ? progress.attemptsRemaining
    : Math.max(0, progress.attemptsRemaining - 1);
  if (!success && incoming.metadata?.attemptsRemaining !== attemptsRemaining) {
    throw new Error(
      "Your remaining hearts changed. Refresh the task and try again.",
    );
  }
  const timestamp = now.toISOString();
  return {
    completed_at: success ? timestamp : null,
    claimed_at: null,
    metadata: {
      attemptsRemaining,
      attemptedAt: timestamp,
      failedAt: attemptsRemaining === 0 ? timestamp : null,
    },
  };
}
