import { randomUUID } from "node:crypto";
import { COURT_GAME_IDS, COURT_GAME_RULES, isCourtGameId, type CourtGameMetrics } from "@/lib/court-games";
import { awardDevotion, DEVOTION_REWARD_BASIC_TASK } from "@/lib/devotion";
import { profileSelect, roundRewardToNearestFive } from "@/lib/server-game-rules";
import { getActiveEventMultipliers } from "@/lib/server-task-actions";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getDailyGmt3CooldownUntil } from "@/lib/time";

type GameActionBody = {
  action?: "complete" | "start";
  gameId?: string;
  metrics?: CourtGameMetrics;
  sessionId?: string;
};

type GameTaskRow = {
  claimed_at: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown> | null;
  reward_coins: number | null;
  task_id: string;
};

type ProfileRow = {
  coins: number;
  id: string;
};

const ACTIVE_SESSION_MAX_AGE_MS = 30 * 60 * 1000;

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function metadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}

function validateMetrics(gameId: keyof typeof COURT_GAME_RULES, metrics: CourtGameMetrics | undefined) {
  if (
    !metrics ||
    !Number.isInteger(metrics.score) ||
    !Number.isInteger(metrics.roundsCompleted) ||
    !Number.isInteger(metrics.mistakes) ||
    metrics.score < 0 ||
    metrics.roundsCompleted < 0 ||
    metrics.mistakes < 0
  ) {
    return "Invalid game result.";
  }

  const rules = COURT_GAME_RULES[gameId];
  if (metrics.roundsCompleted !== rules.requiredRounds || metrics.score < rules.requiredScore) {
    return "The game was not completed successfully.";
  }

  if (metrics.score > metrics.roundsCompleted || metrics.mistakes > 100) {
    return "Invalid game score.";
  }

  return null;
}

async function getAuthenticatedUser() {
  const authSupabase = await createSupabaseServerClient();
  const { data, error } = await authSupabase.auth.getUser();
  return { error, user: data.user };
}

