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

function getTopVisibleUserId(metricMap: Map<string, number>, hiddenUserIds: Set<string>) {
  return Array.from(metricMap.entries())
    .filter(([userId]) => !hiddenUserIds.has(userId))
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
      .eq("hide_from_leaderboard", false)
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
  const longestStreakUserId = streakRows
    .sort((first, second) => Number(second.loyalty_streak ?? 0) - Number(first.loyalty_streak ?? 0))[0]?.id ?? null;
  const candidateWinnerIds = Array.from(new Set([
    ...supporterToday.keys(),
    ...supporterWeek.keys(),
    ...supporterMonth.keys(),
    ...devotionToday.keys(),
    ...devotionMonth.keys(),
    ...streakRows.map((row) => row.id),
  ]));
  const hiddenProfilesResult = candidateWinnerIds.length
    ? await supabase
      .from("profiles")
      .select("id")
      .in("id", candidateWinnerIds)
      .eq("hide_from_leaderboard", true)
    : { data: [], error: null };

  if (hiddenProfilesResult.error) {
    return jsonError(hiddenProfilesResult.error.message, 500);
  }

  const hiddenUserIds = new Set((hiddenProfilesResult.data ?? []).map((row) => row.id));
  const supporterTodayUserId = getTopVisibleUserId(supporterToday, hiddenUserIds);
  const supporterWeekUserId = getTopVisibleUserId(supporterWeek, hiddenUserIds);
  const supporterMonthUserId = getTopVisibleUserId(supporterMonth, hiddenUserIds);
  const devotionTodayUserId = getTopVisibleUserId(devotionToday, hiddenUserIds);
  const devotionMonthUserId = getTopVisibleUserId(devotionMonth, hiddenUserIds);
  const visibleLongestStreakUserId =
    longestStreakUserId && !hiddenUserIds.has(longestStreakUserId) ? longestStreakUserId : null;
  const allWinnerIds = [
    supporterTodayUserId,
    supporterWeekUserId,
    supporterMonthUserId,
    devotionTodayUserId,
    devotionMonthUserId,
    visibleLongestStreakUserId,
  ].filter((id): id is string => Boolean(id));

  const profiles = await loadCommunityProfiles(supabase, allWinnerIds);
  const hallCards: HallOfFameCardData[] = [
    {
      id: "supporter-today",
      title: "Biggest Supporter Today",
      metricLabel: "Supported today",
      metricValue: getTopValue(supporterToday, supporterTodayUserId),
      valueDisplay: getTopValue(supporterToday, supporterTodayUserId).toLocaleString(),
      winner: profiles.get(supporterTodayUserId ?? "") ?? null,
    },
    {
      id: "supporter-week",
      title: "Biggest Supporter This Week",
      metricLabel: "Supported this week",
      metricValue: getTopValue(supporterWeek, supporterWeekUserId),
      valueDisplay: getTopValue(supporterWeek, supporterWeekUserId).toLocaleString(),
      winner: profiles.get(supporterWeekUserId ?? "") ?? null,
    },
    {
      id: "supporter-month",
      title: "Biggest Supporter This Month",
      metricLabel: "Supported this month",
      metricValue: getTopValue(supporterMonth, supporterMonthUserId),
      valueDisplay: getTopValue(supporterMonth, supporterMonthUserId).toLocaleString(),
      winner: profiles.get(supporterMonthUserId ?? "") ?? null,
    },
    {
      id: "devotion-today",
      title: "Highest Devotion Today",
      metricLabel: "Devotion today",
      metricValue: getTopValue(devotionToday, devotionTodayUserId),
      valueDisplay: getTopValue(devotionToday, devotionTodayUserId).toLocaleString(),
      winner: profiles.get(devotionTodayUserId ?? "") ?? null,
    },
    {
      id: "devotion-month",
      title: "Highest Devotion This Month",
      metricLabel: "Devotion this month",
      metricValue: getTopValue(devotionMonth, devotionMonthUserId),
      valueDisplay: getTopValue(devotionMonth, devotionMonthUserId).toLocaleString(),
      winner: profiles.get(devotionMonthUserId ?? "") ?? null,
    },
    {
      id: "login-streak",
      title: "Longest Login Streak",
      metricLabel: "Current streak",
      metricValue: profiles.get(visibleLongestStreakUserId ?? "")?.loyaltyStreak ?? 0,
      valueDisplay: `${(profiles.get(visibleLongestStreakUserId ?? "")?.loyaltyStreak ?? 0).toLocaleString()} days`,
      winner: profiles.get(visibleLongestStreakUserId ?? "") ?? null,
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
