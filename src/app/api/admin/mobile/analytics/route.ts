import { requireMobileAdmin } from "@/lib/mobile-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const admin = await requireMobileAdmin(request);
  if ("error" in admin) return Response.json({ error: admin.error }, { status: admin.status });

  const now = new Date().toISOString();
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  const [profiles, irlPending, petPending, activeDebt, dueDebt, coins] = await Promise.all([
    admin.supabase.from("profiles").select("id, coins, tribute_total, affection", { count: "exact" }),
    admin.supabase.from("user_irl_tasks").select("id", { count: "exact", head: true }).eq("status", "assigned"),
    admin.supabase.from("user_pet_tasks").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.supabase.from("pet_debt_contracts").select("id", { count: "exact", head: true }).eq("status", "active"),
    admin.supabase.from("pet_debt_contracts").select("id", { count: "exact", head: true }).eq("status", "active").lte("next_due_at", now),
    admin.supabase.from("coin_transactions").select("amount, reason, created_at").gte("created_at", dayStart.toISOString()),
  ]);

  const failed = [profiles.error, irlPending.error, petPending.error, activeDebt.error, dueDebt.error, coins.error].find(Boolean);
  if (failed) return Response.json({ error: failed.message }, { status: 500 });

  const profileRows = profiles.data ?? [];
  const coinRows = coins.data ?? [];

  return Response.json({
    overview: {
      totalUsers: profiles.count ?? profileRows.length,
      irlPending: irlPending.count ?? 0,
      petPending: petPending.count ?? 0,
      activeDebtContracts: activeDebt.count ?? 0,
      dueDebtContracts: dueDebt.count ?? 0,
      totalCoinsInCirculation: profileRows.reduce((sum, row) => sum + Number(row.coins ?? 0), 0),
      totalTribute: profileRows.reduce((sum, row) => sum + Number(row.tribute_total ?? 0), 0),
      averageAffection: profileRows.length
        ? Math.round(profileRows.reduce((sum, row) => sum + Number(row.affection ?? 0), 0) / profileRows.length)
        : 0,
      coinsToday: coinRows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
    },
  });
}

