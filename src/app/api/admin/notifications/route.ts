import { requireAdminProfile } from "@/lib/admin-guard";

export async function POST() {
  const admin = await requireAdminProfile();

  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  const now = new Date().toISOString();
  const [irl, pet, petFailedRules, debtDue, ownerWarning] = await Promise.all([
    admin.supabase
      .from("user_irl_tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "assigned"),
    admin.supabase
      .from("user_pet_tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    admin.supabase
      .from("user_pet_tasks")
      .select("id", { count: "exact", head: true })
      .eq("task_id", "pet-randomized-rules")
      .eq("status", "failed"),
    admin.supabase
      .from("pet_debt_contracts")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .lte("next_due_at", now),
    admin.supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .lte("owner_likeness", 25)
      .not("pet_unlocked_at", "is", null),
  ]);

  const errors = [irl.error, pet.error, petFailedRules.error, debtDue.error, ownerWarning.error].filter(Boolean);

  if (errors.length > 0) {
    console.error("Admin notification count failed", errors);
    return Response.json({ error: errors[0]?.message ?? "Notification count failed." }, { status: 500 });
  }

  const counts = {
    debtDue: debtDue.count ?? 0,
    irlPending: irl.count ?? 0,
    ownerWarnings: ownerWarning.count ?? 0,
    petFailedRules: petFailedRules.count ?? 0,
    petPending: pet.count ?? 0,
  };

  return Response.json({
    count:
      counts.debtDue +
      counts.irlPending +
      counts.ownerWarnings +
      counts.petFailedRules +
      counts.petPending,
    counts,
  });
}
