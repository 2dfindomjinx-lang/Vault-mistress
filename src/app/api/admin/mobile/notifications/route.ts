import { requireMobileAdmin } from "@/lib/mobile-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function getPendingAdminActionsCount(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  const now = new Date().toISOString();
  // auto-expire
  await supabase
    .from("pending_admin_actions")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lt("expires_at", now);

  const { count, error } = await supabase
    .from("pending_admin_actions")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  if (error) {
    console.error("Pending admin actions count failed", error);
    return 0;
  }
  return count ?? 0;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AdminCoinTransactionRow = {
  id: string;
  admin_user_id: string | null;
  amount: number;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  profiles?: { username: string | null } | { username: string | null }[] | null;
};

const LARGE_ADMIN_COIN_AMOUNT = Number(process.env.ADMIN_SECURITY_LARGE_COIN_AMOUNT ?? 50000);
const ADMIN_BURST_COUNT = Number(process.env.ADMIN_SECURITY_BURST_COUNT ?? 3);
const ADMIN_BURST_WINDOW_MINUTES = Number(process.env.ADMIN_SECURITY_BURST_WINDOW_MINUTES ?? 10);
const ADMIN_SECURITY_LOOKBACK_HOURS = Number(process.env.ADMIN_SECURITY_LOOKBACK_HOURS ?? 24);

export async function GET(request: Request) {
  const admin = await requireMobileAdmin(request);

  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  const now = new Date().toISOString();
  const [irl, pet, debtDue, securityAlerts, pendingAdminCount] = await Promise.all([
    admin.supabase
      .from("user_irl_tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "assigned"),
    admin.supabase
      .from("user_pet_tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    admin.supabase
      .from("pet_debt_contracts")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .lte("next_due_at", now),
    getAdminCoinSecurityAlerts(admin.supabase),
    getPendingAdminActionsCount(admin.supabase),
  ]);

  const errors = [irl.error, pet.error, debtDue.error, securityAlerts.error].filter(Boolean);
  if (errors.length > 0) {
    return Response.json({ error: errors[0]?.message ?? "Notification lookup failed." }, { status: 500 });
  }

  const notifications = [
    ...securityAlerts.notifications,
    pendingAdminCount > 0 && {
      id: "pending-admin-actions",
      title: "Admin Approvals",
      body: `${pendingAdminCount} /add or /give action(s) pending your Companion App approval.`,
      type: "admin_approvals",
      created_at: now,
      read_at: null,
      action: "pending_actions",
    },
    {
      id: "irl-tasks",
      title: "IRL tasks",
      body: `${irl.count ?? 0} assigned IRL tasks need attention.`,
      type: "irl_tasks",
      created_at: now,
      read_at: null,
    },
    {
      id: "pet-tasks",
      title: "Pet tasks",
      body: `${pet.count ?? 0} pending pet tasks need review.`,
      type: "pet_tasks",
      created_at: now,
      read_at: null,
    },
    {
      id: "debt-due",
      title: "Debt due",
      body: `${debtDue.count ?? 0} active debt contracts are due.`,
      type: "debt_due",
      created_at: now,
      read_at: null,
    },
  ].filter(Boolean).filter((notification: any) => !notification.body?.startsWith("0 "));

  return Response.json({ notifications });
}

async function getAdminCoinSecurityAlerts(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
) {
  const lookbackSince = new Date(Date.now() - ADMIN_SECURITY_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("coin_transactions")
    .select("id, admin_user_id, amount, reason, metadata, created_at, profiles:user_id(username)")
    .in("reason", ["admin_add", "throne_tribute"])
    .gt("amount", 0)
    .gte("created_at", lookbackSince)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("Admin security transaction notification lookup failed", error);
    return { error, notifications: [] };
  }

  const rows = ((data ?? []) as unknown as AdminCoinTransactionRow[]).filter(isAdminCoinCommandRow);
  const notifications = rows
    .filter((row) => Number(row.amount ?? 0) >= LARGE_ADMIN_COIN_AMOUNT)
    .slice(0, 20)
    .map((row) => ({
      id: `security-large-admin-coin-${row.id}`,
      title: "Suspicious admin coin command",
      body: `${commandLabel(row)} ${Number(row.amount).toLocaleString()} coins for ${
        getTransactionUsername(row) ?? "unknown user"
      }.`,
      type: "security_alert",
      created_at: row.created_at,
      read_at: null,
    }));

  const burstAlert = buildBurstAlert(rows);

  if (burstAlert) {
    notifications.unshift(burstAlert);
  }

  return { error: null, notifications };
}

function getTransactionUsername(row: AdminCoinTransactionRow) {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return profile?.username ?? null;
}

function isAdminCoinCommandRow(row: AdminCoinTransactionRow) {
  const command = typeof row.metadata?.command === "string" ? row.metadata.command : "";

  return (
    row.admin_user_id
    && ((row.reason === "admin_add" && command === "add") || (row.reason === "throne_tribute" && command === "give"))
  );
}

function commandLabel(row: AdminCoinTransactionRow) {
  const command = typeof row.metadata?.command === "string" ? row.metadata.command : "";
  return command === "give" ? "/give" : "/add";
}

function buildBurstAlert(rows: AdminCoinTransactionRow[]) {
  const sortedRows = rows
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const windowMillis = ADMIN_BURST_WINDOW_MINUTES * 60 * 1000;

  for (let start = 0; start < sortedRows.length; start += 1) {
    const latest = sortedRows[start];
    const latestTime = new Date(latest.created_at).getTime();
    const burstRows = sortedRows.filter((row) => {
      const rowTime = new Date(row.created_at).getTime();
      return latestTime - rowTime >= 0 && latestTime - rowTime <= windowMillis;
    });

    if (burstRows.length >= ADMIN_BURST_COUNT) {
      const totalAmount = burstRows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);

      return {
        id: `security-admin-coin-burst-${latest.id}`,
        title: "Rapid admin coin activity",
        body: `${burstRows.length} /give or /add commands in ${ADMIN_BURST_WINDOW_MINUTES} minutes. Total: ${totalAmount.toLocaleString()} coins.`,
        type: "security_alert",
        created_at: latest.created_at,
        read_at: null,
      };
    }
  }

  return null;
}
