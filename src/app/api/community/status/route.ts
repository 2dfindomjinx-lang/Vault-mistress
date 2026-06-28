import {
  buildCommunityGoalStatus,
  getCurrentCommunityGoal,
  getGmt3DayStart,
  getGmt3MonthStart,
  getGmt3WeekStart,
  type CoinTransactionLite,
  type HallOfFameCardData,
} from "@/lib/prestige";
import { loadCommunityProfiles, syncCurrentUserPrestige } from "@/lib/prestige-server";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

type MinimalProfileRow = {
  id: string;
  loyalty_streak: number | null;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function sumAmountsByUser(
  rows: CoinTransactionLite[],
  startMs: number,
  endMs: number,
) {
  const totals = new Map<string, number>();

  rows.forEach((row) => {
    if (!row.user_id || !row.created_at) {
      return;
    }

    const createdAtMs = new Date(row.created_at).getTime();
    if (createdAtMs < startMs || createdAtMs >= endMs) {
      return;
    }

    const nextTotal = (totals.get(row.user_id) ?? 0) + Math.abs(Number(row.amount ?? 0));
    totals.set(row.user_id, nextTotal);
  });

  return totals;
}

function sumSimpleMetricByUser<T extends { user_id: string; created_at: string }>(
  rows: T[],
  startMs: number,
  endMs: number,
  resolver: (row: T) => number,
) {
  const totals = new Map<string, number>();

  rows.forEach((row) => {
    const createdAtMs = new Date(row.created_at).getTime();
    if (createdAtMs < startMs || createdAtMs >= endMs) {
      return;
    }

    const nextTotal = (totals.get(row.user_id) ?? 0) + resolver(row);
    totals.set(row.user_id, nextTotal);
  });

  return totals;
}

function getTopUserId(metricMap: Map<string, number>) {
  return Array.from(metricMap.entries())
    .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))[0]?.[0] ?? null;
}

function getTopValue(metricMap: Map<string, number>, userId: string | null) {
  return userId ? metricMap.get(userId) ?? 0 : 0;
}

