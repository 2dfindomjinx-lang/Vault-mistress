import { requireAdminProfile } from "@/lib/admin-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function listDebtContracts(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  const { data, error } = await supabase
    .from("pet_debt_contracts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(120);

  if (error) {
    console.error("Admin debt contract list failed", error);
    throw error;
  }

  const userIds = Array.from(new Set((data ?? []).map((entry) => entry.user_id)));
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);

  if (profileError) {
    console.error("Admin debt profile lookup failed", profileError);
  }

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile.username]));

  return (data ?? []).map((contract) => ({
    ...contract,
    missed_periods: Math.max(
      Number(contract.missed_periods ?? 0),
      contract.status === "active" && new Date(contract.next_due_at).getTime() < Date.now()
        ? Math.min(
            Number(contract.duration_periods ?? 0) - Number(contract.paid_periods ?? 0),
            Math.floor(
              (Date.now() - new Date(contract.next_due_at).getTime()) /
                (contract.period_type === "weekly" ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000),
            ) + 1,
          )
        : 0,
    ),
    username: profileMap.get(contract.user_id) ?? "@unknown",
  }));
}

export async function POST(request: Request) {
  const admin = await requireAdminProfile();

  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  const body = (await request.json()) as {
    action?: "expireOverdue" | "list";
  };

  if (body.action === "expireOverdue") {
    const now = new Date().toISOString();
    const { error } = await admin.supabase
      .from("pet_debt_contracts")
      .update({ status: "expired", updated_at: now })
      .lt("ends_at", now)
      .eq("status", "active");

    if (error) {
      console.error("Admin debt expiry update failed", error);
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  return Response.json({ contracts: await listDebtContracts(admin.supabase) });
}
