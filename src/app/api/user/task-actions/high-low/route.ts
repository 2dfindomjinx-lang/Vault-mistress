import { profileSelect } from "@/lib/server-game-rules";
import {
  generateHighLowRoundNumbers,
  getActiveEventMultipliers,
  getCooldownUntil,
  getDailyKey,
  getEventCooldownMs,
  getHighLowBetAllowance,
  getHighLowTieFee,
  isHighLowLocked,
  getMetadataNumber,
  getMetadataString,
  HIGH_LOW_BET_ALLOWANCE,
  HIGH_LOW_PROFIT_LIMIT,
  HIGH_LOW_REPLAY_COOLDOWN_MS,
  HIGH_LOW_REVEAL_DELAY_MS,
  randomHighLowNumber,
  type UserTaskActionRow,
} from "@/lib/server-task-actions";
import { getDailyGmt3CooldownUntil, getNextGmt3Reset } from "@/lib/time";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  action?: "seed" | "play";
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

function getRoundNumber(metadata: Record<string, unknown>, key: string) {
  const value = getMetadataNumber(metadata, key, Number.NaN);
  return Number.isInteger(value) ? value : null;
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
  const action = body?.action ?? "play";
  const guess = body?.guess;
  const stake = Math.floor(body?.stake ?? 0);

  if (action === "play" && ((guess !== "higher" && guess !== "lower") || !Number.isInteger(stake) || stake <= 0)) {
    return jsonError("Invalid Higher/Lower payload.");
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

  if (action !== "seed" && cooldownUntil) {
    return jsonError("Higher/Lower is still on cooldown.", 429);
  }

  if (action === "play" && profile.coins < stake) {
    return jsonError("Not enough coins for that stake.", 422);
  }

  const nowMs = Date.now();
  const nextDailyResetAt = getNextGmt3Reset(nowMs).toISOString();
  const legacyDailyDate = getMetadataString(metadata, "higherLowerDailyDate");
  const legacyWindowStartedAt = legacyDailyDate ? existingTask?.claimed_at : null;
  const storedWindowStartedAt =
    getMetadataString(metadata, "higherLowerWindowStartedAt") ?? legacyWindowStartedAt;
  const windowActive = Boolean(getDailyGmt3CooldownUntil(storedWindowStartedAt, nowMs));
  const windowStartedAt = windowActive && storedWindowStartedAt ? storedWindowStartedAt : new Date(nowMs).toISOString();
  const windowResetAt = windowActive
    ? getDailyGmt3CooldownUntil(windowStartedAt, nowMs) ?? nextDailyResetAt
    : nextDailyResetAt;
  const today = getDailyKey();
  const currentDailyProfit = windowActive ? getMetadataNumber(metadata, "higherLowerDailyProfit", 0) : 0;
  const currentDailyWins = windowActive ? getMetadataNumber(metadata, "higherLowerDailyWins", 0) : 0;
  const currentDailyBetTotal = windowActive
    ? getMetadataNumber(
        metadata,
        "higherLowerDailyBetTotal",
        getMetadataNumber(metadata, "higherLowerDailyWinningExposure", 0),
      )
    : 0;
  const currentBetAllowance = getHighLowBetAllowance(currentDailyBetTotal);

  if (action === "play" && currentDailyProfit >= HIGH_LOW_PROFIT_LIMIT) {
    return jsonError(
      `Higher or Lower ${HIGH_LOW_PROFIT_LIMIT.toLocaleString()} coin profit limit reached for this 24-hour window.`,
      422,
    );
  }

  if (action === "play" && stake > currentBetAllowance) {
    return jsonError(
      `Higher or Lower bet allowance is ${currentBetAllowance.toLocaleString()} coins. Lower your stake.`,
      422,
    );
  }

  let currentNumber = getRoundNumber(metadata, "highLowCurrentNumber") ?? getRoundNumber(metadata, "currentNumber");
  let nextNumber = getRoundNumber(metadata, "highLowNextNumber") ?? getRoundNumber(metadata, "nextNumber");
  let roundAvailableAt =
    getMetadataString(metadata, "highLowRoundAvailableAt") ??
    getMetadataString(metadata, "nextBaseRevealAt");

  const shouldSeed = !Number.isInteger(currentNumber) || !Number.isInteger(nextNumber) || !roundAvailableAt;
  if (action === "seed" && !shouldSeed) {
    return Response.json({
      seeded: false,
      task: existingTask,
      taskState: {
        claimed: Boolean(existingTask?.claimed_at),
        completed: Boolean(existingTask?.completed_at),
        currentNumber: currentNumber as number,
        highLowBetAllowance: currentBetAllowance,
        highLowDailyBetTotal: currentDailyBetTotal,
        highLowDailyDate: today,
        highLowDailyLocked: isHighLowLocked(currentDailyBetTotal, currentDailyProfit),
        highLowDailyProfit: currentDailyProfit,
        highLowDailyWins: currentDailyWins,
        highLowNextNumber: nextNumber as number,
        highLowResetAt: windowResetAt,
        highLowRoundAvailableAt: roundAvailableAt,
        nextBaseRevealAt: roundAvailableAt,
      },
    });
  }
  if (shouldSeed) {
    const generated = generateHighLowRoundNumbers();
    currentNumber = generated.currentNumber;
    nextNumber = generated.nextNumber;
    roundAvailableAt = new Date(nowMs).toISOString();

    const seededMetadata = {
      ...metadata,
      highLowCurrentNumber: currentNumber,
      highLowNextNumber: nextNumber,
      highLowRoundAvailableAt: roundAvailableAt,
    };

    const { data: seededTask, error: seedError } = await supabase
      .from("user_tasks")
      .upsert(
        {
          user_id: authData.user.id,
          task_id: "high-low",
          completed_at: existingTask?.completed_at ?? null,
          claimed_at: existingTask?.claimed_at ?? null,
          reward_coins: existingTask?.reward_coins ?? 0,
          metadata: seededMetadata,
        },
        { onConflict: "user_id,task_id" },
      )
      .select("task_id, completed_at, claimed_at, reward_coins, metadata")
      .single();

    if (seedError || !seededTask) {
      console.error("[high-low] seed upsert failed", {
        error: seedError,
        userId: authData.user.id,
        metadata: seededMetadata,
      });
      return jsonError(seedError?.message ?? "Higher/Lower seed failed.", 500);
    }

    return Response.json({
      seeded: true,
      task: seededTask,
      taskState: {
        claimed: Boolean(seededTask.claimed_at),
        completed: Boolean(seededTask.completed_at),
        currentNumber,
        highLowBetAllowance: currentBetAllowance,
        highLowDailyBetTotal: currentDailyBetTotal,
        highLowDailyDate: today,
        highLowDailyLocked: isHighLowLocked(currentDailyBetTotal, currentDailyProfit),
        highLowDailyProfit: currentDailyProfit,
        highLowDailyWins: currentDailyWins,
        highLowNextNumber: nextNumber,
        highLowResetAt: windowResetAt,
        highLowRoundAvailableAt: roundAvailableAt,
        nextBaseRevealAt: roundAvailableAt,
      },
    });
  }

  const activeCurrentNumber = currentNumber as number;
  const resultNumber = randomHighLowNumber(activeCurrentNumber);
  const outcome =
    resultNumber === activeCurrentNumber
      ? "tie"
      : (guess === "higher" && resultNumber > activeCurrentNumber) ||
          (guess === "lower" && resultNumber < activeCurrentNumber)
        ? "win"
        : "loss";
  const winMultiplier = multipliers.high_low_bonus > 1 ? multipliers.high_low_bonus : 2;
  const tieFee = getHighLowTieFee(stake);
  const coinDelta = outcome === "win" ? Math.floor(stake * (winMultiplier - 1)) : outcome === "loss" ? -stake : -tieFee;
  const actualCoinDelta = coinDelta;
  const nextCoins = profile.coins + coinDelta;
  const now = new Date().toISOString();
  const nextDailyProfit = currentDailyProfit + actualCoinDelta;

  if (outcome === "win" && nextDailyProfit > HIGH_LOW_PROFIT_LIMIT) {
    const remainingProfit = Math.max(0, HIGH_LOW_PROFIT_LIMIT - currentDailyProfit);

    return jsonError(
      `Higher or Lower profit room is ${remainingProfit.toLocaleString()} coins. Lower your stake.`,
      422,
    );
  }

  const nextDailyWins = currentDailyWins + (outcome === "win" ? 1 : 0);
  const allowanceCost = stake;
  const nextDailyBetTotal = Math.min(HIGH_LOW_BET_ALLOWANCE, currentDailyBetTotal + allowanceCost);
  const nextBetAllowance = getHighLowBetAllowance(nextDailyBetTotal);
  const nextDailyLocked = nextBetAllowance <= 0 || nextDailyProfit >= HIGH_LOW_PROFIT_LIMIT;
  const nextRound = generateHighLowRoundNumbers();
  const activeNextNumber = nextRound.currentNumber;
  const nextBaseRevealAt = new Date(Date.now() + getEventCooldownMs(HIGH_LOW_REVEAL_DELAY_MS, multipliers.cooldown_reduction)).toISOString();
  const lastResult =
    outcome === "tie"
      ? `${activeCurrentNumber} -> ${resultNumber}. Tie. Play fee ${tieFee} coins kept. Next round is prepared server-side.`
      : `${activeCurrentNumber} -> ${resultNumber}. ${outcome === "win" ? "Won" : "Lost"} ${Math.abs(coinDelta)} coins. Next round is prepared server-side.`;

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
      console.error("[high-low] Supabase error updating profile for coin change", {
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        coinDelta,
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
    baseNumber: activeCurrentNumber,
    higherLowerDailyDate: today,
    higherLowerDailyBetTotal: nextDailyBetTotal,
    higherLowerDailyProfit: nextDailyProfit,
    higherLowerDailyWins: nextDailyWins,
    higherLowerResetAt: windowResetAt,
    higherLowerWindowStartedAt: windowStartedAt,
    higherLowerAllowanceCost: allowanceCost,
    higherLowerBetAllowance: nextBetAllowance,
    highLowCurrentNumber: activeCurrentNumber,
    highLowNextNumber: activeNextNumber,
    highLowRoundAvailableAt: nextBaseRevealAt,
    outcome,
    resultNumber,
    actualCoinDelta,
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
        baseNumber: activeCurrentNumber,
        resultNumber,
        stake,
        outcome,
        actualCoinDelta,
        higherLowerAllowanceCost: allowanceCost,
        higherLowerDailyBetTotal: nextDailyBetTotal,
        higherLowerBetAllowance: nextBetAllowance,
      },
      reason: outcome === "win" ? "game:higher-lower:win" : "game:higher-lower:loss",
      user_id: authData.user.id,
    });

  if (transactionError) {
    console.error("[high-low] Supabase error inserting coin transaction", {
      code: transactionError.code,
      message: transactionError.message,
      details: transactionError.details,
      hint: transactionError.hint,
      userId: authData.user.id,
      outcome,
      actualCoinDelta,
    });
    const { error: rollbackProfileError } = await supabase
      .from("profiles")
      .update({
        coins: profile.coins,
        updated_at: now,
      })
      .eq("id", authData.user.id)
      .eq("coins", nextCoins);

    if (rollbackProfileError) {
      console.error("[high-low] profile rollback failed", rollbackProfileError);
    }

    if (existingTask) {
      const { error: rollbackTaskError } = await supabase
        .from("user_tasks")
        .upsert(
          {
            claimed_at: existingTask.claimed_at,
            completed_at: existingTask.completed_at,
            metadata: existingTask.metadata ?? {},
            reward_coins: existingTask.reward_coins,
            task_id: "high-low",
            user_id: authData.user.id,
          },
          { onConflict: "user_id,task_id" },
        );

      if (rollbackTaskError) {
        console.error("[high-low] task rollback failed", rollbackTaskError);
      }
    } else {
      const { error: rollbackTaskError } = await supabase
        .from("user_tasks")
        .delete()
        .eq("user_id", authData.user.id)
        .eq("task_id", "high-low");

      if (rollbackTaskError) {
        console.error("[high-low] task delete rollback failed", rollbackTaskError);
      }
    }

    return jsonError("Higher/Lower coin logging failed.", 500);
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
      highLowDailyBetTotal: nextDailyBetTotal,
      highLowDailyLocked: nextDailyLocked,
      highLowDailyProfit: nextDailyProfit,
      highLowDailyWins: nextDailyWins,
      highLowBetAllowance: nextBetAllowance,
      highLowResetAt: windowResetAt,
      lastResult,
      nextBaseRevealAt,
      highLowNextNumber: activeNextNumber,
      highLowRoundAvailableAt: nextBaseRevealAt,
      resultBaseNumber: activeCurrentNumber,
      resultCoinDelta: coinDelta,
      resultNumber,
      resultOutcome: outcome,
    },
  });
}
