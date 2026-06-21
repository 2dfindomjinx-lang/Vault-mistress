import { getTimeoutClearFee, profileSelect } from "@/lib/server-game-rules";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  action?: "clear";
  timeoutUntil?: string | null;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function isValidTimeoutUntil(value: unknown) {
  if (typeof value !== "string") {
    return false;
  }

  const time = new Date(value).getTime();

  return Number.isFinite(time) && time >= Date.now() - 60_000 && time <= Date.now() + 30 * 24 * 60 * 60 * 1000;
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();

  if (authError || !authData.user) {
    return jsonError(authError?.message ?? "Authentication required.", 401);
  }

  const body = (await request.json().catch(() => null)) as Body | null;

  if (!body) {
    return jsonError("Invalid timeout payload.", 422);
  }

  const supabase = createSupabaseAdminClient();

  if (body.action === "clear") {
    const { data: currentProfile, error: currentProfileError } = await supabase
      .from("profiles")
      .select("coins, timeout_until, timeout_reason")
      .eq("id", authData.user.id)
      .single();

    if (currentProfileError || !currentProfile) {
      return jsonError(currentProfileError?.message ?? "Timeout lookup failed.", 500);
    }

    if (!currentProfile.timeout_until) {
      return jsonError("No active timeout found.", 409);
    }

    if (currentProfile.timeout_reason === "evil_debt_underage") {
      return jsonError("Age verification timeouts require admin review.", 403);
    }

    const clearFee = getTimeoutClearFee(currentProfile.timeout_until, currentProfile.timeout_reason);

    if (currentProfile.coins < clearFee) {
      return jsonError(`You need ${clearFee.toLocaleString()} coins to clear this timeout.`, 402);
    }

    const nextCoins = currentProfile.coins - clearFee;
    const now = new Date().toISOString();
    const { data: updatedProfile, error } = await supabase
      .from("profiles")
      .update({
        coins: nextCoins,
        timeout_reason: null,
        timeout_until: null,
        updated_at: now,
      })
      .eq("id", authData.user.id)
      .eq("coins", currentProfile.coins)
      .eq("timeout_until", currentProfile.timeout_until)
      .select(profileSelect)
      .single();

    if (error || !updatedProfile) {
      return jsonError(error?.message ?? "Timeout clear failed.", 500);
    }

    if (clearFee > 0) {
      const { data: transaction, error: transactionError } = await supabase
        .from("coin_transactions")
        .insert({
          amount: -clearFee,
          balance_before: currentProfile.coins,
          balance_after: nextCoins,
          metadata: {
            clearFee,
            timeoutReason: currentProfile.timeout_reason,
            timeoutUntil: currentProfile.timeout_until,
          },
          reason: "spend:timeout-clear",
          user_id: authData.user.id,
        })
        .select("id")
        .single();

      if (transactionError || !transaction) {
        console.error("Timeout clear transaction logging failed", {
          code: transactionError?.code,
          message: transactionError?.message,
          userId: authData.user.id,
        });

        const { error: rollbackError } = await supabase
          .from("profiles")
          .update({
            coins: currentProfile.coins,
            timeout_reason: currentProfile.timeout_reason,
            timeout_until: currentProfile.timeout_until,
            updated_at: now,
          })
          .eq("id", authData.user.id)
          .eq("coins", nextCoins)
          .eq("timeout_until", currentProfile.timeout_until)
          .select(profileSelect)
          .single();

        if (rollbackError) {
          console.error("Timeout clear rollback failed", {
            code: rollbackError.code,
            message: rollbackError.message,
            userId: authData.user.id,
          });
        }

        return jsonError("Timeout clear logging failed.", 500);
      }
    }

    return Response.json({
      clearFee,
      message: clearFee > 0 ? `Timeout cleared for ${clearFee.toLocaleString()} coins.` : "Timeout cleared.",
      profile: updatedProfile,
    });
  }

  if (!isValidTimeoutUntil(body.timeoutUntil)) {
    return jsonError("Invalid timeout payload.", 422);
  }

  const { data: updatedProfile, error } = await supabase
    .from("profiles")
    .update({
      timeout_reason: null,
      timeout_until: body.timeoutUntil,
      updated_at: new Date().toISOString(),
    })
    .eq("id", authData.user.id)
    .select(profileSelect)
    .single();

  if (error || !updatedProfile) {
    return jsonError(error?.message ?? "Timeout update failed.", 500);
  }

  return Response.json({ profile: updatedProfile });
}
