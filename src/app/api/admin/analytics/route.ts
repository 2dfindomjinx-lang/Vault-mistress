import { requireAdminProfile } from "@/lib/admin-guard";

const DAY_MS = 24 * 60 * 60 * 1000;

type ProfileRow = {
  id: string;
  username: string;
  email: string | null;
  avatar_url: string | null;
  coins: number | null;
  affection: number | null;
  tribute_total: number | null;
  loyalty_streak: number | null;
  owner_likeness: number | null;
  created_at: string | null;
  updated_at: string | null;
  last_login_at: string | null;
};

type CoinRow = {
  id: string;
  user_id: string;
  amount: number;
  reason: string | null;
  balance_before: number | null;
  balance_after: number | null;
  created_at: string;
};

type TaskRow = {
  user_id: string;
  task_id: string;
  completed_at: string | null;
  claimed_at: string | null;
  reward_coins?: number | null;
};

type GalleryRow = {
  user_id: string;
  item_id: string;
  unlocked_at: string | null;
};

function dateKey(value: string | null | undefined) {
  if (!value) {
    return "unknown";
  }

  return new Date(value).toISOString().slice(0, 10);
}

function lastDays(days: number) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today.getTime() - (days - index - 1) * DAY_MS);
    return date.toISOString().slice(0, 10);
  });
}

function sum(rows: CoinRow[], predicate: (row: CoinRow) => boolean) {
  return rows.reduce((total, row) => total + (predicate(row) ? row.amount : 0), 0);
}

