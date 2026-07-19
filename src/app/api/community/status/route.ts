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
import { isTrustedAdminUserId } from "@/lib/admin-identity";
import type { SupabaseClient } from "@supabase/supabase-js";

type MinimalProfileRow = {
  id: string;
  loyalty_streak: number | null;
};

type GoalProfileRow = {
  id: string;
  is_admin: boolean | null;
};

type CommunityMetrics = {
  currentUserContributionCoins: number;
  currentUserParticipating: boolean;
  devotionMonthUserId: string | null;
  devotionMonthValue: number;
  devotionTodayUserId: string | null;
  devotionTodayValue: number;
  goalParticipantCount: number;
  goalProgressCoins: number;
  longestStreakUserId: string | null;
  longestStreakValue: number;
  supporterMonthUserId: string | null;
  supporterMonthValue: number;
  supporterTodayUserId: string | null;
  supporterTodayValue: number;
  supporterWeekUserId: string | null;
  supporterWeekValue: number;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function sumAmountsByUser(rows: CoinTransactionLite[], startMs: number, endMs: number) {
  const totals = new Map<string, number>();

  rows.forEach((row) => {
    if (!row.user_id || !row.created_at) return;
    const createdAtMs = new Date(row.created_at).getTime();
    if (createdAtMs < startMs || createdAtMs >= endMs) return;
    totals.set(row.user_id, (totals.get(row.user_id) ?? 0) + Math.abs(Number(row.amount ?? 0)));
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
    if (createdAtMs < startMs || createdAtMs >= endMs) return;
    totals.set(row.user_id, (totals.get(row.user_id) ?? 0) + resolver(row));
  });

  return totals;
}

function getTopVisibleEntry(metricMap: Map<string, number>, hiddenUserIds: Set<string>) {
  return Array.from(metricMap.entries())
    .filter(([userId]) => !hiddenUserIds.has(userId))
    .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))[0] ?? null;
}

