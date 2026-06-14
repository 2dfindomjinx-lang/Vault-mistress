import { getBaseTaskReward, profileSelect, roundRewardToNearestFive } from "@/lib/server-game-rules";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getGmt3DateKey } from "@/lib/time";

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

function isWithinLast24Hours(value: string | null) {
  if (!value) {
    return false;
  }

  return Date.now() - new Date(value).getTime() < 24 * 60 * 60 * 1000;
}

function getTaskMetadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}

function getStreakCycleKey(streak: number, lastLoyaltyAt: string | null) {
  if (!lastLoyaltyAt || streak <= 0) {
    return null;
  }

  const cycleStart = new Date(lastLoyaltyAt);
  cycleStart.setUTCDate(cycleStart.getUTCDate() - (streak - 1));
  return getGmt3DateKey(cycleStart);
}

function getTaskRewardMultiplier(effect: unknown) {
  if (
    effect &&
    typeof effect === "object" &&
    "type" in effect &&
    "multiplier" in effect &&
    effect.type === "task_reward_multiplier" &&
    typeof effect.multiplier === "number" &&
    Number.isFinite(effect.multiplier)
  ) {
    return effect.multiplier;
  }

  return 1;
}

async function getActiveTaskRewardMultiplier(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("random_events")
    .select("effect")
    .eq("active", true)
    .lte("starts_at", now)
    .gt("ends_at", now)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Task claim active event lookup failed", error);
    return 1;
  }

  return getTaskRewardMultiplier(data?.effect);
}