export async function GET() {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const { error: authError, user } = await getAuthenticatedUser();
  if (authError || !user) {
    return jsonError(authError?.message ?? "Authentication required.", 401);
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_tasks")
    .select("task_id, completed_at, claimed_at, reward_coins, metadata")
    .eq("user_id", user.id)
    .in("task_id", [...COURT_GAME_IDS]);

  if (error) {
    return jsonError(error.message, 500);
  }

  const rows = (data as GameTaskRow[] | null) ?? [];
  return Response.json({
    games: COURT_GAME_IDS.map((gameId) => {
      const row = rows.find((entry) => entry.task_id === gameId);
      return {
        cooldownUntil: getDailyGmt3CooldownUntil(row?.claimed_at ?? null),
        gameId,
        reward: row?.reward_coins ?? COURT_GAME_RULES[gameId].reward,
      };
    }),
  });
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const { error: authError, user } = await getAuthenticatedUser();
  if (authError || !user) {
    return jsonError(authError?.message ?? "Authentication required.", 401);
  }

  const body = (await request.json().catch(() => null)) as GameActionBody | null;
  if (!body || !isCourtGameId(body.gameId) || (body.action !== "start" && body.action !== "complete")) {
    return jsonError("Invalid court game action.");
  }

  const gameId = body.gameId;
  const rules = COURT_GAME_RULES[gameId];
  const supabase = createSupabaseAdminClient();
  const { data: taskData, error: taskReadError } = await supabase
    .from("user_tasks")
    .select("task_id, completed_at, claimed_at, reward_coins, metadata")
    .eq("user_id", user.id)
    .eq("task_id", gameId)
    .maybeSingle();

  if (taskReadError) {
    return jsonError(taskReadError.message, 500);
  }

  const existingTask = (taskData as GameTaskRow | null) ?? null;
  const cooldownUntil = getDailyGmt3CooldownUntil(existingTask?.claimed_at ?? null);
  if (cooldownUntil) {
    return Response.json({ error: "This game is still on cooldown.", cooldownUntil }, { status: 429 });
  }

  if (body.action === "start") {
    const previousSessionId = metadataString(existingTask?.metadata, "sessionId");
    const previousStartedAt = metadataString(existingTask?.metadata, "sessionStartedAt");
    const previousStartedMs = previousStartedAt ? new Date(previousStartedAt).getTime() : 0;
    const hasReusableSession =
      previousSessionId &&
      previousStartedMs > 0 &&
      Date.now() - previousStartedMs < ACTIVE_SESSION_MAX_AGE_MS;

    const sessionId = hasReusableSession ? previousSessionId : randomUUID();
    const sessionStartedAt = hasReusableSession ? previousStartedAt : new Date().toISOString();
    const metadata = {
      ...(existingTask?.metadata ?? {}),
      sessionId,
      sessionStartedAt,
      status: "active",
    };

    const { error: startError } = await supabase.from("user_tasks").upsert(
      {
        claimed_at: null,
        completed_at: null,
        metadata,
        reward_coins: 0,
        task_id: gameId,
        user_id: user.id,
      },
      { onConflict: "user_id,task_id" },
    );

    if (startError) {
      return jsonError(startError.message, 500);
    }

    return Response.json({ gameId, sessionId, sessionStartedAt });
  }

  const metricsError = validateMetrics(gameId, body.metrics);
  if (metricsError) {
    return jsonError(metricsError, 422);
  }

  const storedSessionId = metadataString(existingTask?.metadata, "sessionId");
  const sessionStartedAt = metadataString(existingTask?.metadata, "sessionStartedAt");
  const startedMs = sessionStartedAt ? new Date(sessionStartedAt).getTime() : 0;
  if (!storedSessionId || !body.sessionId || storedSessionId !== body.sessionId || !startedMs) {
    return jsonError("Game session is missing or expired.", 409);
  }

  const elapsedMs = Date.now() - startedMs;
  if (elapsedMs < rules.minDurationMs || elapsedMs > ACTIVE_SESSION_MAX_AGE_MS) {
    return jsonError("Game session timing is invalid.", 409);
  }

  const [profileResult, multipliers] = await Promise.all([
    supabase.from("profiles").select("id, coins").eq("id", user.id).single(),
    getActiveEventMultipliers(supabase, ["task_reward_multiplier"]),
  ]);

  if (profileResult.error || !profileResult.data) {
    return jsonError(profileResult.error?.message ?? "Profile not found.", 404);
  }

  const profile = profileResult.data as ProfileRow;
  const rewardCoins = roundRewardToNearestFive(rules.reward * (multipliers.task_reward_multiplier ?? 1));
  const nextCoins = profile.coins + rewardCoins;
  const now = new Date().toISOString();
  const { data: updatedProfile, error: profileError } = await supabase
    .from("profiles")
    .update({ coins: nextCoins, updated_at: now })
    .eq("id", user.id)
    .eq("coins", profile.coins)
    .select(profileSelect)
    .maybeSingle();

  if (profileError || !updatedProfile) {
    return jsonError(profileError?.message ?? "Game reward was already claimed.", 409);
  }

  const { data: transaction, error: transactionError } = await supabase
    .from("coin_transactions")
    .insert({
      amount: rewardCoins,
      balance_after: nextCoins,
      balance_before: profile.coins,
      metadata: { elapsedMs, gameId, metrics: body.metrics },
      reason: `reward:game:${gameId}`,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (transactionError || !transaction) {
    await supabase.from("profiles").update({ coins: profile.coins, updated_at: now }).eq("id", user.id).eq("coins", nextCoins);
    return jsonError("Game reward could not be recorded.", 500);
  }

  const { data: updatedTask, error: taskError } = await supabase
    .from("user_tasks")
    .update({
      claimed_at: now,
      completed_at: now,
      metadata: {
        ...(existingTask?.metadata ?? {}),
        completedAt: now,
        elapsedMs,
        metrics: body.metrics,
        status: "completed",
      },
      reward_coins: rewardCoins,
    })
    .eq("user_id", user.id)
    .eq("task_id", gameId)
    .contains("metadata", { sessionId: storedSessionId })
    .select("task_id, completed_at, claimed_at, reward_coins, metadata")
    .maybeSingle();

  if (taskError || !updatedTask) {
    await supabase.from("coin_transactions").delete().eq("id", transaction.id);
    await supabase.from("profiles").update({ coins: profile.coins, updated_at: now }).eq("id", user.id).eq("coins", nextCoins);
    return jsonError(taskError?.message ?? "Game completion could not be saved.", 409);
  }

  try {
    await awardDevotion(supabase, {
      amount: DEVOTION_REWARD_BASIC_TASK,
      metadata: { gameId, rewardCoins },
      source: "task_action",
      sourceKey: `court-game:${gameId}:${now}`,
      userId: user.id,
    });
  } catch (error) {
    console.error("[court-games] devotion award failed", { error, gameId, userId: user.id });
  }

  return Response.json({
    cooldownUntil: getDailyGmt3CooldownUntil(now),
    gameId,
    profile: updatedProfile,
    rewardCoins,
    task: updatedTask,
  });
}
