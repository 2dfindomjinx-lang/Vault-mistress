import { roundRewardToNearestFive, profileSelect, TIMEOUT_RISK_DAILY_SAFE_LIMIT } from "@/lib/server-game-rules";
import { awardDevotion, DEVOTION_REWARD_BASIC_TASK } from "@/lib/devotion";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveEventMultipliers } from "@/lib/server-task-actions";
import { getNextGmt3Reset } from "@/lib/time";

const BASE_SAFE_REWARD = 125;
const BASE_TIMEOUT_RISK_CHANCE = 0.2;
const BASE_TIMEOUT_RISK_TIMEOUT_MS = 12 * 60 * 60 * 1000;

type Body = {
  multiplier?: number;
};

type TaskRow = {
  task_id: string;
  completed_at: string | null;
  claimed_at: string | null;
  reward_coins: number | null;
  metadata: Record<string, unknown> | null;
};

type ProfileRow = {
  id: string;
  coins: number;
  timeout_until: string | null;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function getMetadataNumber(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
  fallback = 0,
) {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getMetadataString(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}

export async function POST(request: Request) {
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

  const body = (await request.json().catch(() => null)) as Body | null;
  const rawMultiplier = body?.multiplier;
  const multiplier =
    typeof rawMultiplier === "number" && Number.isInteger(rawMultiplier) ? rawMultiplier : NaN;

  if (!Number.isInteger(multiplier) || multiplier < 1 || multiplier > 3) {
    return jsonError("Timeout risk multiplier must be an integer between 1 and 3.", 422);
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const nextResetAt = getNextGmt3Reset(now).toISOString();

  const [{ data: profile, error: profileError }, { data: taskRow, error: taskError }, eventMultipliers] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, coins, timeout_until")
        .eq("id", authData.user.id)
        .single(),
      supabase
        .from("user_tasks")
        .select("task_id, completed_at, claimed_at, reward_coins, metadata")
        .eq("user_id", authData.user.id)
        .eq("task_id", "timeout-risk")
        .maybeSingle(),
      getActiveEventMultipliers(supabase, ["task_reward_multiplier"]),
    ]);

  if (profileError || !profile) {
    return jsonError(profileError?.message ?? "Profile not found.", 404);
  }

  if (taskError) {
    return jsonError(taskError.message, 500);
  }

  const existingTask = (taskRow as TaskRow | null) ?? null;
  const resetAt = getMetadataString(existingTask?.metadata, "resetAt");
  const dailyWindowActive = Boolean(resetAt && new Date(resetAt).getTime() > now.getTime());
  const currentSafeWins = dailyWindowActive ? getMetadataNumber(existingTask?.metadata, "safeWins", 0) : 0;

  if (currentSafeWins >= TIMEOUT_RISK_DAILY_SAFE_LIMIT) {
    return jsonError("Daily safe reward limit reached for timeout-risk.", 422);
  }

  const currentProfile = profile as ProfileRow;
  const rewardMultiplier = eventMultipliers.task_reward_multiplier ?? 1;
  const rewardCoins = roundRewardToNearestFive(BASE_SAFE_REWARD * rewardMultiplier) * multiplier;
  const timeoutMs = BASE_TIMEOUT_RISK_TIMEOUT_MS * multiplier;
  const hitTimeout = Math.random() < BASE_TIMEOUT_RISK_CHANCE;

  if (hitTimeout) {
    const activeTimeoutUntil =
      currentProfile.timeout_until && new Date(currentProfile.timeout_until).getTime() > now.getTime()
        ? currentProfile.timeout_until
        : null;
    const baseMs = activeTimeoutUntil
      ? Math.max(new Date(activeTimeoutUntil).getTime(), now.getTime())
      : now.getTime();
    const nextTimeoutUntil = new Date(baseMs + timeoutMs).toISOString();

    const { data: updatedProfile, error: timeoutError } = await supabase
      .from("profiles")
      .update({
        timeout_reason: null,
        timeout_until: nextTimeoutUntil,
        updated_at: nowIso,
      })
      .eq("id", authData.user.id)
      .select(profileSelect)
      .single();

    if (timeoutError || !updatedProfile) {
      return jsonError(timeoutError?.message ?? "Timeout update failed.", 500);
    }

    const taskPayload = {
      user_id: authData.user.id,
      task_id: "timeout-risk",
      completed_at: nowIso,
      claimed_at: existingTask?.claimed_at ?? null,
      reward_coins: 0,
      metadata: {
        ...(existingTask?.metadata ?? {}),
        lastResult: `Timeout hit. +${timeoutMs / (60 * 60 * 1000)} hours added.`,
        multiplier,
        resetAt: dailyWindowActive ? resetAt : nextResetAt,
        safeWins: currentSafeWins,
      },
    };

    const taskWrite = existingTask
      ? await supabase
          .from("user_tasks")
          .update(taskPayload)
          .eq("user_id", authData.user.id)
          .eq("task_id", "timeout-risk")
          .select("task_id, completed_at, claimed_at, reward_coins, metadata")
          .single()
      : await supabase
          .from("user_tasks")
          .insert(taskPayload)
          .select("task_id, completed_at, claimed_at, reward_coins, metadata")
          .single();

    if (taskWrite.error || !taskWrite.data) {
      return jsonError(taskWrite.error?.message ?? "Timeout-risk state save failed.", 500);
    }

    return Response.json({
      hitTimeout: true,
      multiplier,
      profile: updatedProfile,
      task: taskWrite.data,
      timeoutUntil: nextTimeoutUntil,
    });
  }

  const nextCoins = currentProfile.coins + rewardCoins;
  const nextSafeWins = currentSafeWins + 1;
  const finalResetAt = dailyWindowActive ? resetAt ?? nextResetAt : nextResetAt;

  const { data: updatedProfile, error: profileUpdateError } = await supabase
    .from("profiles")
    .update({
      coins: nextCoins,
      updated_at: nowIso,
    })
    .eq("id", authData.user.id)
    .eq("coins", currentProfile.coins)
    .select(profileSelect)
    .single();

  if (profileUpdateError || !updatedProfile) {
    return jsonError(profileUpdateError?.message ?? "Profile update failed.", profileUpdateError ? 500 : 409);
  }

  const { error: transactionError } = await supabase.from("coin_transactions").insert({
    amount: rewardCoins,
    balance_after: nextCoins,
    balance_before: currentProfile.coins,
    metadata: {
      multiplier,
      rewardCoins,
      safeWins: nextSafeWins,
      taskId: "timeout-risk",
    },
    reason: "task:timeout-risk",
    user_id: authData.user.id,
  });

  if (transactionError) {
    await supabase
      .from("profiles")
      .update({ coins: currentProfile.coins, updated_at: nowIso })
      .eq("id", authData.user.id)
      .eq("coins", nextCoins);
    return jsonError("Timeout-risk transaction logging failed.", 500);
  }

  const taskPayload = {
    user_id: authData.user.id,
    task_id: "timeout-risk",
    completed_at: nowIso,
    claimed_at: nextSafeWins >= TIMEOUT_RISK_DAILY_SAFE_LIMIT ? nowIso : existingTask?.claimed_at ?? null,
    reward_coins: rewardCoins,
    metadata: {
      ...(existingTask?.metadata ?? {}),
      lastResult: `Safe wins today: ${nextSafeWins}/${TIMEOUT_RISK_DAILY_SAFE_LIMIT}`,
      multiplier,
      resetAt: finalResetAt,
      safeWins: nextSafeWins,
    },
  };

  const taskWrite = existingTask
    ? await supabase
        .from("user_tasks")
        .update(taskPayload)
        .eq("user_id", authData.user.id)
        .eq("task_id", "timeout-risk")
        .select("task_id, completed_at, claimed_at, reward_coins, metadata")
        .single()
    : await supabase
        .from("user_tasks")
        .insert(taskPayload)
        .select("task_id, completed_at, claimed_at, reward_coins, metadata")
        .single();

  if (taskWrite.error || !taskWrite.data) {
    await supabase
      .from("profiles")
      .update({ coins: currentProfile.coins, updated_at: nowIso })
      .eq("id", authData.user.id)
      .eq("coins", nextCoins);
    return jsonError(taskWrite.error?.message ?? "Timeout-risk state save failed.", 500);
  }

  try {
    await awardDevotion(supabase, {
      amount: DEVOTION_REWARD_BASIC_TASK,
      metadata: {
        multiplier,
        rewardCoins,
        safeWins: nextSafeWins,
        taskId: "timeout-risk",
      },
      source: "task_action",
      sourceKey: `timeout-risk:${finalResetAt}:${nextSafeWins}`,
      userId: authData.user.id,
    });
  } catch (devotionError) {
    console.error("[timeout-risk] devotion award failed", {
      devotionError,
      userId: authData.user.id,
    });
  }

  return Response.json({
    hitTimeout: false,
    multiplier,
    profile: updatedProfile,
    rewardCoins,
    task: taskWrite.data,
  });
}
