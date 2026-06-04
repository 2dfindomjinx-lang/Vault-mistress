import { profileSelect } from "@/lib/server-game-rules";
import {
  DAY_MS,
  generateNumberPickOptions,
  getActiveEventMultipliers,
  getCooldownUntil,
  getMetadataNumber,
  getMetadataNumberArray,
  randomFrom,
  type UserTaskActionRow,
  validateNumberPickOptions,
} from "@/lib/server-task-actions";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  options?: number[];
  selectedNumber?: number;
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
  const selectedNumber = body?.selectedNumber;

  if (typeof selectedNumber !== "number" || !Number.isInteger(selectedNumber) || selectedNumber < 1 || selectedNumber > 9) {
    return jsonError("Invalid Number Pick payload.");
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
      .eq("task_id", "number-pick")
      .maybeSingle(),
    getActiveEventMultipliers(supabase, ["task_reward_multiplier"]),
  ]);

  if (profileResult.error || !profileResult.data) {
    return jsonError(profileResult.error?.message ?? "Profile not found.", 404);
  }

  if (taskResult.error) {
    return jsonError(taskResult.error.message, 500);
  }

  const profile = profileResult.data as ProfileRow;
  const existingTask = (taskResult.data as UserTaskActionRow | null) ?? null;
  const cooldownMs = DAY_MS;
  const cooldownUntil = getCooldownUntil(existingTask?.claimed_at, cooldownMs);
  const metadata =
    existingTask?.claimed_at && !cooldownUntil
      ? {}
      : existingTask?.metadata ?? {};

  if (cooldownUntil) {
    return jsonError("Number Pick is still on cooldown.", 429);
  }

  const storedOptions = getMetadataNumberArray(metadata, "options");
  const submittedOptions = validateNumberPickOptions(body?.options);
  const options = storedOptions && storedOptions.length === 3
    ? storedOptions
    : submittedOptions ?? generateNumberPickOptions();

  if (!options.includes(selectedNumber)) {
    return jsonError("Selected number is not in the active options.", 422);
  }

  const previousWrongSelections = getMetadataNumberArray(metadata, "wrongSelections") ?? [];

  if (previousWrongSelections.includes(selectedNumber)) {
    return jsonError("That number was already rejected.", 422);
  }

  const existingResult = metadata.result;

  if (existingResult === "win" || existingResult === "loss") {
    return jsonError("Number Pick is already completed.", 422);
  }

  const existingCorrect = getMetadataNumber(metadata, "correct", Number.NaN);
  const correctNumber = Number.isFinite(existingCorrect) ? existingCorrect : randomFrom(options);
  const attemptsRemaining = getMetadataNumber(metadata, "attemptsRemaining", 2);
  const isCorrect = selectedNumber === correctNumber;
  const baseReward = isCorrect ? (attemptsRemaining >= 2 ? 150 : 75) : 0;
  const reward = baseReward > 0 ? Math.round(baseReward * multipliers.task_reward_multiplier) : 0;
  const nextAttemptsRemaining = isCorrect ? 0 : Math.max(0, attemptsRemaining - 1);
  const finalAttempt = isCorrect || nextAttemptsRemaining === 0;
  const result: "win" | "loss" | null = finalAttempt ? (isCorrect ? "win" : "loss") : null;
  const wrongSelections = isCorrect
    ? previousWrongSelections
    : Array.from(new Set([...previousWrongSelections, selectedNumber]));
  const now = new Date().toISOString();
  const nextCoins = profile.coins + reward;

  let updatedProfile = profileResult.data;

  if (reward > 0) {
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
      return jsonError(error?.message ?? "Number Pick duplicate or stale balance rejected.", 409);
    }

    updatedProfile = data;
  } else {
    const { data, error } = await supabase
      .from("profiles")
      .select(profileSelect)
      .eq("id", authData.user.id)
      .single();

    if (error || !data) {
      return jsonError(error?.message ?? "Profile refresh failed.", 500);
    }

    updatedProfile = data;
  }

  const nextMetadata = {
    ...metadata,
    attemptsRemaining: nextAttemptsRemaining,
    correct: correctNumber,
    options,
    result,
    selected: selectedNumber,
    wrongSelections,
  };
  const { data: updatedTask, error: taskError } = await supabase
    .from("user_tasks")
    .upsert(
      {
        user_id: authData.user.id,
        task_id: "number-pick",
        completed_at: finalAttempt ? now : existingTask?.completed_at ?? null,
        claimed_at: finalAttempt ? now : null,
        reward_coins: reward,
        metadata: nextMetadata,
      },
      { onConflict: "user_id,task_id" },
    )
    .select("task_id, completed_at, claimed_at, reward_coins, metadata")
    .single();

  if (taskError || !updatedTask) {
    return jsonError(taskError?.message ?? "Number Pick task update failed.", 500);
  }

  if (reward > 0) {
    const { error: transactionError } = await supabase.from("coin_transactions").insert({
      amount: reward,
      balance_after: nextCoins,
      balance_before: profile.coins,
      metadata: {
        attemptsRemaining,
        correct: correctNumber,
        options,
        selected: selectedNumber,
      },
      reason: "task:number-pick",
      user_id: authData.user.id,
    });

    if (transactionError) {
      console.error("Number Pick transaction insert failed", transactionError);
    }
  }

  return Response.json({
    profile: updatedProfile,
    task: updatedTask,
    taskState: {
      claimed: finalAttempt,
      completed: result === "win",
      cooldownUntil: finalAttempt ? getCooldownUntil(now, cooldownMs) : null,
      numberPickAttemptsRemaining: nextAttemptsRemaining,
      numberPickCorrect: correctNumber,
      numberPickOptions: options,
      numberPickResult: result,
      numberPickSelected: selectedNumber,
      numberPickWrongSelections: wrongSelections,
    },
  });
}