function validateClaim(taskId: string, profile: ProfileRow, existingTask: UserTaskRow | null) {
  if (taskId === "daily-login") {
    return isWithinLast24Hours(existingTask?.claimed_at ?? null)
      ? "Daily task is still on cooldown."
      : null;
  }

  if (taskId === "typing-accuracy") {
    const failedAt = getTaskMetadataString(existingTask?.metadata, "failedAt");

    if (
      isWithinLast24Hours(existingTask?.claimed_at ?? null) ||
      isWithinLast24Hours(failedAt)
    ) {
      return "Task is still on cooldown.";
    }

    if (!existingTask?.completed_at) {
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

  if (taskId === "affection" && profile.affection < 50 && !existingTask?.completed_at) {
    return "Task is not completed.";
  }

  if (taskId === "affection-80" && profile.affection < 80 && !existingTask?.completed_at) {
    return "Task is not completed.";
  }

  if (existingTask?.claimed_at) {
    return "Task reward was already claimed.";
  }

  if (!existingTask?.completed_at && taskId !== "affection" && taskId !== "affection-80") {
    return "Task is not completed.";
  }

  return null;
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();

  if (authError || !authData.user) {
    return jsonError(authError?.message ?? "Authentication required.", 401);
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const taskId = body?.taskId;

  if (!taskId || typeof taskId !== "string") {
    return jsonError("Invalid task claim payload.");
  }

  const baseReward = getBaseTaskReward(taskId);

  if (typeof baseReward !== "number") {
    return jsonError("Unsupported task reward.", 422);
  }

  const supabase = createSupabaseAdminClient();
  const [profileResult, taskResult, multiplier] = await Promise.all([
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
    getActiveTaskRewardMultiplier(supabase),
  ]);

  if (profileResult.error || !profileResult.data) {
    return jsonError(profileResult.error?.message ?? "Profile not found.", 404);
  }

  if (taskResult.error) {
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
          cycleKey: getStreakCycleKey(profile.loyalty_streak ?? 0, profile.last_loyalty_at),
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

  // Atomic claim using conditional update to prevent parallel requests from both succeeding.
  // We condition the write on the exact state we validated against.
  // This ensures only one request "wins" the claim and the subsequent coin grant.
  let updatedTask: UserTaskRow | null = null;
  let taskUpdateError: { message?: string } | null = null;

  if (existingTask) {
    // Must still match the exact previous claimed_at we checked.
    // Use .is() when previous was null to handle first-claim race for a task row that existed without claimed_at.
    let conditionalUpdate = supabase
      .from("user_tasks")
      .update(claimPayload)
      .eq("user_id", authData.user.id)
      .eq("task_id", taskId);

    if (existingTask.claimed_at) {
      conditionalUpdate = conditionalUpdate.eq("claimed_at", existingTask.claimed_at);
    } else {
      conditionalUpdate = conditionalUpdate.is("claimed_at", null);
    }

    const { data, error } = await conditionalUpdate
      .select("task_id, completed_at, claimed_at, reward_coins, metadata")
      .single();

    updatedTask = data;
    taskUpdateError = error;

    if (!updatedTask || updatedTask.claimed_at !== now) {
      // Lost the race or already claimed in the tiny window
      return jsonError("Task reward already claimed or cooldown active.", 422);
    }
  } else {
    // First time this task row is being claimed for this user.
    // Use insert; on unique conflict (parallel first claim) we treat as already claimed.
    const { data: inserted, error: insErr } = await supabase
      .from("user_tasks")
      .insert(claimPayload)
      .select("task_id, completed_at, claimed_at, reward_coins, metadata")
      .single();

    if (insErr && (insErr.code === "23505" || insErr.message?.toLowerCase().includes("duplicate"))) {
      return jsonError("Task reward already claimed.", 422);
    }

    updatedTask = inserted;
    taskUpdateError = insErr;

    if (!updatedTask || updatedTask.claimed_at !== now) {
      return jsonError("Failed to record task claim.", 500);
    }
  }

  if (taskUpdateError || !updatedTask) {
    return jsonError(taskUpdateError?.message ?? "Task claim failed.", 500);
  }

  const { data: updatedProfile, error: profileUpdateError } = await supabase
    .from("profiles")
    .update({
      coins: nextCoins,
      updated_at: now,
    })
    .eq("id", authData.user.id)
    .select(profileSelect)
    .single();

  if (profileUpdateError || !updatedProfile) {
    // Best effort rollback of the claim we just won
    if (existingTask) {
      const { error: rbErr } = await supabase
        .from("user_tasks")
        .update({
          claimed_at: existingTask.claimed_at,
          completed_at: existingTask.completed_at,
          metadata: existingTask.metadata ?? {},
          reward_coins: existingTask.reward_coins,
        })
        .eq("user_id", authData.user.id)
        .eq("task_id", taskId)
        .eq("claimed_at", now); // only rollback if we still own the 'now' we set
      if (rbErr) console.error("Task claim rollback failed", rbErr);
    } else {
      const { error: rbErr } = await supabase
        .from("user_tasks")
        .delete()
        .eq("user_id", authData.user.id)
        .eq("task_id", taskId);
      if (rbErr) console.error("Task claim rollback delete failed", rbErr);
    }

    return jsonError(profileUpdateError?.message ?? "Profile update failed.", 500);
  }

  const reason = streakBonus ? "streak_bonus" : `reward:task:${taskId}`;
  const transactionMetadata = streakBonus
    ? { milestone: streakBonus.milestone, taskId }
    : {};

  const { error: transactionError } = await supabase.from("coin_transactions").insert({
    amount: rewardCoins,
    balance_after: nextCoins,
    balance_before: profile.coins,
    metadata: transactionMetadata,
    reason,
    user_id: authData.user.id,
  });

  if (transactionError) {
    console.error("Task claim transaction insert failed", transactionError);

    // Rollback coin
    const { error: profileRbErr } = await supabase
      .from("profiles")
      .update({ coins: profile.coins, updated_at: now })
      .eq("id", authData.user.id);
    if (profileRbErr) console.error("Task claim profile rollback failed", profileRbErr);

    // Rollback the claim we set
    if (existingTask) {
      const { error: taskRbErr } = await supabase
        .from("user_tasks")
        .update({
          claimed_at: existingTask.claimed_at,
          completed_at: existingTask.completed_at,
          metadata: existingTask.metadata ?? {},
          reward_coins: existingTask.reward_coins,
        })
        .eq("user_id", authData.user.id)
        .eq("task_id", taskId)
        .eq("claimed_at", now);
      if (taskRbErr) console.error("Task claim task rollback failed", taskRbErr);
    } else {
      const { error: taskRbErr } = await supabase
        .from("user_tasks")
        .delete()
        .eq("user_id", authData.user.id)
        .eq("task_id", taskId);
      if (taskRbErr) console.error("Task claim task delete rollback failed", taskRbErr);
    }

    return jsonError("Task reward logging failed.", 500);
  }

  return Response.json({
    profile: updatedProfile,
    rewardCoins,
    task: updatedTask,
  });
}
