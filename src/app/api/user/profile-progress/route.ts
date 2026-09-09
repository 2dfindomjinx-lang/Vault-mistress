import { profileSelect } from "@/lib/server-game-rules";
import { randomUUID } from "node:crypto";
import { commitEconomyAction } from "@/lib/economy-command";
import {
  getAllowedTaskRewards,
  getCosmeticPrice,
  getTitlePrice,
  visibleGalleryCosts,
  SACRIFICE_COST,
  SUPPORT_COST,
  TIMEOUT_RISK_DAILY_SAFE_LIMIT,
} from "@/lib/server-game-rules";
import { IRL_TASK_WHEEL_COST } from "@/lib/irl-task-wheel";
import { DEVOTION_REWARD_BASIC_TASK } from "@/lib/devotion";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getCooldownUntil,
  getDailyResetCooldownUntil,
  getMetadataNumber,
  getMetadataString,
} from "@/lib/server-task-actions";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import {
  DEDICATED_TASK_IDS,
  getCoinTributeAffection,
} from "@/lib/economy-rules";
import { getActiveEventMultipliers } from "@/lib/server-task-actions";

type ProfilePatchBody = {
  metadata?: Record<string, unknown>;
  nextProfile?: {
    affection?: number;
    coins?: number;
    tribute_total?: number;
  };
  reason?: string;
};

