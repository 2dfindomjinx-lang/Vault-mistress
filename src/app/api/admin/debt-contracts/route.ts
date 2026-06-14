import { requireAdminProfile } from "@/lib/admin-guard";
import { adminDebtContractSelect } from "@/lib/debt-contract-select";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const DAY_MS = 24 * 60 * 60 * 1000;

function getDebtPeriodMs(periodType: "weekly" | "monthly") {
  return periodType === "weekly" ? 7 * DAY_MS : 30 * DAY_MS;
}

async function listDebtContracts(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  const { data, error } = await supabase
    .from("pet_debt_contracts")
    .select(adminDebtContractSelect)
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
  const contractIds = (data ?? []).map((entry) => entry.id);
  const { data: imageRows, error: imageError } = await supabase
    .from("evil_debt_contract_images")
    .select("contract_id, image_url")
    .in("contract_id", contractIds.length > 0 ? contractIds : ["00000000-0000-0000-0000-000000000000"])
    .order("created_at", { ascending: true });

  if (imageError) {
    console.error("Admin evil debt image lookup failed", imageError);
  }

  const imageMap = new Map<string, string[]>();

  for (const row of imageRows ?? []) {
    const current = imageMap.get(row.contract_id) ?? [];
    current.push(row.image_url);
    imageMap.set(row.contract_id, current);
  }

  return (data ?? []).map((contract) => ({
    ...contract,
    image_urls: imageMap.get(contract.id) ?? [],
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
    action?: "approveEvil" | "expireOverdue" | "list" | "remove";
    contractId?: string;
  };

  if (body.action === "remove") {
    const contractId = body.contractId?.trim();

    if (!contractId) {
      return Response.json({ error: "Missing debt contract id." }, { status: 400 });
    }

    const { error } = await admin.supabase
      .from("pet_debt_contracts")
      .delete()
      .eq("id", contractId);

    if (error) {
      console.error("Admin debt contract removal failed", error);
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  if (body.action === "approveEvil") {
    const contractId = body.contractId?.trim();

    if (!contractId) {
      return Response.json({ error: "Missing debt contract id." }, { status: 400 });
    }

    const { data: contract, error: readError } = await admin.supabase
      .from("pet_debt_contracts")
      .select("id, contract_type, duration_periods, period_type, status")
      .eq("id", contractId)
      .eq("contract_type", "evil")
      .eq("status", "pending")
      .maybeSingle();

    if (readError) {
      console.error("Admin evil debt approval lookup failed", readError);
      return Response.json({ error: readError.message }, { status: 500 });
    }

    if (!contract) {
      return Response.json({ error: "Pending Evil Debt Contract not found." }, { status: 404 });
    }

    const now = new Date();
    const periodMs = getDebtPeriodMs(contract.period_type as "weekly" | "monthly");
    const { error } = await admin.supabase
      .from("pet_debt_contracts")
      .update({
        ends_at: new Date(now.getTime() + periodMs * Number(contract.duration_periods ?? 0)).toISOString(),
        next_due_at: now.toISOString(),
        started_at: now.toISOString(),
        status: "active",
        updated_at: now.toISOString(),
      })
      .eq("id", contract.id)
      .eq("status", "pending");

    if (error) {
      console.error("Admin evil debt approval failed", error);
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

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
