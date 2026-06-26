import { profileSelect } from "@/lib/server-game-rules";
import { awardDevotion, DEVOTION_REWARD_BASIC_TASK } from "@/lib/devotion";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getGmt3DateKey } from "@/lib/time";

const STREAK_BONUSES = [
  { id: "streak-bonus-1", milestone: 1, reward: 50 },
  { id: "streak-bonus-3", milestone: 3, reward: 125 },
  { id: "streak-bonus-7", milestone: 7, reward: 250 },
  { id: "streak-bonus-15", milestone: 15, reward: 500 },
  { id: "streak-bonus-30", milestone: 30, reward: 1000 },
] as const;
const STREAK_EXPIRY_MS = 48 * 60 * 60 * 1000;

type ProfileRow = {
  coins: number;
  id: string;
  last_loyalty_at: string | null;
  loyalty_streak: number | null;
};

type UserTaskRow = {
  task_id: string;
  completed_at: string | null;
  claimed_at: string | null;
  reward_coins: number | null;
  metadata: Record<string, unknown> | null;
};

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

function getEffectiveLoyaltyStreak(streak: number | null | undefined, lastLoyaltyAt: string | null) {
  if (!lastLoyaltyAt) {
    return 0;
  }

  const lastLoyaltyMs = new Date(lastLoyaltyAt).getTime();
  if (!Number.isFinite(lastLoyaltyMs)) {
    return 0;
  }

  return Date.now() - lastLoyaltyMs > STREAK_EXPIRY_MS ? 0 : Math.max(0, streak ?? 0);
}

export async function POST() {
  if (!isSupabaseAdminConfigured) {
    return jsonError(
      `Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`,
      500,
    );
  }

  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();

  if (authError || !authData.user) {
    return jsonError(authError?.message ?? "Authentication required.", 401);
  }

  const supabase = createSupabaseAdminClient();
  const [profileResult, taskResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, coins, loyalty_streak, last_loyalty_at")
      .eq("id", authData.user.id)
      .single(),
    supabase
      .from("user_tasks")
      .select("task_id, completed_at, claimed_at, reward_coins, metadata")
      .eq("user_id", authData.user.id)
      .in(
        "task_id",
        STREAK_BONUSES.map((entry) => entry.id),
      ),
  ]);

  if (profileResult.error || !profileResult.data) {
    return jsonError(profileResult.error?.message ?? "Profile not found.", 404);
  }

  if (taskResult.error) {
    return jsonError(taskResult.error.message, 500);
  }

  const profile = profileResult.data as ProfileRow;
  const existingTasks = (taskResult.data as UserTaskRow[] | null) ?? [];
  const loyaltyStreak = getEffectiveLoyaltyStreak(profile.loyalty_streak ?? 0, profile.last_loyalty_at);
  const cycleKey = getStreakCycleKey(loyaltyStreak, profile.last_loyalty_at);
  const claimable = STREAK_BONUSES.filter((bonus) => {
    if (loyaltyStreak < bonus.milestone) {
      return false;
    }

    const existing = existingTasks.find((task) => task.task_id === bonus.id);
    return !existing?.claimed_at;
  });

  if (claimable.length === 0) {
    return jsonError("No loyalty rewards available to claim.", 422);
  }

  const totalReward = claimable.reduce((sum, bonus) => sum + bonus.reward, 0);
  const nextCoins = profile.coins + totalReward;
  const now = new Date().toISOString();

  const { data: updatedProfile, error: profileUpdateError } = await supabase
    .from("profiles")
    .update({
      coins: nextCoins,
      updated_at: now,
    })
    .eq("id", authData.user.id)
    .eq("coins", profile.coins)
    .select(profileSelect)
    .single();

  if (profileUpdateError || !updatedProfile) {
    return jsonError(profileUpdateError?.message ?? "Loyalty claim collided with another update.", 409);
  }

  const txRows = claimable.map((bonus, index) => {
    const balanceBefore = profile.coins + claimable.slice(0, index).reduce((sum, entry) => sum + entry.reward, 0);
    const balanceAfter = balanceBefore + bonus.reward;

    return {
      amount: bonus.reward,
      balance_after: balanceAfter,
      balance_before: balanceBefore,
      metadata: {
        cycleKey,
        milestone: bonus.milestone,
        taskId: bonus.id,
      },
      reason: "streak_bonus",
      user_id: authData.user.id,
    };
  });

  const { error: transactionError } = await supabase.from("coin_transactions").insert(txRows);

  if (transactionError) {
    await supabase
      .from("profiles")
      .update({ coins: profile.coins, updated_at: now })
      .eq("id", authData.user.id)
      .eq("coins", nextCoins);
    return jsonError("Loyalty claim logging failed.", 500);
  }

  const taskRows = claimable.map((bonus) => ({
    user_id: authData.user.id,
    task_id: bonus.id,
    completed_at: now,
    claimed_at: now,
    reward_coins: bonus.reward,
    metadata: {
      cycleKey,
      milestone: bonus.milestone,
    },
  }));

  const { error: upsertError } = await supabase.from("user_tasks").upsert(taskRows, {
    onConflict: "user_id,task_id",
  });

  if (upsertError) {
    await supabase
      .from("profiles")
      .update({ coins: profile.coins, updated_at: now })
      .eq("id", authData.user.id)
      .eq("coins", nextCoins);
    return jsonError("Loyalty reward state failed to save.", 500);
  }

  try {
    await awardDevotion(supabase, {
      amount: claimable.length * DEVOTION_REWARD_BASIC_TASK,
      metadata: {
        cycleKey,
        taskIds: claimable.map((bonus) => bonus.id),
      },
      source: "loyalty_claim",
      sourceKey: `loyalty-claim:${cycleKey ?? now}:${claimable.map((bonus) => bonus.id).join(",")}`,
      userId: authData.user.id,
    });
  } catch (devotionError) {
    console.error("[loyalty-claim] devotion award failed", {
      devotionError,
      userId: authData.user.id,
    });
  }

  return Response.json({
    claimedBonuses: claimable,
    profile: updatedProfile,
    totalReward,
  });
}
