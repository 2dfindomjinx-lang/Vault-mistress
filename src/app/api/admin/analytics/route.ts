import { requireAdminProfile } from "@/lib/admin-guard";
import { SAMPLE_CRATE_ITEMS } from "@/lib/crates";

const DAY_MS = 24 * 60 * 60 * 1000;
const GMT3_OFFSET_MS = 3 * 60 * 60 * 1000;
const ANALYTICS_PAGE_SIZE = 1000;

type ProfileRow = {
  id: string;
  username: string;
  display_name: string | null;
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

type CrateInventoryRow = {
  user_id: string;
  item_id: string;
  variant: string | null;
  quantity: number | null;
};

type CrateItemRow = {
  item_id: string;
  name: string;
  rarity: string;
  sell_value: number | null;
};

type CoinRow = {
  id: string;
  user_id: string;
  amount: number;
  reason: string | null;
  balance_before: number | null;
  balance_after: number | null;
  metadata: Record<string, unknown> | null;
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

type TopInventoryItem = {
  itemId: string;
  name: string;
  rarity: string;
  variant: string;
  quantity: number;
  sellValue: number;
  subtotal: number;
};

type TopInventoryUser = {
  id: string;
  username: string;
  rawUsername: string;
  displayName: string | null;
  avatarUrl: string | null;
  inventoryValue: number;
  totalQuantity: number;
  distinctItems: number;
  items: TopInventoryItem[];
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

function dateKeyGmt3(value: string | null | undefined) {
  if (!value) {
    return "unknown";
  }

  return new Date(new Date(value).getTime() + GMT3_OFFSET_MS).toISOString().slice(0, 10);
}

function lastDays(days: number) {
  const today = new Date(Date.now() + GMT3_OFFSET_MS);
  today.setUTCHours(0, 0, 0, 0);

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today.getTime() - (days - index - 1) * DAY_MS);
    return date.toISOString().slice(0, 10);
  });
}

function gmt3DayWindow(day: string) {
  const startMs = new Date(`${day}T00:00:00.000Z`).getTime() - GMT3_OFFSET_MS;
  const endMs = startMs + DAY_MS;

  return {
    end: new Date(endMs).toISOString(),
    start: new Date(startMs).toISOString(),
  };
}

function currentGmt3DayWindow() {
  const todayKey = dateKeyGmt3(new Date().toISOString());
  const window = gmt3DayWindow(todayKey);

  return {
    ...window,
    day: todayKey,
    resetAt: window.end,
  };
}

function isTributeTransaction(row: CoinRow) {
  const reason = row.reason ?? "";

  return reason === "tribute" || reason.startsWith("tribute:");
}

function getTributeReceivedAmount(row: CoinRow) {
  if (!isTributeTransaction(row)) {
    return 0;
  }

  return row.amount < 0 ? Math.abs(row.amount) : Math.max(0, row.amount);
}

function getCoinsEarnedAmount(row: CoinRow) {
  return Math.max(0, row.amount);
}

function getCoinsSpentAmount(row: CoinRow) {
  return Math.abs(Math.min(0, row.amount));
}

function getTransactionReasonLabel(row: CoinRow) {
  const reason = row.reason ?? "unknown";
  const metadata = row.metadata ?? {};

  if (reason === "crate:open") {
    const crateType = typeof metadata["crate_type"] === "string" ? metadata["crate_type"] : "crate";
    return `Crate Open · ${crateType}`;
  }

  if (reason === "crate:sell") {
    return "Crate Sell";
  }

  if (reason === "crate:sell_all") {
    return "Crate Sell All";
  }

  return reason.replace(/:/g, " · ");
}

