import { commitEconomyAction } from "@/lib/economy-command";
import {
  getBaseTaskReward,
  roundRewardToNearestFive,
} from "@/lib/server-game-rules";
import { DEVOTION_REWARD_BASIC_TASK } from "@/lib/devotion";
import { getActiveEventMultipliers } from "@/lib/server-task-actions";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getDailyGmt3CooldownUntil, getGmt3DateKey } from "@/lib/time";
import { GENERIC_CLAIM_TASK_IDS } from "@/lib/economy-rules";
import { getTypingTaskProgress } from "@/lib/typing-task";

type Body = {
  taskId?: string;
};

type ProfileRow = {
  id: string;
  affection: number;
  coins: number;
  last_loyalty_at: string | null;
  loyalty_streak: number | null;
};

type UserTaskRow = {
  claimed_at: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown> | null;
  reward_coins: number | null;
  task_id: string;
};

const STREAK_BONUSES = [
  { id: "streak-bonus-1", milestone: 1 },
  { id: "streak-bonus-3", milestone: 3 },
  { id: "streak-bonus-7", milestone: 7 },
  { id: "streak-bonus-15", milestone: 15 },
  { id: "streak-bonus-30", milestone: 30 },
];

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}



function getStreakCycleKey(streak: number, lastLoyaltyAt: string | null) {
  if (!lastLoyaltyAt || streak <= 0) {
    return null;
  }

  const cycleStart = new Date(lastLoyaltyAt);
  cycleStart.setUTCDate(cycleStart.getUTCDate() - (streak - 1));
  return getGmt3DateKey(cycleStart);
}

function validateClaim(
  taskId: string,
  profile: ProfileRow,
  existingTask: UserTaskRow | null,
) {
  if (taskId === "daily-login") {
    return getDailyGmt3CooldownUntil(existingTask?.claimed_at ?? null)
      ? "Daily task is still on cooldown."
      : null;
  }

  if (taskId === "typing-accuracy") {
    const progress = getTypingTaskProgress(existingTask);
    if (progress.cooldownUntil) {
      return "Task is still on cooldown.";
    }

    if (!progress.completed) {
      return "Task is not completed.";
    }

    return null;
  }

  const streakBonus = STREAK_BONUSES.find((bonus) => bonus.id === taskId);

  if (streakBonus) {
    const loyaltyStreak = profile.loyalty_streak ?? 0;

    if (loyaltyStreak < streakBonus.milestone) {
      return "Streak milestone is not reached.";
    }

    if (existingTask?.claimed_at) {
      return "Streak bonus already claimed.";
    }

    return null;
  }

  if (taskId === "affection" && profile.affection < 50) {
    return "Task is not completed.";
  }

  if (taskId === "affection-80" && profile.affection < 80) {
    return "Task is not completed.";
  }

  if (existingTask?.claimed_at) {
    return "Task reward was already claimed.";
  }

  if (
    !existingTask?.completed_at &&
    taskId !== "affection" &&
    taskId !== "affection-80"
  ) {
    return "Task is not completed.";
  }

  return null;
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return jsonError(
      `Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`,
      500,
    );
  }

  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } =
    await authSupabase.auth.getUser();

  if (authError || !authData.user) {
    return jsonError(authError?.message ?? "Authentication required.", 401);
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const taskId = body?.taskId;

  if (!taskId || typeof taskId !== "string") {
    return jsonError("Invalid task claim payload.");
  }

  const baseReward = getBaseTaskReward(taskId);

  if (!GENERIC_CLAIM_TASK_IDS.has(taskId)) {
    return jsonError("This game must use its own action endpoint.", 409);
  }

  if (typeof baseReward !== "number") {
    return jsonError("Unsupported task reward.", 422);
  }

  const supabase = createSupabaseAdminClient();
  const [profileResult, taskResult, eventMultipliers] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, coins, affection, loyalty_streak, last_loyalty_at")
      .eq("id", authData.user.id)
      .single(),
    supabase
      .from("user_tasks")
      .select("task_id, completed_at, claimed_at, reward_coins, metadata")
      .eq("user_id", authData.user.id)
      .eq("task_id", taskId)
      .maybeSingle(),
    getActiveEventMultipliers(supabase, ["task_reward_multiplier"]),
  ]);
  const multiplier = eventMultipliers.task_reward_multiplier ?? 1;

  if (profileResult.error || !profileResult.data) {
    console.error("[task-claim] Supabase error reading profile", {
      code: profileResult.error?.code,
      message: profileResult.error?.message,
      details: profileResult.error?.details,
      hint: profileResult.error?.hint,
      taskId,
      userId: authData.user.id,
    });
    return jsonError(profileResult.error?.message ?? "Profile not found.", 404);
  }

  if (taskResult.error) {
    console.error("[task-claim] Supabase error reading task", {
      code: taskResult.error.code,
      message: taskResult.error.message,
      details: taskResult.error.details,
      hint: taskResult.error.hint,
      taskId,
      userId: authData.user.id,
    });
    return jsonError(taskResult.error.message, 500);
  }

  const profile = profileResult.data as ProfileRow;
  const existingTask = (taskResult.data as UserTaskRow | null) ?? null;
  const validationError = validateClaim(taskId, profile, existingTask);

  if (validationError) {
    return jsonError(validationError, 422);
  }

  const now = new Date().toISOString();
  const streakBonus = STREAK_BONUSES.find((bonus) => bonus.id === taskId);
  const rewardCoins = roundRewardToNearestFive(baseReward * multiplier);
  const nextCoins = profile.coins + rewardCoins;

  const metadata = {
    ...(existingTask?.metadata ?? {}),
    attemptsRemaining: taskId === "typing-accuracy" ? 3 : undefined,
    ...(streakBonus
      ? {
          cycleKey: getStreakCycleKey(
            profile.loyalty_streak ?? 0,
            profile.last_loyalty_at,
          ),
          milestone: streakBonus.milestone,
        }
      : {}),
  };

  const claimPayload = {
    user_id: authData.user.id,
    task_id: taskId,
    completed_at: existingTask?.completed_at ?? now,
    claimed_at: now, // Server always sets this from trusted now()
    reward_coins: rewardCoins,
    metadata,
  };

  const reason = streakBonus ? "streak_bonus" : `reward:task:${taskId}`;
  const transactionMetadata = streakBonus
    ? { milestone: streakBonus.milestone, taskId }
    : {};

  const result = await commitEconomyAction(supabase, {
    userId: authData.user.id,
    operationKey: [
      "task",
      taskId,
      taskId === "daily-login" || taskId === "typing-accuracy"
        ? getGmt3DateKey(now)
        : streakBonus
          ? getStreakCycleKey(
              profile.loyalty_streak ?? 0,
              profile.last_loyalty_at,
            )
          : "once",
    ].join(":"),
    expectedProfile: {
      coins: profile.coins,
      affection: profile.affection,
      loyalty_streak: profile.loyalty_streak,
      last_loyalty_at: profile.last_loyalty_at,
    },
    patch: { coins: nextCoins },
    taskId,
    expectedTask: existingTask,
    taskPatch: claimPayload,
    reason,
    metadata: transactionMetadata,
    devotion: DEVOTION_REWARD_BASIC_TASK,
  });
  if ("error" in result) return jsonError(result.error, result.status);
  const updatedProfile = result.profile;
  const updatedTask = result.task;

  return Response.json({
    profile: updatedProfile,
    rewardCoins,
    task: updatedTask,
  });
}
