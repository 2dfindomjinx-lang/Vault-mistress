import { requireMobileAdmin } from "@/lib/mobile-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const admin = await requireMobileAdmin(request);

  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  const now = new Date().toISOString();
  const [irl, pet, debtDue] = await Promise.all([
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
  ]);

  const errors = [irl.error, pet.error, debtDue.error].filter(Boolean);
  if (errors.length > 0) {
    return Response.json({ error: errors[0]?.message ?? "Notification lookup failed." }, { status: 500 });
  }

  const notifications = [
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
  ].filter((notification) => !notification.body.startsWith("0 "));

  return Response.json({ notifications });
}
