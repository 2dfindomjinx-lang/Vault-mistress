import { adminDebtContractSelect } from "@/lib/debt-contract-select";
import type { SupabaseClient } from "@supabase/supabase-js";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;

type DebtContractRow = Record<string, unknown> & {
  contract_type: string;
  duration_periods: number | null;
  id: string;
  missed_periods: number | null;
  next_due_at: string;
  paid_periods: number | null;
  period_type: "monthly" | "weekly";
  status: string;
  user_id: string;
};

type DebtContractProfileRow = {
  id: string;
  username: string;
};

type DebtContractImageRow = {
  contract_id: string;
  image_url: string;
};

export function getDebtPeriodMs(periodType: "weekly" | "monthly") {
  return periodType === "weekly" ? WEEK_MS : MONTH_MS;
}

export function getFirstDebtDueAtIso(periodType: "weekly" | "monthly", start: Date) {
  return new Date(start.getTime() + getDebtPeriodMs(periodType)).toISOString();
}

export async function listAdminDebtContracts(
  supabase: SupabaseClient,
  options?: { projectOverdueMissedPeriods?: boolean },
) {
  const { data, error } = await supabase
    .from("pet_debt_contracts")
    .select(adminDebtContractSelect)
    .order("created_at", { ascending: false })
    .limit(120);

  if (error) {
    console.error("Admin debt contract list failed", error);
    throw error;
  }

  const rows = (data ?? []) as DebtContractRow[];

  if (rows.length === 0) {
    return [];
  }

  const userIds = Array.from(new Set(rows.map((entry) => entry.user_id)));
  const contractIds = rows.map((entry) => entry.id);

  const [profilesResult, imagesResult] = await Promise.all([
    userIds.length > 0
      ? supabase.from("profiles").select("id, username").in("id", userIds)
      : Promise.resolve({ data: [] as DebtContractProfileRow[], error: null }),
    contractIds.length > 0
      ? supabase
          .from("evil_debt_contract_images")
          .select("contract_id, image_url")
          .in("contract_id", contractIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as DebtContractImageRow[], error: null }),
  ]);

  if (profilesResult.error) {
    console.error("Admin debt profile lookup failed", profilesResult.error);
  }

  if (imagesResult.error) {
    console.error("Admin evil debt image lookup failed", imagesResult.error);
  }

  const profileMap = new Map(
    ((profilesResult.data ?? []) as DebtContractProfileRow[]).map((profile) => [profile.id, profile.username]),
  );
  const imageMap = new Map<string, string[]>();

  for (const row of (imagesResult.data ?? []) as DebtContractImageRow[]) {
    const current = imageMap.get(row.contract_id) ?? [];
    current.push(row.image_url);
    imageMap.set(row.contract_id, current);
  }

  const shouldProjectOverdueMissedPeriods = options?.projectOverdueMissedPeriods === true;
  const now = Date.now();

  return rows.map((contract) => {
    const baseMissedPeriods = Math.max(0, Number(contract.missed_periods ?? 0));
    let projectedMissedPeriods = 0;

    if (shouldProjectOverdueMissedPeriods && contract.status === "active") {
      const nextDueAtMs = new Date(contract.next_due_at).getTime();

      if (Number.isFinite(nextDueAtMs) && nextDueAtMs < now) {
        const remainingPeriods = Math.max(
          0,
          Number(contract.duration_periods ?? 0) - Number(contract.paid_periods ?? 0),
        );
        projectedMissedPeriods = Math.min(
          remainingPeriods,
          Math.floor((now - nextDueAtMs) / getDebtPeriodMs(contract.period_type)) + 1,
        );
      }
    }

    return {
      ...contract,
      image_urls: imageMap.get(contract.id) ?? [],
      missed_periods: Math.max(baseMissedPeriods, projectedMissedPeriods),
      username: profileMap.get(contract.user_id) ?? "@unknown",
    };
  });
}
