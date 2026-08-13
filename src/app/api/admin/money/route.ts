import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { isDirectCoinAdminUserId } from "@/lib/admin-identity";
import { createPendingCoinAction } from "@/lib/pending-admin-actions";
import { LARGE_MONEY_GRANT_AMOUNT } from "@/lib/principessa-money";
import {
  getMoneyGrantMetadata,
  getMoneyGrantReason,
  parseMoneyGrantVisibility,
} from "@/lib/money-grant-ledger";
import { requireAdminProfile } from "@/lib/admin-guard";
import { getSupabaseAdminConfigErrors, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

// Grants (or claws back) Principessa Money. This is the ONLY way PM enters the
// economy today - it is credited by hand after a Throne payment lands, exactly
// like coins used to be. Kept as its own route rather than a branch inside
// /api/admin/give because that route's give-bonus and devotion machinery is all
// coin-specific and must not run for the paid currency.
//
// Idempotency: pass sourceKey (e.g. the Throne order id) and a repeated credit
// is rejected instead of doubling the grant. money_transactions has a partial
// unique index on source_key for exactly this.
export async function POST(request: Request) {
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

  const rateLimit = await checkRateLimit(admin.supabase, `admin-money:${admin.adminUser.id}`, 30, 60);
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfterSeconds);

  const body = (await request.json().catch(() => null)) as
    | { amount?: number; note?: string; sourceKey?: string; username?: string; visibility?: string }
    | null;

  // Defaults to public: /money is for crediting a Throne payment that really
  // happened, and those belong on the ticker. /moneysilent opts out.
  const visibility = parseMoneyGrantVisibility(body?.visibility);

  const amount = Math.trunc(Number(body?.amount));
  if (!Number.isFinite(amount) || amount === 0) {
    return Response.json({ error: "Amount must be a non-zero whole number." }, { status: 400 });
  }

  const rawUsername = (body?.username ?? "").trim();
  const normalizedUsername = rawUsername.toLowerCase().replace(/^@+/, "");
  const profileUsername = `@${normalizedUsername}`;
  if (!normalizedUsername) {
    return Response.json({ error: "Username is required." }, { status: 400 });
  }

  // Keep this identical to the working /give and /add commands: username is
  // the canonical profile key and is stored with its leading @.
  const { data: profile, error: profileError } = await admin.supabase
    .from("profiles")
    .select("id, username, twitter_handle, principessa_money")
    .eq("username", profileUsername)
    .maybeSingle();

  if (profileError) {
    return Response.json({ error: profileError.message }, { status: 500 });
  }
  if (!profile) {
    return Response.json({ error: `No user matches ${profileUsername}.` }, { status: 404 });
  }

  const previousMoney = Math.max(0, Math.floor(Number(profile.principessa_money) || 0));
  const nextMoney = previousMoney + amount;
  if (nextMoney < 0) {
    return Response.json(
      { error: `@${profile.username} only has ${previousMoney.toLocaleString()} Money.` },
      { status: 422 },
    );
  }

  const sourceKey = typeof body?.sourceKey === "string" && body.sourceKey.trim() ? body.sourceKey.trim() : null;

  // Two-step approval, mirroring /give and /add: a non-allowlisted admin always
  // needs it, and even an allowlisted one needs it past the large-grant line.
  // This is a hand-typed number, so a slipped digit is a real risk - unlike the
  // Throne task payout, which is a fixed function of an already-recorded amount
  // and therefore stays automatic.
  if (!isDirectCoinAdminUserId(admin.adminUser.id) || Math.abs(amount) >= LARGE_MONEY_GRANT_AMOUNT) {
    try {
      const pending = await createPendingCoinAction({
        amount,
        command: "money",
        metadata: { sourceKey, visibility },
        originalCommand: `/${visibility === "silent" ? "moneysilent" : "money"} ${amount} @${profile.username}${sourceKey ? ` ${sourceKey}` : ""}`,
        requestedByUserId: admin.adminUser.id,
        targetUserId: profile.id,
        targetUsername: profile.username,
      });

      return Response.json({
        actionId: pending.id,
        message: `/money ${amount} @${profile.username} requires Companion App approval.`,
        pending: true,
      });
    } catch (pendingError) {
      console.error("Failed to queue pending money grant", pendingError);
      return Response.json({ error: "Failed to queue for approval." }, { status: 500 });
    }
  }

  // Ledger first when a source key is supplied: the unique index is what makes
  // a re-submitted payment a no-op, so it has to land before the balance moves.
  if (sourceKey) {
    const { error: duplicateError } = await admin.supabase.from("money_transactions").insert({
      amount,
      balance_after: nextMoney,
      balance_before: previousMoney,
      metadata: {
        adminId: admin.adminUser.id,
        note: body?.note ?? null,
        ...getMoneyGrantMetadata(visibility, amount),
      },
      reason: getMoneyGrantReason(visibility),
      source_key: sourceKey,
      user_id: profile.id,
    });

    if (duplicateError) {
      const isDuplicate = duplicateError.code === "23505";
      return Response.json(
        { error: isDuplicate ? `This payment (${sourceKey}) was already credited.` : duplicateError.message },
        { status: isDuplicate ? 409 : 500 },
      );
    }
  }

  const { data: updated, error: updateError } = await admin.supabase
    .from("profiles")
    .update({ principessa_money: nextMoney, updated_at: new Date().toISOString() })
    .eq("id", profile.id)
    .eq("principessa_money", previousMoney)
    .select("id, principessa_money")
    .maybeSingle();

  if (updateError || !updated) {
    if (sourceKey) {
      await admin.supabase.from("money_transactions").delete().eq("source_key", sourceKey);
    }
    return Response.json(
      { error: updateError?.message ?? "Balance changed, try again." },
      { status: updateError ? 500 : 409 },
    );
  }

  if (!sourceKey) {
    await admin.supabase.from("money_transactions").insert({
      amount,
      balance_after: nextMoney,
      balance_before: previousMoney,
      metadata: {
        adminId: admin.adminUser.id,
        note: body?.note ?? null,
        ...getMoneyGrantMetadata(visibility, amount),
      },
      reason: getMoneyGrantReason(visibility),
      user_id: profile.id,
    });
  }

  return Response.json({
    balance: nextMoney,
    message: `${amount > 0 ? "+" : ""}${amount.toLocaleString()} Money → @${profile.username} (now ${nextMoney.toLocaleString()}).`,
    username: profile.username,
  });
}