function asNullableId(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function asNumber(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function normalizeAggregate(value: unknown): CommunityMetrics | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;

  return {
    currentUserContributionCoins: asNumber(row.currentUserContributionCoins),
    currentUserParticipating: Boolean(row.currentUserParticipating),
    devotionMonthUserId: asNullableId(row.devotionMonthUserId),
    devotionMonthValue: asNumber(row.devotionMonthValue),
    devotionTodayUserId: asNullableId(row.devotionTodayUserId),
    devotionTodayValue: asNumber(row.devotionTodayValue),
    goalParticipantCount: asNumber(row.goalParticipantCount),
    goalProgressCoins: asNumber(row.goalProgressCoins),
    longestStreakUserId: asNullableId(row.longestStreakUserId),
    longestStreakValue: asNumber(row.longestStreakValue),
    supporterMonthUserId: asNullableId(row.supporterMonthUserId),
    supporterMonthValue: asNumber(row.supporterMonthValue),
    supporterTodayUserId: asNullableId(row.supporterTodayUserId),
    supporterTodayValue: asNumber(row.supporterTodayValue),
    supporterWeekUserId: asNullableId(row.supporterWeekUserId),
    supporterWeekValue: asNumber(row.supporterWeekValue),
  };
}

async function loadLegacyMetrics(
  supabase: SupabaseClient,
  userId: string,
  nowMs: number,
): Promise<CommunityMetrics> {
  const dayStartMs = getGmt3DayStart(nowMs);
  const weekStartMs = getGmt3WeekStart(nowMs);
  const monthStartMs = getGmt3MonthStart(nowMs);
  const currentGoal = getCurrentCommunityGoal(nowMs);

  const [supportResult, devotionResult, streakResult] = await Promise.all([
    supabase
      .from("coin_transactions")
      .select("user_id, amount, created_at, metadata, reason")
      .in("reason", ["live_gift", "throne_tribute", "tribute:coin-offer", "tribute:sacrifice", "tribute:support"])
      .gte("created_at", new Date(monthStartMs).toISOString()),
    supabase
      .from("devotion_events")
      .select("user_id, amount, created_at")
      .gte("created_at", new Date(monthStartMs).toISOString()),
    supabase
      .from("profiles")
      .select("id, loyalty_streak")
      .eq("hide_from_leaderboard", false)
      .eq("is_admin", false)
      .order("loyalty_streak", { ascending: false })
      .limit(10),
  ]);
  const failed = [supportResult.error, devotionResult.error, streakResult.error].find(Boolean);
  if (failed) throw failed;

  // PostgREST caps an unpaged select (normally at 1,000 rows). The original
  // compatibility path therefore froze once the goal window crossed that
  // limit and silently discarded newer transactions. Keep this fallback
  // correct until the aggregate RPC is installed in production.
  const goalTransactions: CoinTransactionLite[] = [];
  const goalPageSize = 1_000;
  for (let offset = 0; ; offset += goalPageSize) {
    const goalPage = await supabase
      .from("coin_transactions")
      .select("id, user_id, amount, created_at, metadata, reason")
      .gte("created_at", currentGoal.startsAt)
      .lt("created_at", currentGoal.endsAt)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + goalPageSize - 1);

    if (goalPage.error) throw goalPage.error;
    const rows = (goalPage.data ?? []) as CoinTransactionLite[];
    goalTransactions.push(...rows);
    if (rows.length < goalPageSize) break;
  }

  const supportRows = ((supportResult.data ?? []) as CoinTransactionLite[]).filter((row) => {
    if (["throne_tribute", "tribute:coin-offer", "tribute:sacrifice", "tribute:support"].includes(row.reason ?? "")) return true;
    if (row.reason !== "live_gift") return false;
    const metadata = row.metadata ?? {};
    return metadata.command === "give" || metadata.kind === "manual_coin_purchase" || metadata.source === "throne";
  });
  const devotionRows = (devotionResult.data ?? []) as Array<{ amount: number; created_at: string; user_id: string }>;
  const streakRows = (streakResult.data ?? []) as MinimalProfileRow[];
  const supporterToday = sumAmountsByUser(supportRows, dayStartMs, nowMs + 1);
  const supporterWeek = sumAmountsByUser(supportRows, weekStartMs, nowMs + 1);
  const supporterMonth = sumAmountsByUser(supportRows, monthStartMs, nowMs + 1);
  const devotionToday = sumSimpleMetricByUser(devotionRows, dayStartMs, nowMs + 1, (row) => Number(row.amount ?? 0));
  const devotionMonth = sumSimpleMetricByUser(devotionRows, monthStartMs, nowMs + 1, (row) => Number(row.amount ?? 0));
  const candidateIds = Array.from(new Set([
    ...supporterToday.keys(),
    ...supporterWeek.keys(),
    ...supporterMonth.keys(),
    ...devotionToday.keys(),
    ...devotionMonth.keys(),
  ]));
  const hiddenResult = candidateIds.length
    ? await supabase.from("profiles").select("id").in("id", candidateIds).or("hide_from_leaderboard.eq.true,is_admin.eq.true")
    : { data: [], error: null };
  if (hiddenResult.error) throw hiddenResult.error;
  const hiddenUserIds = new Set((hiddenResult.data ?? []).map((row) => row.id));
  const goalUserIds = Array.from(
    new Set(goalTransactions.map((row) => row.user_id).filter((id): id is string => Boolean(id))),
  );
  const goalProfilesResult = goalUserIds.length
    ? await supabase.from("profiles").select("id, is_admin").in("id", goalUserIds)
    : { data: [], error: null };
  if (goalProfilesResult.error) throw goalProfilesResult.error;
  const goalAdminUserIds = new Set(
    ((goalProfilesResult.data ?? []) as GoalProfileRow[])
      .filter((profile) => profile.is_admin)
      .map((profile) => profile.id),
  );
  const goalStatus = buildCommunityGoalStatus(currentGoal, goalTransactions, userId, goalAdminUserIds);
  const todaySupport = getTopVisibleEntry(supporterToday, hiddenUserIds);
  const weekSupport = getTopVisibleEntry(supporterWeek, hiddenUserIds);
  const monthSupport = getTopVisibleEntry(supporterMonth, hiddenUserIds);
  const todayDevotion = getTopVisibleEntry(devotionToday, hiddenUserIds);
  const monthDevotion = getTopVisibleEntry(devotionMonth, hiddenUserIds);
  const longestStreak = streakRows[0] ?? null;

  return {
    currentUserContributionCoins: goalStatus.currentUserContributionCoins,
    currentUserParticipating: goalStatus.currentUserParticipating,
    devotionMonthUserId: monthDevotion?.[0] ?? null,
    devotionMonthValue: monthDevotion?.[1] ?? 0,
    devotionTodayUserId: todayDevotion?.[0] ?? null,
    devotionTodayValue: todayDevotion?.[1] ?? 0,
    goalParticipantCount: goalStatus.participantCount,
    goalProgressCoins: goalStatus.progressCoins,
    longestStreakUserId: longestStreak?.id ?? null,
    longestStreakValue: Number(longestStreak?.loyalty_streak ?? 0),
    supporterMonthUserId: monthSupport?.[0] ?? null,
    supporterMonthValue: monthSupport?.[1] ?? 0,
    supporterTodayUserId: todaySupport?.[0] ?? null,
    supporterTodayValue: todaySupport?.[1] ?? 0,
    supporterWeekUserId: weekSupport?.[0] ?? null,
    supporterWeekValue: weekSupport?.[1] ?? 0,
  };
}

async function loadCommunityMetrics(supabase: SupabaseClient, userId: string, nowMs: number) {
  const currentGoal = getCurrentCommunityGoal(nowMs);
  const { data, error } = await supabase.rpc("get_community_status_aggregates", {
    p_day_start: new Date(getGmt3DayStart(nowMs)).toISOString(),
    p_goal_end: currentGoal.endsAt,
    p_goal_reasons: currentGoal.includedReasons,
    p_goal_start: currentGoal.startsAt,
    p_month_start: new Date(getGmt3MonthStart(nowMs)).toISOString(),
    p_now: new Date(nowMs).toISOString(),
    p_user_id: userId,
    p_week_start: new Date(getGmt3WeekStart(nowMs)).toISOString(),
  });
  const aggregate = error ? null : normalizeAggregate(data);
  if (aggregate) return aggregate;

  if (error && error.code !== "PGRST202" && error.code !== "42883") {
    console.warn("Community aggregate RPC unavailable; using compatibility query path", error.message);
  }
  return loadLegacyMetrics(supabase, userId, nowMs);
}

