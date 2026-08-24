import { formatHandle } from "@/lib/username";
import { requireAdminProfile } from "@/lib/admin-guard";
import { getSupabaseAdminConfigErrors, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

type AdminSpinRow = {
  amount: number | string;
  amount_owed_usd: number | string;
  amount_paid_usd: number | string;
  created_at: string;
  id: string;
  kind: string;
  paid_at: string | null;
  paid_via: string | null;
  pay_code: string | null;
  segment_label: string;
  status: string;
  user_id: string;
  wheel_id: string;
};

// The owner's ledger of who spun what, what it demanded and whether it has
// been paid - the whole reason the wheels are worth running.
export async function GET() {
  if (!isSupabaseAdminConfigured) {
    return Response.json(
      { error: `Admin Supabase environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}` },
      { status: 500 },
    );
  }

  const admin = await requireAdminProfile();
  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  const { data, error } = await admin.supabase
    .from("wheel_spins")
    .select("id, user_id, wheel_id, kind, segment_label, amount, pay_code, amount_owed_usd, amount_paid_usd, status, paid_via, created_at, paid_at")
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as AdminSpinRow[];
  const userIds = Array.from(new Set(rows.map((row) => row.user_id)));
  const { data: profiles } = userIds.length
    ? await admin.supabase.from("profiles").select("id, username, display_name").in("id", userIds)
    : { data: [] as Array<{ display_name: string | null; id: string; username: string | null }> };

  const nameById = new Map(
    ((profiles ?? []) as Array<{ display_name: string | null; id: string; username: string | null }>).map((row) => [
      row.id,
      row.display_name?.trim() || formatHandle(row.username),
    ]),
  );

  return Response.json({
    spins: rows.map((row) => ({
      amount: Number(row.amount) || 0,
      amountOwedUsd: Number(row.amount_owed_usd) || 0,
      amountPaidUsd: Number(row.amount_paid_usd) || 0,
      createdAt: row.created_at,
      id: row.id,
      kind: row.kind,
      paidAt: row.paid_at,
      paidVia: row.paid_via,
      payCode: row.pay_code,
      segmentLabel: row.segment_label,
      status: row.status,
      user: nameById.get(row.user_id) ?? "unknown",
      wheelId: row.wheel_id,
    })),
  });
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return Response.json({ error: "Admin Supabase environment is not configured." }, { status: 500 });
  }

  const admin = await requireAdminProfile();
  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  const body = (await request.json().catch(() => null)) as { action?: string; spinId?: string } | null;
  if (body?.action !== "waive" || typeof body.spinId !== "string" || !body.spinId) {
    return Response.json({ error: "Invalid wheel admin action." }, { status: 400 });
  }

  const { data, error } = await admin.supabase.rpc("waive_wheel_spin", { p_spin_id: body.spinId });
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const result = (data ?? {}) as { error?: string };
  if (result.error) {
    return Response.json({ error: result.error === "not_unpaid" ? "Only unpaid spins can be waived." : "Spin not found." }, { status: 400 });
  }

  return Response.json({ waived: true });
}