function getTransactionDetail(row: CoinRow) {
  const metadata = row.metadata ?? {};

  if (row.reason === "crate:open") {
    const itemId = typeof metadata["item_id"] === "string" ? metadata["item_id"] : null;
    const rarity = typeof metadata["rarity"] === "string" ? metadata["rarity"] : null;
    const variant = typeof metadata["variant"] === "string" ? metadata["variant"] : null;

    return [itemId ? `Item ${itemId}` : null, rarity ? `Rarity ${rarity}` : null, variant ? `Variant ${variant}` : null]
      .filter(Boolean)
      .join(" · ");
  }

  if (row.reason === "crate:sell") {
    const itemId = typeof metadata["item_id"] === "string" ? metadata["item_id"] : null;
    const quantity = typeof metadata["quantity"] === "number" ? metadata["quantity"] : null;
    const rarity = typeof metadata["rarity"] === "string" ? metadata["rarity"] : null;

    return [itemId ? `Item ${itemId}` : null, quantity !== null ? `Qty ${quantity}` : null, rarity ? `Rarity ${rarity}` : null]
      .filter(Boolean)
      .join(" · ");
  }

  if (row.reason === "crate:sell_all") {
    const itemCount = typeof metadata["item_count"] === "number" ? metadata["item_count"] : null;
    return itemCount !== null ? `Sold ${itemCount} item stacks` : "Bulk inventory sale";
  }

  return "";
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

const taskLabelMap: Record<string, string> = {
  "affection": "Reach 50 Affection",
  "affection-80": "Reach 80 Affection",
  "beg": "Beg",
  "daily-login": "Daily Login",
  "high-low": "Higher or Lower",
  "irl-task-wheel": "IRL Task Wheel",
  "number-pick": "Number Pick",
  "sacrifice": "Sacrifice",
  "streak-bonus-1": "1 Day Streak Bonus",
  "streak-bonus-3": "3 Day Streak Bonus",
  "streak-bonus-7": "7 Day Streak Bonus",
  "streak-bonus-15": "15 Day Streak Bonus",
  "streak-bonus-30": "30 Day Streak Bonus",
  "support": "Support",
  "timeout-risk": "Risk My Freedom",
  "typing-accuracy": "Typing Accuracy",
  "wait-obediently": "Wait Obediently",
  "pet:pet-affection-claim": "Pet Affection Claim",
  "pet:pet-case-opening": "Pet Case Opening",
  "pet:pet-confession-dm": "Confession Repetition",
  "pet:pet-daily-report": "Small Dick Touching Journal",
  "pet:pet-debt-contract": "Debt Contract",
  "pet:pet-evil-wait": "Evil Wait Obediently",
  "pet:pet-false-hope": "Obedience Sequence",
  "pet:pet-favor-roulette": "Favor Roulette",
  "pet:pet-perfect-writing": "Perfect Pet Writing",
  "pet:pet-twitter-post": "X Post Assignment",
  "pet:pet-voice-proof": "Voice Proof",
  "pet:pet-weekly-throne-tax": "Weekly Throne Tax",
};

function titleizeTaskId(taskId: string) {
  return taskId
    .replace(/^pet:/, "")
    .replace(/^irl:/, "")
    .replace(/^pet-/, "")
    .split(/[-_:]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getTaskLabel(taskId: string) {
  if (taskLabelMap[taskId]) {
    return taskLabelMap[taskId];
  }

  if (taskId.startsWith("irl:")) {
    return taskId.replace(/^irl:/, "") || "IRL Task";
  }

  return titleizeTaskId(taskId);
}

async function fetchAllRows<T>(createQuery: () => {
  range: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
}) {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + ANALYTICS_PAGE_SIZE - 1;
    const { data, error } = await createQuery().range(from, to);

    if (error) {
      throw error;
    }

    const page = (data ?? []) as T[];
    rows.push(...page);

    if (page.length < ANALYTICS_PAGE_SIZE) {
      break;
    }

    from += ANALYTICS_PAGE_SIZE;
  }

  return rows;
}

async function countAuthUsers(supabase: {
  auth: {
    admin: {
      listUsers: (params: { page: number; perPage: number }) => Promise<{
        data: { users?: unknown[] };
        error: { message: string } | null;
      }>;
    };
  };
}) {
  let page = 1;
  let total = 0;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: ANALYTICS_PAGE_SIZE,
    });

    if (error) {
      console.error("Admin analytics auth users count failed", error);
      return null;
    }

    const users = data.users ?? [];
    total += users.length;

    if (users.length < ANALYTICS_PAGE_SIZE) {
      break;
    }

    page += 1;
  }

  return total;
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
  const sevenDaysAgo = gmt3DayWindow(dayKeys[0]).start;
  const todayWindow = currentGmt3DayWindow();

  const [
    authUsersCount,
    totalProfilesCountResult,
    profiles,
    inventoryRows,
    userTaskRows,
    petTaskRows,
    irlTaskRows,
    userGalleryRows,
    petGalleryRows,
    overviewTransactions,
    chartTransactions,
    selectedTransactionsResult,
    debts,
  ] = await Promise.all([
    countAuthUsers(supabase),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    fetchAllRows<ProfileRow>(() =>
      supabase
        .from("profiles")
      .select("id, username, avatar_url, coins, affection, tribute_total, loyalty_streak, owner_likeness, created_at, updated_at, last_login_at")
        .order("created_at", { ascending: false }),
    ),
    fetchAllRows<CrateInventoryRow>(() =>
      supabase.from("user_crate_inventory").select("user_id, item_id, variant, quantity"),
    ),
    fetchAllRows<TaskRow>(() =>
      supabase
        .from("user_tasks")
        .select("user_id, task_id, completed_at, claimed_at, reward_coins"),
    ),
    fetchAllRows<TaskRow>(() =>
      supabase
        .from("user_pet_tasks")
        .select("user_id, task_id, completed_at, claimed_at:reviewed_at"),
    ),
    fetchAllRows<TaskRow>(() =>
      supabase
        .from("user_irl_tasks")
        .select("user_id, task_id:task_label, completed_at, claimed_at:reviewed_at"),
    ),
    fetchAllRows<GalleryRow>(() => supabase.from("user_gallery").select("user_id, item_id, unlocked_at")),
    fetchAllRows<GalleryRow>(() => supabase.from("user_pet_gallery").select("user_id, item_id, unlocked_at")),
    fetchAllRows<CoinRow>(() =>
      supabase
        .from("coin_transactions")
        .select("id, user_id, amount, reason, balance_before, balance_after, metadata, created_at")
        .gte("created_at", todayWindow.start)
        .lt("created_at", todayWindow.end)
        .order("created_at", { ascending: false }),
    ),
    fetchAllRows<CoinRow>(() =>
      supabase
        .from("coin_transactions")
        .select("id, user_id, amount, reason, balance_before, balance_after, metadata, created_at")
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false }),
    ),
    selectedUserId
      ? supabase
          .from("coin_transactions")
          .select("id, user_id, amount, reason, balance_before, balance_after, metadata, created_at")
          .eq("user_id", selectedUserId)
          .order("created_at", { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [], error: null }),
    fetchAllRows<{ id: string; status: string; debt_amount: number; paid_periods: number; missed_periods: number }>(() =>
      supabase.from("pet_debt_contracts").select("id, status, debt_amount, paid_periods, missed_periods"),
    ),
  ]);

  const failed = [
    totalProfilesCountResult.error,
    selectedTransactionsResult.error,
  ].find(Boolean);

  if (failed) {
    console.error("Admin analytics query failed", failed);
    return Response.json({ error: failed.message }, { status: 500 });
  }

  const totalRegisteredUsers = totalProfilesCountResult.count ?? profiles.length;
  const taskRows = [
    ...userTaskRows,
    ...petTaskRows.map((row) => ({
      ...row,
      task_id: `pet:${row.task_id}`,
    })),
    ...irlTaskRows.map((row) => ({
      ...row,
      task_id: `irl:${row.task_id}`,
    })),
  ];
  const galleryRows = [
    ...userGalleryRows,
    ...petGalleryRows.map((row) => ({
      ...row,
      item_id: `pet:${row.item_id}`,
    })),
  ];
  const selectedTransactions = (selectedTransactionsResult.data ?? []) as CoinRow[];
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  const uniqueInventoryItemIds = Array.from(
    new Set((inventoryRows as CrateInventoryRow[]).map((row) => row.item_id).filter(Boolean)),
  );
  const sampleInventoryItemMap = new Map(
    Object.entries(SAMPLE_CRATE_ITEMS).map(([itemId, item]) => [
      itemId,
      {
        item_id: itemId,
        name: item.name,
        rarity: item.rarity,
        sell_value: item.sell_value,
      } satisfies CrateItemRow,
    ]),
  );
  const missingInventoryItemIds = uniqueInventoryItemIds.filter((itemId) => !sampleInventoryItemMap.has(itemId));
  const { data: missingInventoryItemRows } = missingInventoryItemIds.length > 0
    ? await supabase
        .from("crate_items")
        .select("item_id, name, rarity, sell_value")
        .in("item_id", missingInventoryItemIds)
    : { data: [] };
  const inventoryItemMap = new Map<string, CrateItemRow>();
  for (const [itemId, item] of sampleInventoryItemMap.entries()) {
    inventoryItemMap.set(itemId, item);
  }
  for (const row of (missingInventoryItemRows ?? []) as CrateItemRow[]) {
    inventoryItemMap.set(row.item_id, row);
  }

  const [registrationsByDay, activeByDay, newTodayResult] = await Promise.all([
    Promise.all(
      dayKeys.map(async (day) => {
        const window = gmt3DayWindow(day);
        const { count, error } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .gte("created_at", window.start)
          .lt("created_at", window.end);

        if (error) {
          throw error;
        }

        return { day, count: count ?? 0 };
      }),
    ),
    Promise.all(
      dayKeys.map(async (day) => {
        const window = gmt3DayWindow(day);
        const { count, error } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .gte("last_login_at", window.start)
          .lt("last_login_at", window.end);

        if (error) {
          throw error;
        }

        return { day, count: count ?? 0 };
      }),
    ),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayWindow.start)
      .lt("created_at", todayWindow.end),
  ]);

  if (newTodayResult.error) {
    console.error("Admin analytics daily registration count failed", newTodayResult.error);
    return Response.json({ error: newTodayResult.error.message }, { status: 500 });
  }

  const tributeByDay = dayKeys.map((day) => ({
    day,
    amount: chartTransactions
      .filter((row) => dateKeyGmt3(row.created_at) === day)
      .reduce((total, row) => total + getTributeReceivedAmount(row), 0),
  }));
  const coinNetByDay = dayKeys.map((day) => ({
    day,
    earned: chartTransactions
      .filter((row) => dateKeyGmt3(row.created_at) === day)
      .reduce((total, row) => total + getCoinsEarnedAmount(row), 0),
    spent: chartTransactions
      .filter((row) => dateKeyGmt3(row.created_at) === day)
      .reduce((total, row) => total + getCoinsSpentAmount(row), 0),
  }));

  const taskUsage = countBy(
    taskRows.filter((row) => row.completed_at || row.claimed_at),
    (row) => row.task_id,
  ).map((entry) => ({ ...entry, label: getTaskLabel(entry.key) }));
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
  const inventoryRowsByUser = new Map<string, CrateInventoryRow[]>();
  for (const row of inventoryRows as CrateInventoryRow[]) {
    const current = inventoryRowsByUser.get(row.user_id) ?? [];
    current.push(row);
    inventoryRowsByUser.set(row.user_id, current);
  }

  const topInventoryUsers: TopInventoryUser[] = profiles
    .map((profile) => {
      const rows = inventoryRowsByUser.get(profile.id) ?? [];
      const itemMap = new Map<string, TopInventoryItem>();

      for (const row of rows) {
        const itemDef = inventoryItemMap.get(row.item_id);
        const quantity = Math.max(0, Number(row.quantity ?? 0));
        const sellValue = Math.max(0, Number(itemDef?.sell_value ?? 0));
        const variant = row.variant ?? "normal";
        const itemKey = `${row.item_id}:${variant}`;
        const subtotal = quantity * sellValue;

        const existing = itemMap.get(itemKey);
        if (existing) {
          existing.quantity += quantity;
          existing.subtotal += subtotal;
          continue;
        }

        itemMap.set(itemKey, {
          itemId: row.item_id,
          name: itemDef?.name ?? row.item_id,
          rarity: itemDef?.rarity ?? "unknown",
          variant,
          quantity,
          sellValue,
          subtotal,
        });
      }

      const items = Array.from(itemMap.values()).sort((a, b) => b.subtotal - a.subtotal || a.name.localeCompare(b.name));
      const inventoryValue = items.reduce((sum, item) => sum + item.subtotal, 0);
      const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

      return {
    id: profile.id,
    username: profile.username,
    rawUsername: profile.username,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
    inventoryValue,
        totalQuantity,
        distinctItems: items.length,
        items,
      };
    })
    .filter((entry) => entry.inventoryValue > 0)
    .sort((a, b) => b.inventoryValue - a.inventoryValue || a.username.localeCompare(b.username))
    .slice(0, 20);

  const users = profiles.map((profile) => ({
    id: profile.id,
    username: profile.username,
    rawUsername: profile.username,
    displayName: profile.display_name,
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
        (user.rawUsername ?? user.username).toLowerCase().includes(query) ||
        user.id.toLowerCase().includes(query),
      )
    : users.slice(0, 20);

  const transactionHistory = selectedTransactions.map((transaction) => {
    const profile = profileById.get(transaction.user_id);

      return {
        id: transaction.id,
        userId: transaction.user_id,
        username: profile?.username ?? "unknown",
        rawUsername: profile?.username ?? "unknown",
        displayName: profile?.display_name ?? null,
        avatarUrl: profile?.avatar_url ?? null,
        amount: transaction.amount,
        reason: transaction.reason,
        reasonLabel: getTransactionReasonLabel(transaction),
        detail: getTransactionDetail(transaction),
        metadata: transaction.metadata,
        balanceBefore: transaction.balance_before,
        balanceAfter: transaction.balance_after,
        createdAt: transaction.created_at,
      };
    });

  return Response.json({
    overview: {
      authRegisteredUsers: authUsersCount ?? totalRegisteredUsers,
      coinMetricScope: "daily_gmt3",
      nextResetAt: todayWindow.resetAt,
      profilesMissingFromAuthUsers: Math.max(0, (authUsersCount ?? totalRegisteredUsers) - totalRegisteredUsers),
      totalRegisteredUsers,
      dailyActiveUsers: activeByDay.at(-1)?.count ?? 0,
      newRegistrationsToday: newTodayResult.count ?? 0,
      totalTributeReceived: overviewTransactions.reduce(
        (total, row) => total + getTributeReceivedAmount(row),
        0,
      ),
      totalCoinsEarned: overviewTransactions.reduce(
        (total, row) => total + getCoinsEarnedAmount(row),
        0,
      ),
      totalCoinsSpent: overviewTransactions.reduce(
        (total, row) => total + getCoinsSpentAmount(row),
        0,
      ),
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
    topInventoryUsers,
  });
}