async function synchronizeTrustedAdminProfile(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
) {
  // Admin access is deliberately controlled by ADMIN_USER_IDS. The database
  // aggregate/RPC uses profiles.is_admin, so keep that server-owned flag in
  // sync before any Community Goal calculation or reward grant runs.
  if (!isTrustedAdminUserId(userId)) return;

  const { error } = await supabase
    .from("profiles")
    .update({ is_admin: true })
    .eq("id", userId)
    .or("is_admin.eq.false,is_admin.is.null");

  if (error) {
    throw error;
  }
}

export async function GET() {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();
  if (authError || !authData.user) return jsonError(authError?.message ?? "Authentication required.", 401);

  try {
    const supabase = createSupabaseAdminClient();
    const nowMs = Date.now();
    const currentGoal = getCurrentCommunityGoal(nowMs);
    await synchronizeTrustedAdminProfile(supabase, authData.user.id);
    const metrics = await loadCommunityMetrics(supabase, authData.user.id, nowMs);
    if (metrics.goalProgressCoins >= currentGoal.targetCoins) {
      const { error: rewardError } = await supabase.rpc("grant_community_goal_rewards", {
        p_badge_id: currentGoal.rewardBadgeId ?? null,
        p_crate_type: currentGoal.rewardCrateType ?? null,
        p_free_opens: currentGoal.rewardFreeOpens ?? 0,
        p_goal_end: currentGoal.endsAt,
        p_goal_id: currentGoal.id,
        p_goal_reasons: currentGoal.includedReasons,
        p_goal_start: currentGoal.startsAt,
        p_target_coins: currentGoal.targetCoins,
      });
      if (rewardError && rewardError.code !== "PGRST202" && rewardError.code !== "42883") {
        console.error("Community goal bulk reward grant failed", rewardError.message);
      }
    }
    const currentUserBadges = await syncCurrentUserPrestige(supabase, authData.user.id, {
      currentUserParticipating: metrics.currentUserParticipating,
      progressCoins: metrics.goalProgressCoins,
    });
    const winnerIds = [
      metrics.supporterTodayUserId,
      metrics.supporterWeekUserId,
      metrics.supporterMonthUserId,
      metrics.devotionTodayUserId,
      metrics.devotionMonthUserId,
      metrics.longestStreakUserId,
    ].filter((id): id is string => Boolean(id));
    const profiles = await loadCommunityProfiles(supabase, winnerIds);
    const cards: HallOfFameCardData[] = [
      ["supporter-today", "Biggest Supporter Today", "Supported today", metrics.supporterTodayValue, metrics.supporterTodayUserId, "coins"],
      ["supporter-week", "Biggest Supporter This Week", "Supported this week", metrics.supporterWeekValue, metrics.supporterWeekUserId, "coins"],
      ["supporter-month", "Biggest Supporter This Month", "Supported this month", metrics.supporterMonthValue, metrics.supporterMonthUserId, "coins"],
      ["devotion-today", "Highest Devotion Today", "Devotion today", metrics.devotionTodayValue, metrics.devotionTodayUserId, "coins"],
      ["devotion-month", "Highest Devotion This Month", "Devotion this month", metrics.devotionMonthValue, metrics.devotionMonthUserId, "coins"],
      ["login-streak", "Longest Login Streak", "Current streak", metrics.longestStreakValue, metrics.longestStreakUserId, "days"],
    ].map(([id, title, metricLabel, value, userId, suffix]) => ({
      id: String(id),
      metricLabel: String(metricLabel),
      metricValue: Number(value),
      title: String(title),
      valueDisplay: suffix === "days" ? `${Number(value).toLocaleString()} days` : Number(value).toLocaleString(),
      winner: profiles.get(String(userId ?? "")) ?? null,
    }));
    const baseGoal = buildCommunityGoalStatus(currentGoal, [], authData.user.id);
    const progressCoins = metrics.goalProgressCoins;

    return Response.json({
      communityGoal: {
        ...baseGoal,
        currentUserContributionCoins: metrics.currentUserContributionCoins,
        currentUserParticipating: metrics.currentUserParticipating,
        participantCount: metrics.goalParticipantCount,
        progressCoins,
        progressPercent: Math.min(100, Math.round((progressCoins / baseGoal.targetCoins) * 100)),
      },
      currentUserBadges,
      hallOfFame: cards,
    });
  } catch (error) {
    console.error("Community status lookup failed", error);
    return jsonError(error instanceof Error ? error.message : "Community prestige could not be loaded.", 500);
  }
}
