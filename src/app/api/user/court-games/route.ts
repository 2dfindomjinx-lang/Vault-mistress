import { commitEconomyAction } from "@/lib/economy-command";
import { verifyCourtActions } from "@/lib/court-game-challenges";
import { randomInt, randomUUID } from "node:crypto";
import {
  COURT_GAME_IDS,
  COURT_GAME_RULES,
  isCourtGameId,
  type CourtGameMetrics,
} from "@/lib/court-games";
import { DEVOTION_REWARD_BASIC_TASK } from "@/lib/devotion";
import {
  profileSelect,
  roundRewardToNearestFive,
} from "@/lib/server-game-rules";
import { getActiveEventMultipliers } from "@/lib/server-task-actions";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getDailyGmt3CooldownUntil } from "@/lib/time";

type GameActionBody = {
  action?: "complete" | "fail" | "start";
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

function metadataString(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}

function validateMetrics(
  gameId: keyof typeof COURT_GAME_RULES,
  metrics: CourtGameMetrics | undefined,
) {
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
  if (
    metrics.roundsCompleted !== rules.requiredRounds ||
    metrics.score < rules.requiredScore
  ) {
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
    return jsonError(
      `Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`,
      500,
    );
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
    return jsonError(
      `Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`,
      500,
    );
  }

  const { error: authError, user } = await getAuthenticatedUser();
  if (authError || !user) {
    return jsonError(authError?.message ?? "Authentication required.", 401);
  }

  const body = (await request
    .json()
    .catch(() => null)) as GameActionBody | null;
  if (
    !body ||
    !isCourtGameId(body.gameId) ||
    !["complete", "fail", "start"].includes(body.action ?? "")
  ) {
    return jsonError("Invalid court game action.");
  }

  const gameId = body.gameId;
  const rules = COURT_GAME_RULES[gameId];
  const supabase = createSupabaseAdminClient();

  // The reward side is gated by the daily cooldown, but bare "start" calls
  // used to write an upsert with no limit at all.
  const rateLimit = await checkRateLimit(
    supabase,
    `court-games:${user.id}`,
    30,
    60,
  );
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfterSeconds);
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
  if (
    body.action === "complete" &&
    body.sessionId &&
    body.sessionId === metadataString(existingTask?.metadata, "sessionId") &&
    existingTask?.metadata?.status === "completed"
  ) {
    const receipt = await supabase
      .from("economy_receipts")
      .select("amount")
      .eq("user_id", user.id)
      .eq("operation_key", "court-game:" + gameId + ":" + body.sessionId)
      .maybeSingle();
    if (receipt.error)
      return jsonError("Reward history is temporarily unavailable.", 503);
    if (receipt.data) {
      const profile = await supabase
        .from("profiles")
        .select(profileSelect)
        .eq("id", user.id)
        .single();
      if (profile.error)
        return jsonError("Refresh to see your completed reward.", 503);
      return Response.json({
        gameId,
        profile: profile.data,
        task: existingTask,
        rewardCoins: receipt.data.amount,
        duplicate: true,
        cooldownUntil: getDailyGmt3CooldownUntil(existingTask.claimed_at),
      });
    }
  }
  const cooldownUntil = getDailyGmt3CooldownUntil(
    existingTask?.claimed_at ?? null,
  );
  if (cooldownUntil) {
    return Response.json(
      { error: "This game is still on cooldown.", cooldownUntil },
      { status: 429 },
    );
  }

  if (body.action === "start") {
    const previousSessionId = metadataString(
      existingTask?.metadata,
      "sessionId",
    );
    const previousStartedAt = metadataString(
      existingTask?.metadata,
      "sessionStartedAt",
    );
    const previousStartedMs = previousStartedAt
      ? new Date(previousStartedAt).getTime()
      : 0;
    const hasReusableSession =
      previousSessionId &&
      previousStartedMs > 0 &&
      Date.now() - previousStartedMs < ACTIVE_SESSION_MAX_AGE_MS;

    // ONE ATTEMPT PER DAY, and abandoning is not a loophole. A session started
    // earlier today that can no longer be resumed is a consumed attempt -
    // otherwise "close the tab before the last round" turns every game into
    // retry-until-perfect, which is exactly what the daily design forbids.
    const sessionStartedToday = getDailyGmt3CooldownUntil(previousStartedAt);
    if (!hasReusableSession && sessionStartedToday) {
      return Response.json(
        {
          cooldownUntil: sessionStartedToday,
          error: "You had your attempt today. Return tomorrow.",
        },
        { status: 429 },
      );
    }

    const sessionId = hasReusableSession ? previousSessionId : randomUUID();
    const sessionStartedAt = hasReusableSession
      ? previousStartedAt
      : new Date().toISOString();
    const challengeSeed =
      hasReusableSession &&
      Number.isInteger(existingTask?.metadata?.challengeSeed)
        ? Number(existingTask?.metadata?.challengeSeed)
        : randomInt(0, 4294967296);
    const metadata = {
      challengeSeed,
      ...(existingTask?.metadata ?? {}),
      sessionId,
      sessionStartedAt,
      status: "active",
    };

    const result = await commitEconomyAction(supabase, {
      userId: user.id,
      operationKey: "court-start:" + gameId + ":" + sessionId,
      reason: "game:start",
      expectedProfile: {},
      patch: {},
      taskId: gameId,
      expectedTask: existingTask,
      taskPatch: {
        task_id: gameId,
        claimed_at: null,
        completed_at: null,
        metadata,
        reward_coins: 0,
      },
    });
    if ("error" in result) return jsonError(result.error, result.status);
    return Response.json({
      gameId,
      sessionId,
      sessionStartedAt,
      challengeSeed,
    });
  }

  // A reported failure consumes the day. The honest client calls this the
  // moment a run dies; the same-day session block above backstops anyone who
  // simply refuses to report.
  if (body.action === "fail") {
    const failSessionId = metadataString(existingTask?.metadata, "sessionId");
    if (!failSessionId || !body.sessionId || failSessionId !== body.sessionId) {
      return jsonError("Game session is missing or expired.", 409);
    }
    const now = new Date().toISOString();
    const result = await commitEconomyAction(supabase, {
      userId: user.id,
      operationKey: "court-fail:" + gameId + ":" + failSessionId,
      reason: "game:fail",
      expectedProfile: {},
      patch: {},
      taskId: gameId,
      expectedTask: existingTask,
      taskPatch: {
        task_id: gameId,
        claimed_at: now,
        completed_at: null,
        reward_coins: 0,
        metadata: {
          ...(existingTask?.metadata ?? {}),
          failedAt: now,
          status: "failed",
        },
      },
    });
    if ("error" in result) return jsonError(result.error, result.status);
    return Response.json({
      cooldownUntil: getDailyGmt3CooldownUntil(now),
      failed: true,
      gameId,
    });
  }

  const metricsError = validateMetrics(gameId, body.metrics);
  if (metricsError) {
    return jsonError(metricsError, 422);
  }

  const storedSessionId = metadataString(existingTask?.metadata, "sessionId");
  const sessionStartedAt = metadataString(
    existingTask?.metadata,
    "sessionStartedAt",
  );
  const startedMs = sessionStartedAt ? new Date(sessionStartedAt).getTime() : 0;
  if (
    !storedSessionId ||
    !body.sessionId ||
    storedSessionId !== body.sessionId ||
    !startedMs
  ) {
    return jsonError("Game session is missing or expired.", 409);
  }

  const elapsedMs = Date.now() - startedMs;
  if (
    elapsedMs < rules.minDurationMs ||
    elapsedMs > ACTIVE_SESSION_MAX_AGE_MS
  ) {
    return jsonError("Game session timing is invalid.", 409);
  }

  const seed = existingTask?.metadata?.challengeSeed;
  const verified =
    typeof seed === "number"
      ? verifyCourtActions(gameId, seed, body.metrics?.actions, elapsedMs)
      : null;
  if (!verified || validateMetrics(gameId, verified))
    return jsonError(
      "Your game result could not be verified. Reopen the game and try again.",
      422,
    );
  body.metrics = verified;

  const [profileResult, multipliers] = await Promise.all([
    supabase.from("profiles").select("id, coins").eq("id", user.id).single(),
    getActiveEventMultipliers(supabase, ["task_reward_multiplier"]),
  ]);

  if (profileResult.error || !profileResult.data) {
    return jsonError(profileResult.error?.message ?? "Profile not found.", 404);
  }

  const profile = profileResult.data as ProfileRow;
  const rewardCoins = roundRewardToNearestFive(
    rules.reward * (multipliers.task_reward_multiplier ?? 1),
  );
  const nextCoins = profile.coins + rewardCoins;
  const now = new Date().toISOString();
  const result = await commitEconomyAction(supabase, {
    userId: user.id,
    operationKey: "court-game:" + gameId + ":" + storedSessionId,
    expectedProfile: { coins: profile.coins },
    patch: { coins: nextCoins },
    taskId: gameId,
    expectedTask: existingTask,
    taskPatch: {
      task_id: gameId,
      claimed_at: now,
      completed_at: now,
      reward_coins: rewardCoins,
      metadata: {
        ...(existingTask?.metadata ?? {}),
        completedAt: now,
        elapsedMs,
        metrics: body.metrics,
        status: "completed",
      },
    },
    reason: "reward:game:" + gameId,
    metadata: { elapsedMs, gameId, metrics: body.metrics },
    devotion: DEVOTION_REWARD_BASIC_TASK,
  });
  if ("error" in result) return jsonError(result.error, result.status);
  const updatedProfile = result.profile;
  const updatedTask = result.task;

  return Response.json({
    cooldownUntil: getDailyGmt3CooldownUntil(now),
    gameId,
    profile: updatedProfile,
    rewardCoins,
    task: updatedTask,
  });
}
