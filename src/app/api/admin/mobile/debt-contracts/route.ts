import { requireMobileAdmin } from "@/lib/mobile-admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function listDebtContracts(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("pet_debt_contracts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(120);
  if (error) throw error;

  const rows = (data ?? []) as Array<Record<string, unknown> & { user_id: string }>;
  const userIds = Array.from(new Set(rows.map((entry) => entry.user_id)));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);
  const profileRows = (profiles ?? []) as Array<{ id: string; username: string }>;
  const profileMap = new Map(profileRows.map((profile) => [profile.id, profile.username]));

  return rows.map((contract) => ({
    ...contract,
    username: profileMap.get(contract.user_id) ?? "@unknown",
  }));
}

export async function POST(request: Request) {
  const admin = await requireMobileAdmin(request);
  if ("error" in admin) return Response.json({ error: admin.error }, { status: admin.status });

  const body = (await request.json().catch(() => ({}))) as {
    action?: "expireOverdue" | "list" | "remove";
    contractId?: string;
  };

  if (body.action === "remove") {
    const contractId = body.contractId?.trim();
    if (!contractId) return Response.json({ error: "Missing debt contract id." }, { status: 400 });
    const { error } = await admin.supabase.from("pet_debt_contracts").delete().eq("id", contractId);
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  if (body.action === "expireOverdue") {
    const now = new Date().toISOString();
    const { error } = await admin.supabase
      .from("pet_debt_contracts")
      .update({ status: "expired", updated_at: now })
      .lt("ends_at", now)
      .eq("status", "active");
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ contracts: await listDebtContracts(admin.supabase) });
}
