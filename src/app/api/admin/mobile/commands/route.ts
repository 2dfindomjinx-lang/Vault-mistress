import { maybeSendAdminCoinSecurityPush } from "@/lib/admin-coin-security-alerts";
import { isDirectCoinAdminUserId } from "@/lib/admin-identity";
import { ADMIN_GRANTABLE_TITLE_IDS, getTitleItem } from "@/lib/cosmetics";
import { CRATE_TYPES } from "@/lib/crates";
import { awardDevotion } from "@/lib/devotion";
import { requireMobileAdmin } from "@/lib/mobile-admin";
import { createPendingCoinAction } from "@/lib/pending-admin-actions";
import { LARGE_MONEY_GRANT_AMOUNT } from "@/lib/principessa-money";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

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

function getGiveDevotionAmount(baseAmount: number) {
  return Math.floor(baseAmount * 0.01);
}

export async function POST(request: Request) {
  const admin = await requireMobileAdmin(request);
  if ("error" in admin) return Response.json({ error: admin.error }, { status: admin.status });

  const rateLimit = await checkRateLimit(admin.supabase, `admin-mobile-give:${admin.adminUser.id}`, 30, 60);
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfterSeconds);
  }

  const body = (await request.json().catch(() => null)) as { command?: string } | null;
  const command = body?.command?.trim() ?? "";
  const giveMatch = command.match(/^\/give\s+([1-9]\d*)\s+(@[A-Za-z0-9_.-]+)$/);
  const addMatch = command.match(/^\/add\s+([1-9]\d*)\s+(@[A-Za-z0-9_.-]+)$/);
  const drainMatch = command.match(/^\/drain\s+([1-9]\d*)\s+(@[A-Za-z0-9_.-]+)$/);
  const timeoutMatch = command.match(/^\/timeout\s+(@[A-Za-z0-9_.-]+)\s+([1-9]\d*)$/);
  const timeoutRemoveMatch = command.match(/^\/timeout\s+remove\s+(@[A-Za-z0-9_.-]+)$/);
  const titleMatch = command.match(/^\/title\s+(@[A-Za-z0-9_.-]+)(?:\s+([A-Za-z-]+))?$/);
  const keyMatch = command.match(/^\/key\s+(@[A-Za-z0-9_.-]+)\s+([A-Za-z_]+)\s+([1-9]\d*)$/);
  // Principessa Money. Negative amounts are allowed (claw-back), and the
  // optional third token is a Throne order id used as an idempotency key.
  // Has its own approval gate further down - it is not folded into the
  // /give + /add one because it pays out of a different balance.
  const moneyMatch = command.match(/^\/money\s+(-?[1-9]\d*)\s+(@[A-Za-z0-9_.-]+)(?:\s+(\S+))?$/);

  if (!giveMatch && !addMatch && !drainMatch && !timeoutMatch && !timeoutRemoveMatch && !titleMatch && !keyMatch && !moneyMatch) {
    return Response.json(
      { error: "Use /give 500 @username, /add 500 @username, /money 25 @username, /drain 500 @username, /timeout @username 30, /timeout remove @username, /title @username [chosen|femsub], or /key @username case_name amount" },
      { status: 400 },
    );
  }

  const titleKey = (titleMatch?.[2] ?? "chosen").toLowerCase();
  const titleIdToGrant = titleMatch ? ADMIN_GRANTABLE_TITLE_IDS[titleKey] : undefined;

  if (titleMatch && !titleIdToGrant) {
    return Response.json(
      { error: `Unknown title "${titleKey}". Use: /title @username [${Object.keys(ADMIN_GRANTABLE_TITLE_IDS).join("|")}]` },
      { status: 400 },
    );
  }

  const crateTypeKey = (keyMatch?.[2] ?? "").toLowerCase();
  const crateTypeToGrant = keyMatch && crateTypeKey in CRATE_TYPES ? crateTypeKey : undefined;
  const keyAmount = keyMatch ? Number(keyMatch[3]) : undefined;

  if (keyMatch && !crateTypeToGrant) {
    return Response.json(
      { error: `Unknown case "${crateTypeKey}". Use: /key @username [${Object.keys(CRATE_TYPES).join("|")}] amount` },
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
    keyMatch?.[1] ??
    moneyMatch?.[2] ??
    ""
  ).replace(/^@/, "").toLowerCase();
  const { data: profile, error: profileError } = await admin.supabase
    .from("profiles")
    .select("id, username, twitter_handle, coins, principessa_money")
    .eq("username", username)
    .maybeSingle();

  if (profileError) return Response.json({ error: profileError.message }, { status: 500 });
  if (!profile) return Response.json({ error: "User not found." }, { status: 404 });

  const coinAmount = Number(giveMatch?.[1] ?? addMatch?.[1] ?? drainMatch?.[1] ?? 0);

  // /add and /give require two-step approval unless the verified Supabase user id is explicitly allowlisted.
  if ((giveMatch || addMatch) && !isDirectCoinAdminUserId(admin.adminUser.id)) {
    const cmd = giveMatch ? "give" : "add";
    try {
      const pending = await createPendingCoinAction({
        requestedByUserId: admin.adminUser.id,
        command: cmd,
        targetUserId: profile.id,
        targetUsername: profile.username,
        amount: coinAmount,
        originalCommand: command,
      });
      return Response.json({
        pending: true,
        actionId: pending.id,
        message: `/${cmd} ${coinAmount} @${profile.username} requires Companion App approval.`,
      });
    } catch (e) {
      console.error("Mobile: failed to queue pending", e);
      return Response.json({ error: "Failed to queue for approval." }, { status: 500 });
    }
  }

  if (moneyMatch) {
    const moneyAmount = Number(moneyMatch[1]);
    const sourceKey = moneyMatch[3]?.trim() || null;

    // Same two-step gate as /give and /add. A hand-typed amount can slip a
    // digit; the Throne task payout cannot, which is why that one stays direct.
    if (!isDirectCoinAdminUserId(admin.adminUser.id) || Math.abs(moneyAmount) >= LARGE_MONEY_GRANT_AMOUNT) {
      try {
        const pending = await createPendingCoinAction({
          amount: moneyAmount,
          command: "money",
          metadata: { sourceKey },
          originalCommand: command,
          requestedByUserId: admin.adminUser.id,
          targetUserId: profile.id,
          targetUsername: profile.username,
        });
        return Response.json({
          actionId: pending.id,
          message: `/money ${moneyAmount} @${profile.username} requires Companion App approval.`,
          pending: true,
        });
      } catch (pendingError) {
        console.error("Mobile: failed to queue pending money grant", pendingError);
        return Response.json({ error: "Failed to queue for approval." }, { status: 500 });
      }
    }

    const previousMoney = Math.max(0, Math.floor(Number(profile.principessa_money) || 0));
    const nextMoney = previousMoney + moneyAmount;

    if (nextMoney < 0) {
      return Response.json(
        { error: `@${profile.username} only has ${previousMoney.toLocaleString()} Money.` },
        { status: 422 },
      );
    }

    // Ledger first when an order id is supplied: the partial unique index on
    // money_transactions.source_key is what makes a re-submitted payment a
    // no-op instead of a second credit.
    if (sourceKey) {
      const { error: duplicateError } = await admin.supabase.from("money_transactions").insert({
        amount: moneyAmount,
        balance_after: nextMoney,
        balance_before: previousMoney,
        metadata: { adminUserId: admin.adminUser.id, source: "mobile_console" },
        reason: "admin:money-grant",
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

    const { data: updated, error: moneyError } = await admin.supabase
      .from("profiles")
      .update({ principessa_money: nextMoney, updated_at: new Date().toISOString() })
      .eq("id", profile.id)
      .eq("principessa_money", previousMoney)
      .select("id")
      .maybeSingle();

    if (moneyError || !updated) {
      if (sourceKey) {
        await admin.supabase.from("money_transactions").delete().eq("source_key", sourceKey);
      }
      return Response.json(
        { error: moneyError?.message ?? "Balance changed, try again." },
        { status: moneyError ? 500 : 409 },
      );
    }

    if (!sourceKey) {
      await admin.supabase.from("money_transactions").insert({
        amount: moneyAmount,
        balance_after: nextMoney,
        balance_before: previousMoney,
        metadata: { adminUserId: admin.adminUser.id, source: "mobile_console" },
        reason: "admin:money-grant",
        user_id: profile.id,
      });
    }

    return Response.json({
      message: `${moneyAmount > 0 ? "+" : ""}${moneyAmount.toLocaleString()} Money → @${profile.username} (now ${nextMoney.toLocaleString()}).`,
    });
  }

  if (timeoutMatch) {
    const timeoutMinutes = Number(timeoutMatch[2]);
    const timeoutUntil = new Date(Date.now() + timeoutMinutes * 60 * 1000).toISOString();
    const { error } = await admin.supabase
      .from("profiles")
      .update({ timeout_reason: null, timeout_until: timeoutUntil, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ message: `${profile.username} timed out for ${timeoutMinutes} minutes.` });
  }

  if (timeoutRemoveMatch) {
    const { error } = await admin.supabase
      .from("profiles")
      .update({ timeout_reason: null, timeout_until: null, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ message: `${profile.username} timeout removed.` });
  }

  if (titleMatch && titleIdToGrant) {
    const { error } = await admin.supabase.from("user_titles").upsert(
      {
        user_id: profile.id,
        title_id: titleIdToGrant,
        source: "admin",
        equipped: false,
      },
      { onConflict: "user_id,title_id" },
    );
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ message: `Granted ${getTitleItem(titleIdToGrant)?.name ?? titleIdToGrant} title to ${profile.username}.` });
  }

  if (keyMatch && crateTypeToGrant && keyAmount) {
    const { error } = await admin.supabase.from("user_crate_open_grants").insert({
      user_id: profile.id,
      crate_type: crateTypeToGrant,
      goal_id: `admin-key-grant:${Date.now()}`,
      source: "admin",
      total_opens: keyAmount,
      remaining_opens: keyAmount,
    });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({
      message: `Granted ${keyAmount} ${CRATE_TYPES[crateTypeToGrant]?.name ?? crateTypeToGrant} open${keyAmount === 1 ? "" : "s"} to ${profile.username}.`,
    });
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

  const targetUsernameSnapshot = profile.username;
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
      purchaseType: giveMatch ? "real_money" : drainMatch ? "coin_loss" : "admin_adjustment",
      source: giveMatch ? "throne" : "mobile_admin",
      verifiedAdminUserId: admin.adminUser.id,
      requestedAmount: amount,
      tributeTotalChanged: false,
      target_username_snapshot: targetUsernameSnapshot,
    },
  }).select("id").single();

  if (transactionError) {
    await admin.supabase.from("profiles").update({ coins: previousCoins }).eq("id", profile.id).eq("coins", nextCoins);
    return Response.json({ error: transactionError.message }, { status: 500 });
  }

  let finalCoins = nextCoins;
  const giveDevotionAmount = giveMatch ? getGiveDevotionAmount(amount) : 0;

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
        verifiedAdminUserId: admin.adminUser.id,
        baseAmount: amount,
        bonusPercent: giveBonusPercent,
        bonusTierAmount: amount,
        balanceTierBeforeGive: previousCoins,
        tributeTotalChanged: false,
        target_username_snapshot: targetUsernameSnapshot,
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

  if (giveMatch && transaction?.id && giveDevotionAmount > 0) {
    try {
      await awardDevotion(admin.supabase, {
        amount: giveDevotionAmount,
        metadata: {
          baseAmount: amount,
          command: "give",
          transactionId: transaction.id,
        },
        source: "admin_give",
        sourceKey: `admin-give:${transaction.id}`,
        userId: profile.id,
      });
    } catch (devotionError) {
      console.error("Mobile admin give devotion award failed", devotionError);
    }
  }

  if (giveMatch || addMatch) {
    await maybeSendAdminCoinSecurityPush(admin.supabase, {
      command: giveMatch ? "give" : "add",
      amount,
      username: profile.username,
      transactionId: transaction?.id,
    });
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
