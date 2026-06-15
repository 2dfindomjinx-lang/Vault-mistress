import {
  createPublicSupabaseClient,
  getSupabasePublicConfigErrors,
  isSupabasePublicConfigured,
} from "@/lib/supabase/public";
import { getUsernameStylesByUserId, type EquippedUsernameCosmeticRow } from "@/lib/username-styles";


type CoinTransactionRow = {
  id: string;
  user_id: string;
  amount: number;
  created_at: string;
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
};

export async function GET() {
  if (!isSupabasePublicConfigured) {
    const configErrors = getSupabasePublicConfigErrors();
    console.error("Recent tributes route is not configured", configErrors);
    return Response.json(
      { error: `Recent tributes are not configured: ${configErrors.join(", ")}` },
      { status: 500 },
    );
  }

  const supabase = createPublicSupabaseClient();
  const [{ data: transactions, error: transactionError }, { data: topRowsData, error: topRowsError }] =
    await Promise.all([
      supabase.rpc("get_public_recent_tribute_transactions", { p_limit: 5 }),
      supabase.rpc("get_public_top_tributors", { p_limit: 3 }),
    ]);

  if (transactionError) {
    console.error("Recent tribute transaction lookup failed", transactionError);
    return Response.json({ error: transactionError.message }, { status: 500 });
  }

  if (topRowsError) {
    console.error("All-time throne tributors lookup failed", topRowsError);
    return Response.json({ error: topRowsError.message }, { status: 500 });
  }

  const rows = (transactions ?? []) as CoinTransactionRow[];
  const topRows: TopTributorRow[] = ((topRowsData ?? []) as Array<{
    user_id: string;
    amount: number | string;
    latest_created_at: string;
  }>).map((row) => ({
    userId: row.user_id,
    amount: Number(row.amount ?? 0),
    createdAt: row.latest_created_at,
  }));

  const userIds = Array.from(
    new Set([...rows.map((row) => row.user_id), ...topRows.map((row) => row.userId)]),
  );
  const { data: profiles, error: profileError } = await supabase.rpc("get_public_profile_snippets", {
    p_user_ids: userIds.length > 0 ? userIds : [],
  });

  if (profileError) {
    console.error("Recent tribute profile lookup failed", profileError);
    return Response.json({ error: profileError.message }, { status: 500 });
  }

  const { data: cosmeticRows, error: cosmeticError } = await supabase.rpc("get_public_username_cosmetics", {
    p_user_ids: userIds.length > 0 ? userIds : [],
  });

  if (cosmeticError) {
    console.error("Recent tribute username cosmetic lookup failed", cosmeticError);
  }

  const profileMap = new Map(
    ((profiles ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
  );
  const usernameStyles = getUsernameStylesByUserId((cosmeticRows ?? []) as EquippedUsernameCosmeticRow[]);

  const mapTribute = (row: CoinTransactionRow) => {
    const profile = profileMap.get(row.user_id);

    return {
      id: row.id,
      username: profile?.username ?? "@unknown",
      avatarUrl: profile?.avatar_url ?? null,
      amount: row.amount,
      createdAt: row.created_at,
      usernameStyle: usernameStyles.get(row.user_id),
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
      usernameStyle: usernameStyles.get(row.userId),
    };
  };

  return Response.json({
    topTributes: topRows.map(mapTopTributor),
    tributes: rows.map(mapTribute),
  });
}
