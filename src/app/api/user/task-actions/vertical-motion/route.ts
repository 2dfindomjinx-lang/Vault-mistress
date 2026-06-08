import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { DAY_MS, getGmt3DateKey } from "@/lib/time";

const TASK_ID = "vertical-motion";
const TASK_REWARD = 100;

type Body = {
  action?: "start" | "progress" | "finish_fake_hope" | "fail";
  progress?: number;
};

type MovementOutcome = "success" | "instant_denial" | "fake_hope";
type MovementState = "ready" | "active" | "fake_hope" | "failed" | "completed";

type TaskRow = {
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

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function getMetadataNumber(metadata: Record<string, unknown> | null | undefined, key: string, fallback = 0) {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getMetadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}

function pickOutcome(): MovementOutcome {
  const roll = Math.random();

  if (roll < 0.2) {
    return "success";
  }

  if (roll < 0.75) {
    return "instant_denial";
  }

  return "fake_hope";
}

function normalizeTask(row: TaskRow | null) {
  const metadata = row?.metadata ?? {};
  const resolvedAtMs = row?.claimed_at ? new Date(row.claimed_at).getTime() : 0;
  const resolvedCooldownActive =
    Number.isFinite(resolvedAtMs) && resolvedAtMs > 0 && Date.now() - resolvedAtMs < DAY_MS;

  if (row?.claimed_at && !resolvedCooldownActive) {
    return {
      fakeHopeStartedAt: null,
      outcome: null,
      progress: 0,
      state: "ready" as MovementState,
    };
  }

  const state = getMetadataString(metadata, "state") as MovementState | null;
  const outcome = getMetadataString(metadata, "outcome") as MovementOutcome | null;

  return {
    fakeHopeStartedAt: getMetadataString(metadata, "fakeHopeStartedAt"),
    outcome: outcome && ["success", "instant_denial", "fake_hope"].includes(outcome) ? outcome : null,
    progress: Math.max(0, Math.min(100, getMetadataNumber(metadata, "progress", 0))),
    state: state && ["ready", "active", "fake_hope", "failed", "completed"].includes(state)
      ? state
      : "ready",
  };
}

function buildTaskPayload({
  dateKey,
  fakeHopeStartedAt = null,
  outcome,
  progress,
  state,
}: {
  dateKey: string;
  fakeHopeStartedAt?: string | null;
  outcome: MovementOutcome;
  progress: number;
  state: MovementState;
}) {
  const now = new Date().toISOString();

  return {
    claimed_at: state === "completed" || state === "failed" ? now : null,
    completed_at: state === "completed" || state === "failed" ? now : null,
    metadata: {
      date: dateKey,
      fakeHopeStartedAt,
      outcome,
      progress,
      state,
    },
    reward_coins: TASK_REWARD,
    task_id: TASK_ID,
  };
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
  const action = body?.action;

  if (!action || !["start", "progress", "finish_fake_hope", "fail"].includes(action)) {
    return jsonError("Invalid movement action.");
  }

  const supabase = createSupabaseAdminClient();
  const [profileResult, taskResult] = await Promise.all([
    supabase.from("profiles").select("id, coins").eq("id", authData.user.id).single(),
    supabase
      .from("user_tasks")
      .select("task_id, completed_at, claimed_at, reward_coins, metadata")
      .eq("user_id", authData.user.id)
      .eq("task_id", TASK_ID)
      .maybeSingle(),
  ]);

  if (profileResult.error || !profileResult.data) {
    console.error("[vertical-motion] profile read failed", {
      error: profileResult.error,
      userId: authData.user.id,
    });
    return jsonError(profileResult.error?.message ?? "Profile not found.", 404);
  }

  if (taskResult.error) {
    console.error("[vertical-motion] task read failed", {
      error: taskResult.error,
      userId: authData.user.id,
    });
    return jsonError(taskResult.error.message, 500);
  }

  const profile = profileResult.data as ProfileRow;
  const today = getGmt3DateKey();
  const current = normalizeTask((taskResult.data as TaskRow | null) ?? null);

  if (current.state === "completed" || current.state === "failed") {
    return jsonError("Daily Motion is on 24-hour cooldown.", 409);
  }

  const outcome = current.outcome ?? pickOutcome();
  let nextProgress = current.progress;
  let nextState: MovementState = current.state === "ready" ? "active" : current.state;
  let fakeHopeStartedAt = current.fakeHopeStartedAt;
  let shouldReward = false;

  if (action === "start") {
    nextProgress = current.progress;
    nextState = "active";
  }

  if (action === "progress") {
    const requestedProgress = Math.max(0, Math.min(100, Math.round(body.progress ?? current.progress)));
    nextProgress = Math.max(current.progress, requestedProgress);

    if (outcome === "success" && nextProgress >= 100) {
      nextProgress = 100;
      nextState = "completed";
      shouldReward = true;
    } else if (outcome === "instant_denial" && nextProgress >= 99) {
      nextProgress = 99;
      nextState = "failed";
    } else if (outcome === "fake_hope" && nextProgress >= 99) {
      nextProgress = 99;
      nextState = "fake_hope";
      fakeHopeStartedAt = fakeHopeStartedAt ?? new Date().toISOString();
    }
  }

  if (action === "finish_fake_hope") {
    if (outcome !== "fake_hope" || !fakeHopeStartedAt) {
      return jsonError("Fake hope phase is not active.", 409);
    }

    const elapsedMs = Date.now() - new Date(fakeHopeStartedAt).getTime();

    if (elapsedMs < 10000) {
      return jsonError("Keep going.", 425);
    }

    nextProgress = 99;
    nextState = "failed";
  }

  if (action === "fail") {
    nextState = "failed";
  }

  const payload = buildTaskPayload({
    dateKey: today,
    fakeHopeStartedAt,
    outcome,
    progress: nextProgress,
    state: nextState,
  });

  let updatedProfile: ProfileRow = profile;

  if (shouldReward) {
    const { data: profileData, error: profileUpdateError } = await supabase
      .from("profiles")
      .update({ coins: profile.coins + TASK_REWARD })
      .eq("id", profile.id)
      .select("id, coins")
      .single();

    if (profileUpdateError || !profileData) {
      console.error("[vertical-motion] profile reward update failed", {
        error: profileUpdateError,
        userId: authData.user.id,
      });
      return jsonError(profileUpdateError?.message ?? "Movement reward update failed.", 500);
    }

    updatedProfile = profileData as ProfileRow;

    const { error: transactionError } = await supabase.from("coin_transactions").insert({
      amount: TASK_REWARD,
      metadata: {
        date: today,
        outcome,
        source: TASK_ID,
      },
      reason: "reward:vertical-motion",
      user_id: profile.id,
    });

    if (transactionError) {
      console.error("[vertical-motion] transaction insert failed", {
        error: transactionError,
        userId: authData.user.id,
      });
      const { error: rollbackProfileError } = await supabase
        .from("profiles")
        .update({ coins: profile.coins })
        .eq("id", authData.user.id);

      if (rollbackProfileError) {
        console.error("[vertical-motion] profile rollback failed", {
          error: rollbackProfileError,
          userId: authData.user.id,
        });
      }

      return jsonError("Movement coin logging failed.", 500);
    }
  }

  const { data: task, error: taskUpdateError } = await supabase
    .from("user_tasks")
    .upsert(
      {
        ...payload,
        user_id: authData.user.id,
      },
      { onConflict: "user_id,task_id" },
    )
    .select("task_id, completed_at, claimed_at, reward_coins, metadata")
    .single();

  if (taskUpdateError || !task) {
    console.error("[vertical-motion] task update failed", {
      error: taskUpdateError,
      userId: authData.user.id,
    });
    if (shouldReward) {
      const { error: txCleanupError } = await supabase
        .from("coin_transactions")
        .delete()
        .eq("user_id", authData.user.id)
        .eq("reason", "reward:vertical-motion")
        .eq("amount", TASK_REWARD);

      if (txCleanupError) {
        console.error("[vertical-motion] transaction cleanup failed", {
          error: txCleanupError,
          userId: authData.user.id,
        });
      }

      const { error: rollbackProfileError } = await supabase
        .from("profiles")
        .update({ coins: profile.coins })
        .eq("id", authData.user.id);

      if (rollbackProfileError) {
        console.error("[vertical-motion] profile rollback after task failure failed", {
          error: rollbackProfileError,
          userId: authData.user.id,
        });
      }
    }
    return jsonError(taskUpdateError?.message ?? "Movement task update failed.", 500);
  }

  return Response.json({
    profile: updatedProfile,
    task,
  });
}
