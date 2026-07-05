import { requireAdminProfile } from "@/lib/admin-guard";

type AdminNotificationTone = "amber" | "pink" | "red" | "sky";

type AdminNotificationItem = {
  count: number;
  description: string;
  id: string;
  title: string;
  tone: AdminNotificationTone;
};

export async function POST() {
  const admin = await requireAdminProfile();

  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  const now = new Date().toISOString();
  const [irl, pet, debtDue, evilDebtPending] = await Promise.all([
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
    admin.supabase
      .from("pet_debt_contracts")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .eq("contract_type", "evil"),
  ]);

  const errors = [irl.error, pet.error, debtDue.error, evilDebtPending.error].filter(Boolean);

  if (errors.length > 0) {
    console.error("Admin notification count failed", errors);
    return Response.json({ error: errors[0]?.message ?? "Notification count failed." }, { status: 500 });
  }

  const counts = {
    debtDue: debtDue.count ?? 0,
    evilDebtPending: evilDebtPending.count ?? 0,
    irlPending: irl.count ?? 0,
    petPending: pet.count ?? 0,
  };

  const notifications: AdminNotificationItem[] = [
    {
      count: counts.irlPending,
      description: `${counts.irlPending} assigned IRL task${counts.irlPending === 1 ? "" : "s"} need review.`,
      id: "irl-tasks",
      title: "IRL Tasks",
      tone: "pink" as const,
    },
    {
      count: counts.petPending,
      description: `${counts.petPending} pending pet task${counts.petPending === 1 ? " is" : "s are"} waiting for approval.`,
      id: "pet-tasks",
      title: "Pet Tasks",
      tone: "red" as const,
    },
    {
      count: counts.evilDebtPending,
      description: `${counts.evilDebtPending} evil debt contract request${counts.evilDebtPending === 1 ? " is" : "s are"} waiting for approval.`,
      id: "evil-debt-pending",
      title: "Evil Debt Requests",
      tone: "amber" as const,
    },
    {
      count: counts.debtDue,
      description: `${counts.debtDue} active debt contract${counts.debtDue === 1 ? " is" : "s are"} currently due.`,
      id: "debt-due",
      title: "Due Debt Contracts",
      tone: "sky" as const,
    },
  ].filter((item) => item.count > 0);

  const count = counts.irlPending + counts.petPending + counts.evilDebtPending + counts.debtDue;

  return Response.json({
    count,
    counts,
    notifications,
  });
}