function countBy<T>(rows: T[], getKey: (row: T) => string) {
  const counts = new Map<string, number>();

  rows.forEach((row) => {
    const key = getKey(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export async function GET(request: Request) {
  const admin = await requireAdminProfile();

  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  const requestUrl = new URL(request.url);
  const query = requestUrl.searchParams.get("query")?.trim().toLowerCase() ?? "";
  const supabase = admin.supabase;

  const [
    profilesResult,
    tasksResult,
    petTasksResult,
    irlTasksResult,
    galleryResult,
    petGalleryResult,
    transactionsResult,
    debtResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, email, avatar_url, coins, affection, tribute_total, loyalty_streak, owner_likeness, created_at, updated_at, last_login_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("user_tasks")
      .select("user_id, task_id, completed_at, claimed_at, reward_coins"),
    supabase
      .from("user_pet_tasks")
      .select("user_id, task_id, completed_at, claimed_at:reviewed_at"),
    supabase
      .from("user_irl_tasks")
      .select("user_id, task_id:task_label, completed_at, claimed_at:reviewed_at"),
    supabase.from("user_gallery").select("user_id, item_id, unlocked_at"),
    supabase.from("user_pet_gallery").select("user_id, item_id, unlocked_at"),
    supabase
      .from("coin_transactions")
      .select("id, user_id, amount, reason, balance_before, balance_after, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("pet_debt_contracts").select("id, status, debt_amount, paid_periods, missed_periods"),
  ]);

  const failed = [
    profilesResult.error,
    tasksResult.error,
    petTasksResult.error,
    irlTasksResult.error,
    galleryResult.error,
    petGalleryResult.error,
    transactionsResult.error,
    debtResult.error,
  ].find(Boolean);

  if (failed) {
    console.error("Admin analytics query failed", failed);
    return Response.json({ error: failed.message }, { status: 500 });
  }

  const profiles = (profilesResult.data ?? []) as ProfileRow[];
  const taskRows = [
    ...((tasksResult.data ?? []) as TaskRow[]),
    ...((petTasksResult.data ?? []) as TaskRow[]).map((row) => ({
      ...row,
      task_id: `pet:${row.task_id}`,
    })),
    ...((irlTasksResult.data ?? []) as TaskRow[]).map((row) => ({
      ...row,
      task_id: `irl:${row.task_id}`,
    })),
  ];
  const galleryRows = [
    ...((galleryResult.data ?? []) as GalleryRow[]),
    ...((petGalleryResult.data ?? []) as GalleryRow[]).map((row) => ({
      ...row,
      item_id: `pet:${row.item_id}`,
    })),
  ];
  const transactions = (transactionsResult.data ?? []) as CoinRow[];
  const debts = debtResult.data ?? [];
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const dayKeys = lastDays(14);
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const registrationsByDay = dayKeys.map((day) => ({
    day,
    count: profiles.filter((profile) => dateKey(profile.created_at) === day).length,
  }));
  const activeByDay = dayKeys.map((day) => ({
    day,
    count: profiles.filter((profile) => dateKey(profile.last_login_at) === day).length,
  }));
  const tributeByDay = dayKeys.map((day) => ({
    day,
    amount: transactions
      .filter((row) => row.reason === "tribute" && dateKey(row.created_at) === day)
      .reduce((total, row) => total + Math.max(0, row.amount), 0),
  }));
  const coinNetByDay = dayKeys.map((day) => ({
    day,
    earned: transactions
      .filter((row) => row.amount > 0 && dateKey(row.created_at) === day)
      .reduce((total, row) => total + row.amount, 0),
    spent: Math.abs(
      transactions
        .filter((row) => row.amount < 0 && dateKey(row.created_at) === day)
        .reduce((total, row) => total + row.amount, 0),
    ),
  }));

  const taskUsage = countBy(
    taskRows.filter((row) => row.completed_at || row.claimed_at),
    (row) => row.task_id,
  );
  const galleryStats = countBy(galleryRows, (row) => row.item_id);
  const affectionBuckets = [
    { label: "0-24", min: 0, max: 24 },
    { label: "25-49", min: 25, max: 49 },
    { label: "50-74", min: 50, max: 74 },
    { label: "75-99", min: 75, max: 99 },
    { label: "100", min: 100, max: Number.POSITIVE_INFINITY },
  ].map((bucket) => ({
    label: bucket.label,
    count: profiles.filter((profile) => {
      const affection = profile.affection ?? 0;
      return affection >= bucket.min && affection <= bucket.max;
    }).length,
  }));

  const completedTasksByUser = countBy(
    taskRows.filter((row) => row.completed_at || row.claimed_at),
    (row) => row.user_id,
  );
  const galleryByUser = countBy(galleryRows, (row) => row.user_id);
  const completedTaskMap = new Map(completedTasksByUser.map((entry) => [entry.key, entry.count]));
  const galleryMap = new Map(galleryByUser.map((entry) => [entry.key, entry.count]));

  const users = profiles.map((profile) => ({
    id: profile.id,
    username: profile.username,
    email: profile.email,
    avatarUrl: profile.avatar_url,
    registrationDate: profile.created_at,
    lastLogin: profile.last_login_at,
    coins: profile.coins ?? 0,
    affection: profile.affection ?? 0,
    tributeTotal: profile.tribute_total ?? 0,
    loyaltyStreak: profile.loyalty_streak ?? 0,
    completedTasks: completedTaskMap.get(profile.id) ?? 0,
    galleryProgress: galleryMap.get(profile.id) ?? 0,
  }));

  const matchedUsers = query
    ? users.filter((user) =>
        user.username.toLowerCase().includes(query) ||
        String(user.email ?? "").toLowerCase().includes(query),
      )
    : users.slice(0, 20);

  const transactionHistory = transactions.map((transaction) => {
    const profile = profileById.get(transaction.user_id);

    return {
      id: transaction.id,
      userId: transaction.user_id,
      username: profile?.username ?? "unknown",
      avatarUrl: profile?.avatar_url ?? null,
      amount: transaction.amount,
      reason: transaction.reason,
      balanceBefore: transaction.balance_before,
      balanceAfter: transaction.balance_after,
      createdAt: transaction.created_at,
    };
  });

  return Response.json({
    overview: {
      totalRegisteredUsers: profiles.length,
      dailyActiveUsers: profiles.filter((profile) => {
        if (!profile.last_login_at) {
          return false;
        }
        return new Date(profile.last_login_at).getTime() >= todayStart.getTime();
      }).length,
      newRegistrationsToday: profiles.filter(
        (profile) => dateKey(profile.created_at) === dateKey(todayStart.toISOString()),
      ).length,
      totalTributeReceived: sum(
        transactions,
        (row) => row.reason === "tribute" && row.amount > 0,
      ),
      totalCoinsEarned: sum(transactions, (row) => row.amount > 0),
      totalCoinsSpent: Math.abs(sum(transactions, (row) => row.amount < 0)),
      totalCoinsInCirculation: profiles.reduce(
        (total, profile) => total + Number(profile.coins ?? 0),
        0,
      ),
      averageCoins:
        profiles.length > 0
          ? Math.round(
              profiles.reduce((total, profile) => total + Number(profile.coins ?? 0), 0) /
                profiles.length,
            )
          : 0,
      activeDebtContracts: debts.filter((debt) => debt.status === "active").length,
      missedDebtPeriods: debts.reduce(
        (total, debt) => total + Number(debt.missed_periods ?? 0),
        0,
      ),
      ownerLikenessWarnings: profiles.filter(
        (profile) => Number(profile.owner_likeness ?? 100) <= 25,
      ).length,
    },
    charts: {
      registrationsByDay,
      activeByDay,
      tributeByDay,
      coinNetByDay,
      affectionBuckets,
      taskUsage,
      leastUsedTasks: [...taskUsage].reverse().slice(0, 10),
      galleryStats,
    },
    users,
    matchedUsers,
    transactionHistory,
  });
}