export async function GET() {
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
  const currentUserBadges = await syncCurrentUserPrestige(supabase, authData.user.id);
  const nowMs = Date.now();
  const dayStartMs = getGmt3DayStart(nowMs);
  const weekStartMs = getGmt3WeekStart(nowMs);
  const monthStartMs = getGmt3MonthStart(nowMs);
  const earliestSupportWindowMs = Math.min(dayStartMs, weekStartMs, monthStartMs);
  const currentGoal = getCurrentCommunityGoal(nowMs);

  const [supportResult, devotionResult, caseResult, streakResult, goalResult] = await Promise.all([
    supabase
      .from("coin_transactions")
      .select("user_id, amount, created_at, metadata, reason")
      .in("reason", ["live_gift", "throne_tribute", "tribute:coin-offer", "tribute:sacrifice", "tribute:support"])
      .gte("created_at", new Date(earliestSupportWindowMs).toISOString()),
    supabase
      .from("devotion_events")
      .select("user_id, amount, created_at")
      .gte("created_at", new Date(monthStartMs).toISOString()),
    supabase
      .from("crate_opens")
      .select("user_id, opened_at")
      .gte("opened_at", new Date(monthStartMs).toISOString()),
    supabase
      .from("profiles")
      .select("id, loyalty_streak")
      .order("loyalty_streak", { ascending: false })
      .limit(10),
    supabase
      .from("coin_transactions")
      .select("user_id, amount, created_at, metadata, reason")
      .in("reason", currentGoal.includedReasons)
      .gte("created_at", currentGoal.startsAt)
      .lt("created_at", currentGoal.endsAt),
  ]);

  if (supportResult.error) {
    return jsonError(supportResult.error.message, 500);
  }

  if (devotionResult.error) {
    return jsonError(devotionResult.error.message, 500);
  }

  if (caseResult.error) {
    return jsonError(caseResult.error.message, 500);
  }

  if (streakResult.error) {
    return jsonError(streakResult.error.message, 500);
  }

  if (goalResult.error) {
    return jsonError(goalResult.error.message, 500);
  }

  const supportRows = ((supportResult.data ?? []) as CoinTransactionLite[]).filter((row) => {
    if (row.reason === "throne_tribute") {
      return true;
    }

    if (row.reason === "live_gift") {
      const metadata = row.metadata ?? {};
      const command = typeof metadata.command === "string" ? metadata.command : "";
      const kind = typeof metadata.kind === "string" ? metadata.kind : "";
      const source = typeof metadata.source === "string" ? metadata.source : "";

      return command === "give" || kind === "manual_coin_purchase" || source === "throne";
    }

    return row.reason === "tribute:coin-offer" || row.reason === "tribute:sacrifice" || row.reason === "tribute:support";
  });
  const devotionRows = (devotionResult.data ?? []) as Array<{ amount: number; created_at: string; user_id: string }>;
  const caseRows = (caseResult.data ?? []) as Array<{ opened_at: string; user_id: string }>;
  const streakRows = (streakResult.data ?? []) as MinimalProfileRow[];
  const goalRows = (goalResult.data ?? []) as CoinTransactionLite[];

  const supporterToday = sumAmountsByUser(supportRows, dayStartMs, nowMs + 1);
  const supporterWeek = sumAmountsByUser(supportRows, weekStartMs, nowMs + 1);
  const supporterMonth = sumAmountsByUser(supportRows, monthStartMs, nowMs + 1);
  const devotionToday = sumSimpleMetricByUser(devotionRows, dayStartMs, nowMs + 1, (row) => Number(row.amount ?? 0));
  const devotionMonth = sumSimpleMetricByUser(devotionRows, monthStartMs, nowMs + 1, (row) => Number(row.amount ?? 0));
  const casesMonth = sumSimpleMetricByUser(
    caseRows.map((row) => ({ created_at: row.opened_at, user_id: row.user_id })),
    monthStartMs,
    nowMs + 1,
    () => 1,
  );

  const longestStreakUserId = streakRows
    .sort((first, second) => Number(second.loyalty_streak ?? 0) - Number(first.loyalty_streak ?? 0))[0]?.id ?? null;
  const allWinnerIds = [
    getTopUserId(supporterToday),
    getTopUserId(supporterWeek),
    getTopUserId(supporterMonth),
    getTopUserId(devotionToday),
    getTopUserId(devotionMonth),
    longestStreakUserId,
    getTopUserId(casesMonth),
  ].filter((id): id is string => Boolean(id));

  const profiles = await loadCommunityProfiles(supabase, allWinnerIds);
  const hallCards: HallOfFameCardData[] = [
    {
      id: "supporter-today",
      title: "Biggest Supporter Today",
      metricLabel: "Supported today",
      metricValue: getTopValue(supporterToday, getTopUserId(supporterToday)),
      valueDisplay: getTopValue(supporterToday, getTopUserId(supporterToday)).toLocaleString(),
      winner: profiles.get(getTopUserId(supporterToday) ?? "") ?? null,
    },
    {
      id: "supporter-week",
      title: "Biggest Supporter This Week",
      metricLabel: "Supported this week",
      metricValue: getTopValue(supporterWeek, getTopUserId(supporterWeek)),
      valueDisplay: getTopValue(supporterWeek, getTopUserId(supporterWeek)).toLocaleString(),
      winner: profiles.get(getTopUserId(supporterWeek) ?? "") ?? null,
    },
    {
      id: "supporter-month",
      title: "Biggest Supporter This Month",
      metricLabel: "Supported this month",
      metricValue: getTopValue(supporterMonth, getTopUserId(supporterMonth)),
      valueDisplay: getTopValue(supporterMonth, getTopUserId(supporterMonth)).toLocaleString(),
      winner: profiles.get(getTopUserId(supporterMonth) ?? "") ?? null,
    },
    {
      id: "devotion-today",
      title: "Highest Devotion Today",
      metricLabel: "Devotion today",
      metricValue: getTopValue(devotionToday, getTopUserId(devotionToday)),
      valueDisplay: getTopValue(devotionToday, getTopUserId(devotionToday)).toLocaleString(),
      winner: profiles.get(getTopUserId(devotionToday) ?? "") ?? null,
    },
    {
      id: "devotion-month",
      title: "Highest Devotion This Month",
      metricLabel: "Devotion this month",
      metricValue: getTopValue(devotionMonth, getTopUserId(devotionMonth)),
      valueDisplay: getTopValue(devotionMonth, getTopUserId(devotionMonth)).toLocaleString(),
      winner: profiles.get(getTopUserId(devotionMonth) ?? "") ?? null,
    },
    {
      id: "login-streak",
      title: "Longest Login Streak",
      metricLabel: "Current streak",
      metricValue: profiles.get(longestStreakUserId ?? "")?.loyaltyStreak ?? 0,
      valueDisplay: `${(profiles.get(longestStreakUserId ?? "")?.loyaltyStreak ?? 0).toLocaleString()} days`,
      winner: profiles.get(longestStreakUserId ?? "") ?? null,
    },
    {
      id: "cases-month",
      title: "Most Cases Opened This Month",
      metricLabel: "Cases this month",
      metricValue: getTopValue(casesMonth, getTopUserId(casesMonth)),
      valueDisplay: getTopValue(casesMonth, getTopUserId(casesMonth)).toLocaleString(),
      winner: profiles.get(getTopUserId(casesMonth) ?? "") ?? null,
    },
  ];
  const communityGoal = buildCommunityGoalStatus(currentGoal, goalRows, authData.user.id);

  return Response.json(
    {
      communityGoal,
      currentUserBadges,
      hallOfFame: hallCards,
    },
    {
      headers: {
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    },
  );
}
