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

const galleryCatalog = [
  { id: "common-velvet-arrival", title: "Dollar Rain", image: "/gallery/common-1.png" },
  { id: "common-midnight-maid", title: "Leather Eclipse", image: "/gallery/common-2.png" },
  { id: "common-executive-glare", title: "Golden Lust", image: "/gallery/common-3.png" },
  { id: "common-rose-vault", title: "Silk & Vintage", image: "/gallery/common-4.png" },
  { id: "rare-loyal-glimpse", title: "Crimson Veil", image: "/gallery/rare-1.png" },
  { id: "rare-private-smile", title: "Campus Craving", image: "/gallery/rare-2.png" },
  { id: "rare-purple-obsession", title: "Gym Goddess", image: "/gallery/rare-3.png" },
  { id: "rare-golden-approval", title: "Midnight Kitten", image: "/gallery/rare-4.png" },
  { id: "divine-throne-room", title: "Sinful V", image: "/gallery/divine-1.png" },
  { id: "divine-goddess-mood", title: "Leopard Fever", image: "/gallery/divine-2.png" },
  { id: "divine-final-favor", title: "Naughty Present", image: "/gallery/divine-3.png" },
  { id: "divine-velvet-throne", title: "Witch's Desire", image: "/gallery/divine-4.png" },
  { id: "secret-defnes-final-favor", title: "Principessa's Final Favor", image: "/gallery/secret-1.png" },
  ...Array.from({ length: 10 }, (_, index) => ({
    id: `sacrifice-${index + 1}`,
    title: `Sacrifice Offering ${index + 1}`,
    image: `/gallery/sacrifice-${index + 1}.png`,
  })),
  ...Array.from({ length: 30 }, (_, index) => ({
    id: `pet:pet-gallery-${index + 1}`,
    title: `Pet Vault ${index + 1}`,
    image: `/gallery/pet-${index + 1}.png`,
  })),
];

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
  const selectedUserId = requestUrl.searchParams.get("userId")?.trim() ?? "";
  const supabase = admin.supabase;
  const dayKeys = lastDays(7);
  const sevenDaysAgo = `${dayKeys[0]}T00:00:00.000Z`;
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [
    totalProfilesCountResult,
    profilesResult,
    tasksResult,
    petTasksResult,
    irlTasksResult,
    galleryResult,
    petGalleryResult,
    overviewTransactionsResult,
    chartTransactionsResult,
    selectedTransactionsResult,
    debtResult,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
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
    supabase
      .from("coin_transactions")
      .select("id, user_id, amount, reason, balance_before, balance_after, created_at")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false })
      .limit(500),
    selectedUserId
      ? supabase
          .from("coin_transactions")
          .select("id, user_id, amount, reason, balance_before, balance_after, created_at")
          .eq("user_id", selectedUserId)
          .order("created_at", { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("pet_debt_contracts").select("id, status, debt_amount, paid_periods, missed_periods"),
  ]);

  const failed = [
    totalProfilesCountResult.error,
    profilesResult.error,
    tasksResult.error,
    petTasksResult.error,
    irlTasksResult.error,
    galleryResult.error,
    petGalleryResult.error,
    overviewTransactionsResult.error,
    chartTransactionsResult.error,
    selectedTransactionsResult.error,
    debtResult.error,
  ].find(Boolean);

  if (failed) {
    console.error("Admin analytics query failed", failed);
    return Response.json({ error: failed.message }, { status: 500 });
  }

  const profiles = (profilesResult.data ?? []) as ProfileRow[];
  const totalRegisteredUsers = totalProfilesCountResult.count ?? profiles.length;
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
  const overviewTransactions = (overviewTransactionsResult.data ?? []) as CoinRow[];
  const chartTransactions = (chartTransactionsResult.data ?? []) as CoinRow[];
  const selectedTransactions = (selectedTransactionsResult.data ?? []) as CoinRow[];
  const debts = debtResult.data ?? [];
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  const [registrationsByDay, activeByDay, newTodayResult] = await Promise.all([
    Promise.all(
      dayKeys.map(async (day) => {
        const nextDay = new Date(`${day}T00:00:00.000Z`);
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
        const { count, error } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .gte("created_at", `${day}T00:00:00.000Z`)
          .lt("created_at", nextDay.toISOString());

        if (error) {
          throw error;
        }

        return { day, count: count ?? 0 };
      }),
    ),
    Promise.all(
      dayKeys.map(async (day) => {
        const nextDay = new Date(`${day}T00:00:00.000Z`);
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
        const { count, error } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .gte("last_login_at", `${day}T00:00:00.000Z`)
          .lt("last_login_at", nextDay.toISOString());

        if (error) {
          throw error;
        }

        return { day, count: count ?? 0 };
      }),
    ),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString()),
  ]);

  if (newTodayResult.error) {
    console.error("Admin analytics daily registration count failed", newTodayResult.error);
    return Response.json({ error: newTodayResult.error.message }, { status: 500 });
  }

  const tributeByDay = dayKeys.map((day) => ({
    day,
    amount: chartTransactions
      .filter((row) => row.reason === "tribute" && dateKey(row.created_at) === day)
      .reduce((total, row) => total + Math.max(0, row.amount), 0),
  }));
  const coinNetByDay = dayKeys.map((day) => ({
    day,
    earned: chartTransactions
      .filter((row) => row.amount > 0 && dateKey(row.created_at) === day)
      .reduce((total, row) => total + row.amount, 0),
    spent: Math.abs(
      chartTransactions
        .filter((row) => row.amount < 0 && dateKey(row.created_at) === day)
        .reduce((total, row) => total + row.amount, 0),
    ),
  }));

  const taskUsage = countBy(
    taskRows.filter((row) => row.completed_at || row.claimed_at),
    (row) => row.task_id,
  );
  const galleryCountEntries = await Promise.all(
    galleryCatalog.map(async (item) => {
      const isPetItem = item.id.startsWith("pet:");
      const table = isPetItem ? "user_pet_gallery" : "user_gallery";
      const itemId = isPetItem ? item.id.replace(/^pet:/, "") : item.id;
      const { count, error } = await supabase
        .from(table)
        .select("user_id", { count: "exact", head: true })
        .eq("item_id", itemId);

      if (error) {
        throw error;
      }

      return [item.id, count ?? 0] as const;
    }),
  );
  const galleryCounts = new Map(galleryCountEntries);
  const galleryStats = galleryCatalog.map((item) => {
    const unlockedCount = galleryCounts.get(item.id) ?? 0;
    const totalEligibleUsers = totalRegisteredUsers;

    return {
      ...item,
      count: unlockedCount,
      key: item.id,
      totalEligibleUsers,
      unlockRate:
        totalEligibleUsers > 0 ? Math.round((unlockedCount / totalEligibleUsers) * 1000) / 10 : 0,
    };
  }).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
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

  const transactionHistory = selectedTransactions.map((transaction) => {
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
      totalRegisteredUsers,
      dailyActiveUsers: activeByDay.at(-1)?.count ?? 0,
      newRegistrationsToday: newTodayResult.count ?? 0,
      totalTributeReceived: sum(
        overviewTransactions,
        (row) => row.reason === "tribute" && row.amount > 0,
      ),
      totalCoinsEarned: sum(overviewTransactions, (row) => row.amount > 0),
      totalCoinsSpent: Math.abs(sum(overviewTransactions, (row) => row.amount < 0)),
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
