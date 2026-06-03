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
};

type ProfileRow = {
  id: string;
  username: string;
  avatar_url: string | null;
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
  const tributeReasons = ["tribute", "live_gift", "admin_grant"];
  const [{ data: transactions, error: transactionError }, { data: topTransactions, error: topError }] =
    await Promise.all([
      supabase
        .from("coin_transactions")
        .select("id, user_id, amount, created_at")
        .in("reason", tributeReasons)
        .gt("amount", 0)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("coin_transactions")
        .select("id, user_id, amount, created_at")
        .in("reason", tributeReasons)
        .gt("amount", 0)
        .order("amount", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(3),
    ]);

  if (transactionError) {
    console.error("Recent tribute transaction lookup failed", transactionError);
    return Response.json({ error: transactionError.message }, { status: 500 });
  }

  if (topError) {
    console.error("Top tribute transaction lookup failed", topError);
    return Response.json({ error: topError.message }, { status: 500 });
  }

  const rows = (transactions ?? []) as CoinTransactionRow[];
  const topRows = (topTransactions ?? []) as CoinTransactionRow[];
  const userIds = Array.from(new Set([...rows, ...topRows].map((row) => row.user_id)));
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

  return Response.json({
    topTributes: topRows.map(mapTribute),
    tributes: rows.map(mapTribute),
  });
}