type ProfileRow = {
  id: string;
  coins: number;
  affection: number;
  tribute_total: number;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function numberFromMetadata(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringFromMetadata(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" ? value : null;
}

function buildTransactionMetadata(
  reason: string,
  metadata: Record<string, unknown>,
  current: ProfileRow,
  next: Required<Pick<ProfileRow, "coins" | "affection">> &
    Partial<Pick<ProfileRow, "tribute_total">>,
) {
  const coinDelta = next.coins - current.coins;

  if (reason === "tribute:coin-offer") {
    return {
      affectionGain: numberFromMetadata(metadata, "affectionGain"),
      prestigeSource:
        stringFromMetadata(metadata, "prestigeSource") ?? "tribute-panel",
      spendAmount: numberFromMetadata(metadata, "spendAmount"),
    };
  }

  if (reason === "spend:gallery-unlock") {
    return {
      itemId: stringFromMetadata(metadata, "itemId"),
      spendAmount: numberFromMetadata(metadata, "spendAmount"),
    };
  }

  if (reason === "spend:irl-task-wheel") {
    return {
      spendAmount: IRL_TASK_WHEEL_COST,
    };
  }

  if (reason === "spend:cosmetic") {
    return {
      cosmeticId: stringFromMetadata(metadata, "cosmeticId"),
      cosmeticType: stringFromMetadata(metadata, "cosmeticType"),
      spendAmount: numberFromMetadata(metadata, "spendAmount"),
    };
  }

  if (reason === "spend:title") {
    return {
      spendAmount: numberFromMetadata(metadata, "spendAmount"),
      titleId: stringFromMetadata(metadata, "titleId"),
    };
  }

  if (reason === "streak_bonus") {
    const taskId = stringFromMetadata(metadata, "taskId");

    return {
      rewardCoins: coinDelta,
      taskId,
    };
  }

  if (
    reason === "task:wait-obediently" ||
    reason === "task:timeout-risk" ||
    reason === "beg"
  ) {
    return {
      rewardCoins: coinDelta,
      taskId: reason === "beg" ? "beg" : reason.replace("task:", ""),
    };
  }

  if (
    reason === "tribute:sacrifice" ||
    reason === "tribute:support" ||
    reason === "tribute:coin-offer"
  ) {
    return {
      prestigeSource:
        stringFromMetadata(metadata, "prestigeSource") ?? "tribute-panel",
      spendAmount: numberFromMetadata(metadata, "spendAmount"),
    };
  }

  return {};
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

  const body = (await request
    .json()
    .catch(() => null)) as ProfilePatchBody | null;
  const reason = body?.reason?.trim();
  if (
    [
      "reward:case-opening",
      "reward:task:case-opening",
      "task:case-opening",
    ].includes(reason ?? "")
  ) {
    return jsonError(
      "Case Opening must use its dedicated action endpoint.",
      409,
    );
  }
  const clientNext = body?.nextProfile ?? {};
  const metadata = body?.metadata ?? {};

  if (!reason) {
    return jsonError("Invalid profile progress payload.");
  }

  const requestedTask = reason.replace(/^(?:reward:)?task:/, "");
  if (
    DEDICATED_TASK_IDS.has(requestedTask) ||
    reason.startsWith("reward:task:") ||
    reason === "streak_bonus"
  ) {
    return jsonError("Use the task's dedicated action or claim endpoint.", 409);
  }

  const requestKey = request.headers.get("Idempotency-Key");
  if (requestKey && !/^[a-zA-Z0-9:_-]{8,120}$/.test(requestKey))
    return jsonError("Invalid operation key.");
  const supabase = createSupabaseAdminClient();
  if (requestKey && !reason.startsWith("task:") && reason !== "beg") {
    const operationKey = "profile:" + reason + ":" + requestKey;
    const receipt = await supabase
      .from("economy_receipts")
      .select("operation_key")
      .eq("user_id", authData.user.id)
      .eq("operation_key", operationKey)
      .maybeSingle();
    if (receipt.error)
      return jsonError("Action history is temporarily unavailable.", 503);
    if (receipt.data) {
      const profile = await supabase
        .from("profiles")
        .select(profileSelect)
        .eq("id", authData.user.id)
        .single();
      if (profile.error)
        return jsonError("Refresh to see your completed action.", 503);
      return Response.json({
        profile: profile.data,
        operationKey,
        duplicate: true,
      });
    }
  }

  const rateLimit = await checkRateLimit(
    supabase,
    `profile-progress:${authData.user.id}`,
    60,
    60,
  );
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfterSeconds);
  }

  const { data: currentProfileData, error: currentError } = await supabase
    .from("profiles")
    .select("id, coins, affection, tribute_total")
    .eq("id", authData.user.id)
    .single();

  if (currentError || !currentProfileData) {
    console.error("[profile-progress] Supabase error reading current profile", {
      code: currentError?.code,
      message: currentError?.message,
      details: currentError?.details,
      hint: currentError?.hint,
      userId: authData.user.id,
      reason,
    });
    return jsonError(currentError?.message ?? "Profile not found.", 404);
  }

  const current = currentProfileData as ProfileRow;
  const now = new Date().toISOString();

  // Server computes all sensitive values. Client nextProfile is only a hint for proposed delta (validated strictly).
  let nextCoins = current.coins;
  let nextAffection = current.affection;
  let nextTribute = current.tribute_total ?? 0;

  // Fetch task state for cooldown/reward cap enforcement on reward reasons
  interface CooldownTaskRow {
    task_id: string;
    completed_at: string | null;
    claimed_at: string | null;
    metadata: Record<string, unknown> | null;
  }
  let cooldownRow: CooldownTaskRow | null = null;
  const isRewardReason =
    reason === "beg" ||
    reason.includes("timeout-risk") ||
    reason.includes("wait-obediently") ||
    reason.startsWith("reward:task:") ||
    reason === "streak_bonus";

  if (isRewardReason) {
    let taskIdForRow =
      reason === "beg"
        ? "beg"
        : reason.replace("task:", "").replace("reward:task:", "");
    if (reason === "streak_bonus") {
      taskIdForRow = stringFromMetadata(metadata, "taskId") ?? "streak-bonus-1";
    }
    const { data: row } = await supabase
      .from("user_tasks")
      .select("task_id, completed_at, claimed_at, metadata")
      .eq("user_id", authData.user.id)
      .eq("task_id", taskIdForRow)
      .maybeSingle();
    cooldownRow = row;
  }

  // Compute authoritative deltas. Never apply raw client nextProfile values.
  if (reason === "tribute:coin-offer") {
    const spendAmount = numberFromMetadata(metadata, "spendAmount") || 0;
    const multipliers = await getActiveEventMultipliers(supabase, [
      "tribute_affection_boost",
    ]);
    const affectionGain =
      getCoinTributeAffection(
        spendAmount,
        multipliers.tribute_affection_boost,
      ) ?? 0;
    metadata.affectionGain = affectionGain;
    const allowedTributes = new Set([250, 1000, 5000]);
    if (!allowedTributes.has(spendAmount) || current.coins < spendAmount) {
      return jsonError("Invalid or unaffordable tribute offer.", 422);
    }
    nextCoins = current.coins - spendAmount;
    nextTribute = (current.tribute_total ?? 0) + spendAmount;
    nextAffection = Math.min(100, current.affection + affectionGain);
  } else if (reason === "spend:gallery-unlock") {
    const itemId = stringFromMetadata(metadata, "itemId");
    const cost = itemId ? visibleGalleryCosts.get(itemId) || 0 : 0;
    if (!cost || current.coins < cost) {
      return jsonError("Invalid gallery unlock or insufficient funds.", 422);
    }
    nextCoins = current.coins - cost;
    nextAffection = current.affection;
    nextTribute = current.tribute_total ?? 0;
  } else if (reason === "spend:irl-task-wheel") {
    if (current.coins < IRL_TASK_WHEEL_COST) {
      return jsonError("Insufficient funds for IRL task wheel.", 422);
    }
    nextCoins = current.coins - IRL_TASK_WHEEL_COST;
    nextAffection = current.affection;
    nextTribute = current.tribute_total ?? 0;
  } else if (reason === "spend:cosmetic") {
    const itemId = stringFromMetadata(metadata, "cosmeticId");
    const price = itemId ? getCosmeticPrice(itemId) || 0 : 0;
    if (!price || current.coins < price) {
      return jsonError("Invalid cosmetic or insufficient funds.", 422);
    }
    nextCoins = current.coins - price;
    nextAffection = current.affection;
    nextTribute = current.tribute_total ?? 0;
  } else if (reason === "spend:title") {
    const titleId = stringFromMetadata(metadata, "titleId");
    const price = titleId ? getTitlePrice(titleId) || 0 : 0;
    if (!price || current.coins < price) {
      return jsonError("Invalid title or insufficient funds.", 422);
    }
    nextCoins = current.coins - price;
    nextAffection = current.affection;
    nextTribute = current.tribute_total ?? 0;
  } else if (reason === "tribute:sacrifice" || reason === "tribute:support") {
    // Pin the charge to the server constant instead of trusting the client's
    // reported spendAmount - every other spend branch above already does this.
    const expectedAmount =
      reason === "tribute:sacrifice" ? SACRIFICE_COST : SUPPORT_COST;
    const spendAmount = numberFromMetadata(metadata, "spendAmount") || 0;
    if (spendAmount !== expectedAmount || current.coins < expectedAmount) {
      return jsonError("Invalid tribute spend or insufficient funds.", 422);
    }
    nextCoins = current.coins - spendAmount;
    nextTribute = (current.tribute_total ?? 0) + spendAmount;
    nextAffection = current.affection;
  } else if (isRewardReason) {
    // Reward mechanics: validate proposed delta against allow-list + enforce server DB cooldown/caps
    let taskId =
      reason === "beg"
        ? "beg"
        : reason.replace("task:", "").replace("reward:task:", "");
    if (reason === "streak_bonus") {
      taskId = stringFromMetadata(metadata, "taskId") ?? "";
    }
    const allowed = getAllowedTaskRewards(taskId);
    const proposedDelta =
      (typeof clientNext.coins === "number"
        ? clientNext.coins
        : current.coins) - current.coins;

    if (!allowed.includes(proposedDelta)) {
      return jsonError("Reward delta not allowed for this action.", 422);
    }

    if (taskId !== "case-opening" && !cooldownRow) {
      return jsonError("Task state missing for reward action.", 409);
    }

    // Enforce cooldown / daily caps from trusted task row (sanitized by generic tasks route)
    const cooldownMetadata = cooldownRow?.metadata ?? null;
    const lastAction =
      taskId === "case-opening"
        ? null
        : getMetadataString(cooldownMetadata, "lastBegAt") ||
          getMetadataString(cooldownMetadata, "resetAt") ||
          getMetadataString(cooldownMetadata, "lastClaimAt") ||
          cooldownRow?.claimed_at ||
          cooldownRow?.completed_at;

    let activeCooldown: string | null = null;

    if (taskId === "beg") {
      activeCooldown = getCooldownUntil(lastAction, 60 * 1000);
    } else if (
      taskId === "timeout-risk" ||
      taskId === "wait-obediently" ||
      taskId === "vertical-motion"
    ) {
      activeCooldown = getDailyResetCooldownUntil(lastAction);
    } else if (taskId !== "case-opening") {
      activeCooldown = getDailyResetCooldownUntil(lastAction);
    }

    if (activeCooldown && proposedDelta > 0) {
      return jsonError("Action is on cooldown or daily limit reached.", 422);
    }

    // Additional daily cap for timeout-risk safe rewards
    if (taskId === "timeout-risk") {
      const safeWins = getMetadataNumber(cooldownMetadata, "safeWins", 0);
      if (safeWins >= TIMEOUT_RISK_DAILY_SAFE_LIMIT) {
        return jsonError(
          "Daily safe reward limit reached for timeout-risk.",
          422,
        );
      }
    }

    nextCoins = current.coins + proposedDelta;
    nextAffection = current.affection;
    nextTribute = current.tribute_total ?? 0;
  } else {
    // All supported reasons are handled in the explicit server-computed branches above.
    // Unknown or unsupported reasons must be rejected immediately.
    // Do not construct or apply any values derived from client-provided nextProfile.
    return jsonError(`Unsupported profile mutation reason: ${reason}`, 422);
  }

  // Final safety clamps (only reached for explicitly supported reasons)
  if (
    nextAffection < 0 ||
    nextAffection > 100 ||
    !Number.isInteger(nextCoins) ||
    !Number.isInteger(nextAffection)
  ) {
    return jsonError("Computed profile values out of range.", 422);
  }

  const actualCoinDelta = nextCoins - current.coins;
  const taskId = isRewardReason
    ? reason === "beg"
      ? "beg"
      : reason.replace(/^(?:reward:)?task:/, "")
    : undefined;
  const nextMetadata: Record<string, unknown> = {
    ...(cooldownRow?.metadata ?? {}),
  };
  if (taskId === "beg") {
    nextMetadata.lastBegAt = now;
    nextMetadata.lastReward = actualCoinDelta;
  }
  if (taskId === "wait-obediently") nextMetadata.status = "completed";
  const operationKey = taskId
    ? "profile-task:" +
      taskId +
      ":" +
      (cooldownRow?.claimed_at ?? cooldownRow?.completed_at ?? "first")
    : "profile:" + reason + ":" + (requestKey ?? randomUUID());
  const result = await commitEconomyAction(supabase, {
    userId: authData.user.id,
    operationKey,
    reason,
    expectedProfile: {
      coins: current.coins,
      affection: current.affection,
      tribute_total: current.tribute_total,
    },
    patch: {
      coins: nextCoins,
      affection: nextAffection,
      tribute_total: nextTribute,
    },
    taskId,
    expectedTask: cooldownRow,
    taskPatch: taskId
      ? {
          task_id: taskId,
          completed_at: now,
          claimed_at: now,
          reward_coins: actualCoinDelta,
          metadata: nextMetadata,
        }
      : null,
    metadata: buildTransactionMetadata(reason, metadata, current, {
      coins: nextCoins,
      affection: nextAffection,
      tribute_total: nextTribute,
    }),
    devotion:
      isRewardReason && actualCoinDelta > 0 ? DEVOTION_REWARD_BASIC_TASK : 0,
  });
  if ("error" in result) return jsonError(result.error, result.status);
  return Response.json({ profile: result.profile, operationKey });
}
