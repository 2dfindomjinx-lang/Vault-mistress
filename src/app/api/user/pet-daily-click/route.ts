import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getGmt3DateKey, getGmt3DayIndex } from "@/lib/time";

const TASK_ID = "pet-daily-click";
const CLICK_IMAGE_POOL = [
  "/pet/daily-click/click-01.png",
  "/pet/daily-click/click-02.png",
  "/pet/daily-click/click-03.png",
  "/pet/daily-click/click-04.png",
  "/pet/daily-click/click-05.png",
  "/pet/daily-click/click-06.png",
  "/pet/daily-click/click-07.png",
  "/pet/daily-click/click-08.png",
  "/pet/daily-click/click-09.png",
  "/pet/daily-click/click-10.png",
  "/pet/daily-click/click-11.png",
  "/pet/daily-click/click-12.png",
  "/pet/daily-click/click-13.png",
  "/pet/daily-click/click-14.png",
  "/pet/daily-click/click-15.png",
  "/pet/daily-click/click-16.png",
  "/pet/daily-click/click-17.png",
  "/pet/daily-click/click-18.png",
  "/pet/daily-click/click-19.png",
  "/pet/daily-click/click-20.png",
  "/pet/daily-click/click-21.png",
  "/pet/daily-click/click-22.png",
  "/pet/daily-click/click-23.png",
  "/pet/daily-click/click-24.png",
  "/pet/daily-click/click-25.png",
  "/pet/daily-click/click-26.png",
  "/pet/daily-click/click-27.png",
  "/pet/daily-click/click-28.png",
  "/pet/daily-click/click-29.png",
  "/pet/daily-click/click-30.png",
  "/pet/daily-click/click-31.png",
  "/pet/daily-click/click-32.png",
  "/pet/daily-click/click-33.png",
  "/pet/daily-click/click-34.png",
  "/pet/daily-click/click-35.png",
  "/pet/daily-click/click-36.png",
  "/pet/daily-click/click-37.png",
  "/pet/daily-click/click-38.png",
  "/pet/daily-click/click-39.png",
  "/pet/daily-click/click-40.png",
  "/pet/daily-click/click-41.png",
  "/pet/daily-click/click-42.png",
];

type TaskRow = {
  completed_at: string | null;
  metadata: Record<string, unknown> | null;
  reviewed_at: string | null;
  reward_score: number | null;
  status: string | null;
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

function weightedRequirement() {
  const roll = Math.random();

  if (roll < 0.7) {
    return randomInteger(150, 300);
  }

  if (roll < 0.85) {
    return randomInteger(100, 149);
  }

  return randomInteger(301, 500);
}

function randomInteger(minimum: number, maximum: number) {
  return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
}

function getDailyImage() {
  const imageIndex = getGmt3DayIndex() % CLICK_IMAGE_POOL.length;
  return CLICK_IMAGE_POOL[imageIndex] ?? CLICK_IMAGE_POOL[0];
}

function normalizeTask(row: TaskRow | null, dateKey: string) {
  const metadata = row?.metadata ?? {};
  const rowDate = getMetadataString(metadata, "date");
  const sameDay = rowDate === dateKey;
  const requirement = sameDay
    ? Math.max(100, Math.min(500, Math.round(getMetadataNumber(metadata, "requirement", weightedRequirement()))))
    : weightedRequirement();
  const progress = sameDay
    ? Math.max(0, Math.min(requirement, Math.round(getMetadataNumber(metadata, "progress", 0))))
    : 0;
  const completed = progress >= requirement;

  return {
    completed,
    metadata: {
      date: dateKey,
      image: getDailyImage(),
      progress,
      requirement,
    },
    progress,
    requirement,
  };
}

export async function POST() {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();

  if (authError || !authData.user) {
    return jsonError(authError?.message ?? "Authentication required.", 401);
  }

  const supabase = createSupabaseAdminClient();
  const [profileResult, taskResult] = await Promise.all([
    supabase.from("profiles").select("id, coins").eq("id", authData.user.id).single(),
    supabase
      .from("user_pet_tasks")
      .select("task_id, completed_at, reward_score, status, reviewed_at, metadata")
      .eq("user_id", authData.user.id)
      .eq("task_id", TASK_ID)
      .maybeSingle(),
  ]);

  if (profileResult.error || !profileResult.data) {
    console.error("[pet-daily-click] profile read failed", {
      error: profileResult.error,
      userId: authData.user.id,
    });
    return jsonError(profileResult.error?.message ?? "Profile not found.", 404);
  }

  if (taskResult.error) {
    console.error("[pet-daily-click] task read failed", {
      error: taskResult.error,
      userId: authData.user.id,
    });
    return jsonError(taskResult.error.message, 500);
  }

  const profile = profileResult.data as ProfileRow;
  const today = getGmt3DateKey();
  const current = normalizeTask((taskResult.data as TaskRow | null) ?? null, today);

  if (current.completed) {
    return Response.json({
      profile,
      task: {
        completed_at: new Date().toISOString(),
        metadata: current.metadata,
        reward_score: 0,
        reviewed_at: new Date().toISOString(),
        status: "approved",
        task_id: TASK_ID,
      },
    });
  }

  const nextProgress = Math.min(current.requirement, current.progress + 1);
  const now = new Date().toISOString();
  const completed = nextProgress >= current.requirement;
  const metadata = {
    date: today,
    image: getDailyImage(),
    progress: nextProgress,
    requirement: current.requirement,
  };
  const nextCoins = profile.coins + 1;

  const { data: updatedProfile, error: profileUpdateError } = await supabase
    .from("profiles")
    .update({ coins: nextCoins })
    .eq("id", profile.id)
    .select("id, coins")
    .single();

  if (profileUpdateError || !updatedProfile) {
    console.error("[pet-daily-click] profile update failed", {
      error: profileUpdateError,
      userId: authData.user.id,
    });
    return jsonError(profileUpdateError?.message ?? "Pet click coin update failed.", 500);
  }

  const { error: transactionError } = await supabase.from("coin_transactions").insert({
    amount: 1,
    metadata: {
      date: today,
      progress: nextProgress,
      requirement: current.requirement,
      source: "pet_daily_click",
    },
    reason: "reward:pet-daily-click",
    user_id: profile.id,
  });

  if (transactionError) {
    console.error("[pet-daily-click] transaction insert failed", {
      error: transactionError,
      userId: authData.user.id,
    });
  }

  const { data: task, error: taskUpdateError } = await supabase
    .from("user_pet_tasks")
    .upsert(
      {
        completed_at: completed ? now : null,
        metadata,
        reviewed_at: completed ? now : null,
        reward_score: 0,
        status: completed ? "approved" : "available",
        task_id: TASK_ID,
        user_id: authData.user.id,
      },
      { onConflict: "user_id,task_id" },
    )
    .select("task_id, completed_at, reward_score, status, reviewed_at, metadata")
    .single();

  if (taskUpdateError || !task) {
    console.error("[pet-daily-click] task update failed", {
      error: taskUpdateError,
      userId: authData.user.id,
    });
    return jsonError(taskUpdateError?.message ?? "Pet click progress update failed.", 500);
  }

  return Response.json({ profile: updatedProfile, task });
}
