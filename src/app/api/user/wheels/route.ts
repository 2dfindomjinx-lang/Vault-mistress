import { randomInt } from "node:crypto";
import { profileSelect } from "@/lib/server-game-rules";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { isWheelId, pickWheelSegmentIndex, WHEELS, type WheelSpinRecord } from "@/lib/wheels";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

type SpinRow = {
  amount: number | string;
  amount_owed_usd: number | string;
  amount_paid_usd: number | string;
  created_at: string;
  id: string;
  kind: string;
  pay_code: string | null;
  segment_label: string;
  status: string;
  wheel_id: string;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function toRecord(row: SpinRow): WheelSpinRecord {
  return {
    amount: Number(row.amount) || 0,
    amountOwedUsd: Number(row.amount_owed_usd) || 0,
    amountPaidUsd: Number(row.amount_paid_usd) || 0,
    createdAt: row.created_at,
    id: row.id,
    kind: row.kind as WheelSpinRecord["kind"],
    payCode: row.pay_code,
    segmentLabel: row.segment_label,
    status: row.status as WheelSpinRecord["status"],
    wheelId: row.wheel_id as WheelSpinRecord["wheelId"],
  };
}

async function requireUser() {
  const authSupabase = await createSupabaseServerClient();
  const { data, error } = await authSupabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export async function GET() {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }
  const user = await requireUser();
  if (!user) return jsonError("Authentication required.", 401);

  const supabase = createSupabaseAdminClient();
  const [spinsResult, unpaidResult, profileResult] = await Promise.all([
    supabase
      .from("wheel_spins")
      .select("id, wheel_id, kind, segment_label, amount, pay_code, amount_owed_usd, amount_paid_usd, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("wheel_spins")
      .select("id, wheel_id, kind, segment_label, amount, pay_code, amount_owed_usd, amount_paid_usd, status, created_at")
      .eq("user_id", user.id)
      .eq("status", "unpaid")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("profiles").select("principessa_money, chastity_until").eq("id", user.id).single(),
  ]);

  if (spinsResult.error || unpaidResult.error || profileResult.error || !profileResult.data) {
    return jsonError(
      spinsResult.error?.message ?? unpaidResult.error?.message ?? profileResult.error?.message ?? "Wheel state unavailable.",
      500,
    );
  }

  const spins = ((spinsResult.data ?? []) as SpinRow[]).map(toRecord);
  const profile = profileResult.data as { chastity_until: string | null; principessa_money: number };

  return Response.json({
    chastityUntil: profile.chastity_until,
    money: Math.max(0, Number(profile.principessa_money) || 0),
    spins,
    unpaidSpin: unpaidResult.data ? toRecord(unpaidResult.data as SpinRow) : null,
  });
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }
  const user = await requireUser();
  if (!user) return jsonError("Authentication required.", 401);

  const body = (await request.json().catch(() => null)) as
    | { action?: "pay-pm" | "spin"; spinId?: string; wheelId?: string }
    | null;

  const supabase = createSupabaseAdminClient();
  const limit = await checkRateLimit(supabase, `wheels:${user.id}`, 12, 60);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  if (body?.action === "spin") {
    if (!isWheelId(body.wheelId)) return jsonError("Unknown wheel.");
    const wheel = WHEELS[body.wheelId];

    // The outcome exists before the animation does. randomInt is crypto-backed
    // and unguessable; the client only ever receives the finished result.
    const segmentIndex = pickWheelSegmentIndex(wheel.id, randomInt(0, 1_000_000) / 1_000_000);
    const segment = wheel.segments[segmentIndex];

    const { data, error } = await supabase.rpc("spin_findom_wheel", {
      p_amount: segment.amount,
      p_cost_pm: wheel.spinCostPm,
      p_kind: wheel.kind,
      p_label: segment.label,
      p_user_id: user.id,
      p_wheel_id: wheel.id,
    });

    if (error) {
      console.error("[wheels] spin failed", error);
      return jsonError("The wheel refused to turn. Try again.", 500);
    }

    const result = (data ?? {}) as {
      amountOwed?: number;
      chastityUntil?: string;
      error?: string;
      money?: number;
      payCode?: string;
      spinId?: string;
    };

    if (result.error === "unpaid_spin") {
      return jsonError("You still owe her for your last spin. Pay it first.", 409);
    }
    if (result.error === "insufficient_money") {
      return jsonError(`Spinning costs ${wheel.spinCostPm} Principessa Money. You have ${result.money ?? 0}.`, 402);
    }
    if (result.error) {
      return jsonError("The wheel refused to turn.", 400);
    }

    const { data: profileData } = await supabase.from("profiles").select(profileSelect).eq("id", user.id).single();

    return Response.json({
      amountOwed: result.amountOwed ?? 0,
      chastityUntil: result.chastityUntil ?? null,
      payCode: result.payCode ?? null,
      profile: profileData ?? null,
      segment: { amount: segment.amount, label: segment.label, throneUrl: segment.throneUrl ?? null },
      segmentIndex,
      spinId: result.spinId,
      wheelId: wheel.id,
    });
  }

  if (body?.action === "pay-pm") {
    if (typeof body.spinId !== "string" || !body.spinId) return jsonError("Missing spin.");

    const { data, error } = await supabase.rpc("pay_wheel_spin_with_pm", {
      p_spin_id: body.spinId,
      p_user_id: user.id,
    });

    if (error) {
      console.error("[wheels] pay-pm failed", error);
      return jsonError("The payment could not be made.", 500);
    }

    const result = (data ?? {}) as { error?: string; money?: number; remaining?: number };
    if (result.error === "insufficient_money") {
      return jsonError(
        `Settling this debt costs ${result.remaining ?? 0} Principessa Money. You have ${result.money ?? 0}.`,
        402,
      );
    }
    if (result.error === "already_settled") {
      return jsonError("This spin is already settled.", 409);
    }
    if (result.error) {
      return jsonError("The payment could not be made.", 400);
    }

    const { data: profileData } = await supabase.from("profiles").select(profileSelect).eq("id", user.id).single();
    return Response.json({ paid: true, profile: profileData ?? null });
  }

  return jsonError("Invalid wheel action.");
}
