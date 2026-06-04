import { profileSelect } from "@/lib/server-game-rules";
import {
  getActiveEventMultipliers,
  getCooldownUntil,
  getDailyKey,
  getEventCooldownMs,
  getHighLowWinningAllowance,
  getMetadataNumber,
  getMetadataString,
  HIGH_LOW_PROFIT_LOCK,
  HIGH_LOW_WINNING_ALLOWANCE,
  isHighLowLocked,
  randomHighLowNumber,
  type UserTaskActionRow,
} from "@/lib/server-task-actions";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  currentNumber?: number;
  guess?: "higher" | "lower";
  stake?: number;
};

type ProfileRow = {
  affection: number;
  coins: number;
  id: string;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
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
  const guess = body?.guess;
  const stake = Math.floor(body?.stake ?? 0);
  const currentNumber = body?.currentNumber;

  if ((guess !== "higher" && guess !== "lower") || !Number.isInteger(stake) || stake <= 0) {
    return jsonError("Invalid Higher/Lower payload.");
  }

  if (typeof currentNumber !== "number" || !Number.isInteger(currentNumber) || currentNumber < 2 || currentNumber > 9) {
    return jsonError("Invalid Higher/Lower base number.", 422);
  }

  const supabase = createSupabaseAdminClient();
  const [profileResult, taskResult, multipliers] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, coins, affection")
      .eq("id", authData.user.id)
      .single(),
    supabase
      .from("user_tasks")
      .select("task_id, completed_at, claimed_at, reward_coins, metadata")
      .eq("user_id", authData.user.id)
      .eq("task_id", "high-low")
      .maybeSingle(),
    getActiveEventMultipliers(supabase, ["cooldown_reduction", "high_low_bonus"]),
  ]);

  if (profileResult.error || !profileResult.data) {
    console.error("[high-low] profile read failed", {
      error: profileResult.error,
      userId: authData.user.id,
    });
    return jsonError(profileResult.error?.message ?? "Profile not found.", 404);
  }

  if (taskResult.error) {
    console.error("[high-low] task read failed", {
      error: taskResult.error,
      userId: authData.user.id,
    });
    return jsonError(taskResult.error.message, 500);
  }

  const profile = profileResult.data as ProfileRow;
  const existingTask = (taskResult.data as UserTaskActionRow | null) ?? null;
  const metadata = existingTask?.metadata ?? {};
  const cooldownMs = getEventCooldownMs(15 * 1000, multipliers.cooldown_reduction);
  const cooldownUntil = getCooldownUntil(existingTask?.claimed_at, cooldownMs);

  if (cooldownUntil) {
    return jsonError("Higher/Lower is still on cooldown.", 429);
  }

  if (profile.coins < stake) {
    return jsonError("Not enough coins for that stake.", 422);
  }

  const today = getDailyKey();
  const dailyDate = getMetadataString(metadata, "higherLowerDailyDate");
  const currentDailyProfit =
    dailyDate === today
      ? getMetadataNumber(metadata, "higherLowerDailyProfit", getMetadataNumber(metadata, "higherLowerDailyWinnings", 0))
      : 0;
  const currentDailyWins =
    dailyDate === today ? getMetadataNumber(metadata, "higherLowerDailyWins", 0) : 0;
  const currentWinningExposure =
    dailyDate === today
      ? getMetadataNumber(
          metadata,
          "higherLowerDailyWinningExposure",
          Math.min(HIGH_LOW_WINNING_ALLOWANCE, Math.max(0, currentDailyProfit)),
        )
      : 0;
  const currentWinningAllowance = getHighLowWinningAllowance(currentWinningExposure);

  if (isHighLowLocked(currentDailyProfit)) {
    return jsonError(`Higher or Lower ${HIGH_LOW_PROFIT_LOCK.toLocaleString()} net profit limit reached for today.`, 422);
  }

  if (stake > currentWinningAllowance) {
    return jsonError(
      `Higher or Lower winning allowance is ${currentWinningAllowance.toLocaleString()} coins. Lower your stake.`,
      422,
    );
  }

  const resultNumber = randomHighLowNumber();
  const outcome =
    resultNumber === currentNumber
      ? "tie"
      : (guess === "higher" && resultNumber > currentNumber) ||
          (guess === "lower" && resultNumber < currentNumber)
        ? "win"
        : "loss";
  const winMultiplier = multipliers.high_low_bonus > 1 ? multipliers.high_low_bonus : 2;
  const coinDelta = outcome === "win" ? stake * (winMultiplier - 1) : outcome === "loss" ? -stake : 0;
  const nextCoins = profile.coins + coinDelta;
  const now = new Date().toISOString();
  const nextDailyProfit = currentDailyProfit + coinDelta;
  const nextDailyWins = currentDailyWins + (outcome === "win" ? 1 : 0);
  const nextWinningExposure = Math.max(
    0,
    Math.min(
      HIGH_LOW_WINNING_ALLOWANCE,
      currentWinningExposure + (outcome === "win" ? stake : outcome === "loss" ? -stake : 0),
    ),
  );
  const nextWinningAllowance = getHighLowWinningAllowance(nextWinningExposure);
  const nextDailyLocked = isHighLowLocked(nextDailyProfit);
  const nextBaseRevealAt = new Date(Date.now() + getEventCooldownMs(10 * 1000, multipliers.cooldown_reduction)).toISOString();
  const lastResult =
    outcome === "tie"
      ? `${currentNumber} -> ${resultNumber}. Tie. Stake refunded. New number appears in 10 seconds.`
      : `${currentNumber} -> ${resultNumber}. ${outcome === "win" ? "Won" : "Lost"} ${Math.abs(coinDelta)} coins. New number appears soon.`;

  let updatedProfile = profileResult.data;

  if (coinDelta !== 0) {
    const { data, error } = await supabase
      .from("profiles")
      .update({
        coins: nextCoins,
        updated_at: now,
      })
      .eq("id", authData.user.id)
      .eq("coins", profile.coins)
      .select(profileSelect)
      .maybeSingle();

    if (error || !data) {
      console.error("[high-low] profile coin update failed", {
        coinDelta,
        error,
        nextCoins,
        previousCoins: profile.coins,
        userId: authData.user.id,
      });
      return jsonError(error?.message ?? "Higher/Lower duplicate or stale balance rejected.", 409);
    }

    updatedProfile = data;
  } else {
    const { data, error } = await supabase
      .from("profiles")
      .select(profileSelect)
      .eq("id", authData.user.id)
      .single();

    if (error || !data) {
      console.error("[high-low] profile refresh failed", {
        error,
        userId: authData.user.id,
      });
      return jsonError(error?.message ?? "Profile refresh failed.", 500);
    }

    updatedProfile = data;
  }

  const nextMetadata = {
    ...metadata,
    baseNumber: currentNumber,
    higherLowerDailyDate: today,
    higherLowerDailyProfit: nextDailyProfit,
    higherLowerDailyWins: nextDailyWins,
    higherLowerDailyWinningExposure: nextWinningExposure,
    higherLowerWinningAllowance: nextWinningAllowance,
    outcome,
    resultNumber,
    stake,
  };
  const { data: updatedTask, error: taskError } = await supabase
    .from("user_tasks")
    .upsert(
      {
        user_id: authData.user.id,
        task_id: "high-low",
        completed_at: now,
        claimed_at: now,
        reward_coins: coinDelta,
        metadata: nextMetadata,
      },
      { onConflict: "user_id,task_id" },
    )
    .select("task_id, completed_at, claimed_at, reward_coins, metadata")
    .single();

  if (taskError || !updatedTask) {
    console.error("[high-low] user_tasks upsert failed", {
      coinDelta,
      error: taskError,
      nextMetadata,
      userId: authData.user.id,
    });
    return jsonError(taskError?.message ?? "Higher/Lower task update failed.", 500);
  }

  if (coinDelta !== 0) {
    const { error: transactionError } = await supabase.from("coin_transactions").insert({
      amount: coinDelta,
      balance_after: nextCoins,
      balance_before: profile.coins,
      metadata: {
        baseNumber: currentNumber,
        resultNumber,
        stake,
        outcome,
        higherLowerDailyWinningExposure: nextWinningExposure,
        higherLowerWinningAllowance: nextWinningAllowance,
      },
      reason: outcome === "win" ? "game:higher-lower:win" : "game:higher-lower:loss",
      user_id: authData.user.id,
    });

    if (transactionError) {
      console.error("Higher/Lower transaction insert failed", transactionError);
    }
  }

  return Response.json({
    profile: updatedProfile,
    task: updatedTask,
    taskState: {
      claimed: false,
      completed: true,
      cooldownUntil: getCooldownUntil(now, cooldownMs),
      currentNumber,
      highLowDailyDate: today,
      highLowDailyLocked: nextDailyLocked,
      highLowDailyProfit: nextDailyProfit,
      highLowDailyWins: nextDailyWins,
      highLowWinningAllowance: nextWinningAllowance,
      highLowWinningExposure: nextWinningExposure,
      lastResult,
      nextBaseRevealAt,
      resultBaseNumber: currentNumber,
      resultCoinDelta: coinDelta,
      resultNumber,
      resultOutcome: outcome,
    },
  });
}
