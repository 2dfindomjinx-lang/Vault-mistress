import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";

type CoinTransactionRow = {
  id: string;
  user_id: string;
  amount: number;
  created_at: string;
  metadata?: Record<string, unknown> | null;
  reason?: string | null;
};

type TopTributorRow = {
  userId: string;
  amount: number;
  createdAt: string;
};

type ProfileRow = {
  id: string;
  username: string;
  avatar_url?: string | null;
  tribute_total?: number | null;
  updated_at?: string | null;
};

export async function GET() {
  if (!isSupabaseAdminConfigured) {
    const configErrors = getSupabaseAdminConfigErrors();
    console.error("Recent tributes route is not configured", configErrors);
    return Response.json(
      { error: `Recent tributes are not configured: ${configErrors.join(", ")}` },
      { status: 500 },
    );
  }

  const supabase = createSupabaseAdminClient();
  const recentTributeReasons = ["tribute", "live_gift", "throne_tribute", "admin_grant"];
  const [{ data: transactions, error: transactionError }, throneTributeResult] =
    await Promise.all([
      supabase
        .from("coin_transactions")
        .select("id, user_id, amount, reason, metadata, created_at")
        .in("reason", recentTributeReasons)
        .gt("amount", 0)
        .order("created_at", { ascending: false })
        .limit(10),
      fetchAllThroneTributeTransactions(supabase),
    ]);

  if (transactionError) {
    console.error("Recent tribute transaction lookup failed", transactionError);
    return Response.json({ error: transactionError.message }, { status: 500 });
  }

  if (throneTributeResult.error) {
    console.error("All-time throne tributors lookup failed", throneTributeResult.error);
    return Response.json({ error: throneTributeResult.error.message }, { status: 500 });
  }

  const rows = (transactions ?? []) as CoinTransactionRow[];
  const topRows = getTopTributors(
    throneTributeResult.rows.filter(isThroneTributeTransaction),
  );
  const userIds = Array.from(
    new Set([...rows.map((row) => row.user_id), ...topRows.map((row) => row.userId)]),
  );
  let { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .in("id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);

  if (profileError?.code === "42703") {
    const fallback = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);

    profiles = (fallback.data ?? []).map((profile) => ({
      ...profile,
      avatar_url: null,
    }));
    profileError = fallback.error;
  }

  if (profileError) {
    console.error("Recent tribute profile lookup failed", profileError);
    return Response.json({ error: profileError.message }, { status: 500 });
  }

  const profileMap = new Map(
    ((profiles ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
  );

  const mapTribute = (row: CoinTransactionRow) => {
    const profile = profileMap.get(row.user_id);

    return {
      id: row.id,
      username: profile?.username ?? "@unknown",
      avatarUrl: profile?.avatar_url ?? null,
      amount: row.amount,
      createdAt: row.created_at,
    };
  };

  const mapTopTributor = (row: TopTributorRow) => {
    const profile = profileMap.get(row.userId);

    return {
      id: row.userId,
      username: profile?.username ?? "@unknown",
      avatarUrl: profile?.avatar_url ?? null,
      amount: row.amount,
      createdAt: row.createdAt,
    };
  };

  return Response.json({
    topTributes: topRows.map(mapTopTributor),
    tributes: rows.map(mapTribute),
  });
}

async function fetchAllThroneTributeTransactions(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
) {
  const throneTributeReasons = ["throne_tribute", "live_gift", "admin_grant"];
  const pageSize = 1000;
  const rows: CoinTransactionRow[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("coin_transactions")
      .select("id, user_id, amount, reason, metadata, created_at")
      .in("reason", throneTributeReasons)
      .gt("amount", 0)
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      return { error, rows };
    }

    const pageRows = (data ?? []) as CoinTransactionRow[];
    rows.push(...pageRows);

    if (pageRows.length < pageSize) {
      return { error: null, rows };
    }
  }
}

function getTopTributors(rows: CoinTransactionRow[]): TopTributorRow[] {
  const totals = new Map<string, TopTributorRow>();

  rows.forEach((row) => {
    const amount = Math.max(0, Number(row.amount ?? 0));

    if (amount <= 0) {
      return;
    }

    const existing = totals.get(row.user_id);
    const latestCreatedAt =
      existing && new Date(existing.createdAt).getTime() > new Date(row.created_at).getTime()
        ? existing.createdAt
        : row.created_at;

    totals.set(row.user_id, {
      userId: row.user_id,
      amount: (existing?.amount ?? 0) + amount,
      createdAt: latestCreatedAt,
    });
  });

  return Array.from(totals.values())
    .sort((a, b) => {
      if (b.amount !== a.amount) {
        return b.amount - a.amount;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, 3);
}

function isThroneTributeTransaction(row: CoinTransactionRow) {
  const metadata = row.metadata ?? {};
  const command = typeof metadata.command === "string" ? metadata.command : null;
  const kind = typeof metadata.kind === "string" ? metadata.kind : null;
  const source = typeof metadata.source === "string" ? metadata.source : null;

  if (row.reason === "throne_tribute") {
    return source === "throne" || kind === "manual_coin_purchase" || command === "give";
  }

  // Legacy /give records may have used live_gift or admin_grant with metadata.command = "give".
  return (row.reason === "live_gift" || row.reason === "admin_grant") && command === "give";
}
