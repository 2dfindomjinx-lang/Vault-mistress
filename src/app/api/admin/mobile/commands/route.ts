import { requireMobileAdmin } from "@/lib/mobile-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getGiveBonusPercent(giveAmount: number) {
  if (giveAmount >= 100000) {
    return 0.25;
  }

  if (giveAmount >= 50000) {
    return 0.2;
  }

  if (giveAmount >= 20000) {
    return 0.15;
  }

  if (giveAmount >= 10000) {
    return 0.1;
  }

  return 0;
}

export async function POST(request: Request) {
  const admin = await requireMobileAdmin(request);
  if ("error" in admin) return Response.json({ error: admin.error }, { status: admin.status });

  const body = (await request.json().catch(() => null)) as { command?: string } | null;
  const command = body?.command?.trim() ?? "";
  const giveMatch = command.match(/^\/give\s+([1-9]\d*)\s+(@[A-Za-z0-9_.-]+)$/);
  const addMatch = command.match(/^\/add\s+([1-9]\d*)\s+(@[A-Za-z0-9_.-]+)$/);
  const drainMatch = command.match(/^\/drain\s+([1-9]\d*)\s+(@[A-Za-z0-9_.-]+)$/);
  const timeoutMatch = command.match(/^\/timeout\s+(@[A-Za-z0-9_.-]+)\s+([1-9]\d*)$/);
  const timeoutRemoveMatch = command.match(/^\/timeout\s+remove\s+(@[A-Za-z0-9_.-]+)$/);
  const titleMatch = command.match(/^\/title\s+(@[A-Za-z0-9_.-]+)$/);

  if (!giveMatch && !addMatch && !drainMatch && !timeoutMatch && !timeoutRemoveMatch && !titleMatch) {
    return Response.json(
      { error: "Use /give 500 @username, /add 500 @username, /drain 500 @username, /timeout @username 30, /timeout remove @username, or /title @username" },
      { status: 400 },
    );
  }

  const username = (
    giveMatch?.[2] ??
    addMatch?.[2] ??
    drainMatch?.[2] ??
    timeoutMatch?.[1] ??
    timeoutRemoveMatch?.[1] ??
    titleMatch?.[1] ??
    ""
  ).toLowerCase();
  const { data: profile, error: profileError } = await admin.supabase
    .from("profiles")
    .select("id, username, coins")
    .eq("username", username)
    .maybeSingle();

  if (profileError) return Response.json({ error: profileError.message }, { status: 500 });
  if (!profile) return Response.json({ error: "User not found." }, { status: 404 });

  if (timeoutMatch) {
    const timeoutMinutes = Number(timeoutMatch[2]);
    const timeoutUntil = new Date(Date.now() + timeoutMinutes * 60 * 1000).toISOString();
    const { error } = await admin.supabase
      .from("profiles")
      .update({ timeout_until: timeoutUntil, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ message: `${profile.username} timed out for ${timeoutMinutes} minutes.` });
  }

  if (timeoutRemoveMatch) {
    const { error } = await admin.supabase
      .from("profiles")
      .update({ timeout_until: null, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ message: `${profile.username} timeout removed.` });
  }

  if (titleMatch) {
    const { error } = await admin.supabase.from("user_titles").upsert(
      {
        user_id: profile.id,
        title_id: "admin-principessas-chosen",
        source: "admin",
        equipped: false,
      },
      { onConflict: "user_id,title_id" },
    );
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ message: `Granted Principessa's Chosen title to ${profile.username}.` });
  }

  const amount = Number(giveMatch?.[1] ?? addMatch?.[1] ?? drainMatch?.[1]);
  const previousCoins = Number(profile.coins ?? 0);
  const coinDelta = drainMatch ? -amount : amount;
  const nextCoins = previousCoins + coinDelta;
  const reason = giveMatch ? "throne_tribute" : drainMatch ? "admin_drain" : "admin_add";
  const giveBonusPercent = giveMatch ? getGiveBonusPercent(amount) : 0;
  const giveBonusAmount = Math.floor(amount * giveBonusPercent);

  const { error: updateError } = await admin.supabase
    .from("profiles")
    .update({ coins: nextCoins, updated_at: new Date().toISOString() })
    .eq("id", profile.id);
  if (updateError) return Response.json({ error: updateError.message }, { status: 500 });

  const { data: transaction, error: transactionError } = await admin.supabase.from("coin_transactions").insert({
    user_id: profile.id,
    admin_user_id: admin.adminUser.id,
    amount: coinDelta,
    reason,
    balance_before: previousCoins,
    balance_after: nextCoins,
    metadata: {
      command: giveMatch ? "give" : drainMatch ? "drain" : "add",
      kind: giveMatch ? "manual_coin_purchase" : drainMatch ? "coin_loss_request" : "admin_adjustment",
      source: giveMatch ? "throne" : "mobile_admin",
      requestedAmount: amount,
      tributeTotalChanged: false,
    },
  }).select("id").single();

  if (transactionError) {
    await admin.supabase.from("profiles").update({ coins: previousCoins }).eq("id", profile.id).eq("coins", nextCoins);
    return Response.json({ error: transactionError.message }, { status: 500 });
  }

  let finalCoins = nextCoins;

  if (giveMatch && giveBonusAmount > 0) {
    const bonusBalanceAfter = nextCoins + giveBonusAmount;
    const { error: bonusUpdateError } = await admin.supabase
      .from("profiles")
      .update({ coins: bonusBalanceAfter, updated_at: new Date().toISOString() })
      .eq("id", profile.id);

    if (bonusUpdateError) {
      if (transaction?.id) {
        await admin.supabase.from("coin_transactions").delete().eq("id", transaction.id);
      }
      await admin.supabase.from("profiles").update({ coins: previousCoins }).eq("id", profile.id).eq("coins", nextCoins);
      return Response.json({ error: "Mobile admin bonus coin update failed." }, { status: 500 });
    }

    const { error: bonusTransactionError } = await admin.supabase.from("coin_transactions").insert({
      user_id: profile.id,
      admin_user_id: admin.adminUser.id,
      amount: giveBonusAmount,
      reason: "give_bonus",
      balance_before: nextCoins,
      balance_after: bonusBalanceAfter,
      metadata: {
        command: "give",
        kind: "admin_give_bonus",
        source: "mobile_admin",
        baseAmount: amount,
        bonusPercent: giveBonusPercent,
        bonusTierAmount: amount,
        balanceTierBeforeGive: previousCoins,
        tributeTotalChanged: false,
      },
    });

    if (bonusTransactionError) {
      if (transaction?.id) {
        await admin.supabase.from("coin_transactions").delete().eq("id", transaction.id);
      }
      await admin.supabase.from("profiles").update({ coins: previousCoins }).eq("id", profile.id).eq("coins", bonusBalanceAfter);
      return Response.json({ error: "Mobile admin bonus coin logging failed." }, { status: 500 });
    }

    finalCoins = bonusBalanceAfter;
  }

  return Response.json({
    message: giveMatch
      ? `Granted ${
          giveBonusAmount > 0
            ? `${amount.toLocaleString()} + ${giveBonusAmount.toLocaleString()} bonus`
            : amount.toLocaleString()
        } coins to ${profile.username}.`
      : drainMatch
        ? `Drained ${amount.toLocaleString()} coins from ${profile.username}.`
      : `Added ${amount.toLocaleString()} coins to ${profile.username}.`,
    coins: finalCoins,
  });
}
