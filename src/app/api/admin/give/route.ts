import { getSupabaseAdminConfigErrors, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { isDirectCoinAdminUserId } from "@/lib/admin-identity";
import { maybeSendAdminCoinSecurityPush } from "@/lib/admin-coin-security-alerts";
import { requireAdminProfile } from "@/lib/admin-guard";
import { awardDevotion } from "@/lib/devotion";
import { createPendingCoinAction } from "@/lib/pending-admin-actions";

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
  const configErrors = getSupabaseAdminConfigErrors();

  if (!isSupabaseAdminConfigured) {
    console.error("Admin Supabase route is not configured", configErrors);
    return Response.json(
      {
        error: `Admin Supabase environment is not configured: ${configErrors.join(", ")}`,
      },
      { status: 500 },
    );
  }

  const body = (await request.json()) as {
    command?: string;
  };

  const admin = await requireAdminProfile();

  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  const command = body.command?.trim() ?? "";
  const giveMatch = command.match(/^\/give\s+([1-9]\d*)\s+(@[A-Za-z0-9_.-]+)$/);
  const addMatch = command.match(/^\/add\s+([1-9]\d*)\s+(@[A-Za-z0-9_.-]+)$/);
  const drainMatch = command.match(/^\/drain\s+([1-9]\d*)\s+(@[A-Za-z0-9_.-]+)$/);
  const timeoutMatch = command.match(/^\/timeout\s+(@[A-Za-z0-9_.-]+)\s+([1-9]\d*)$/);
  const timeoutRemoveMatch = command.match(/^\/timeout\s+remove\s+(@[A-Za-z0-9_.-]+)$/);
  const titleMatch = command.match(/^\/title\s+(@[A-Za-z0-9_.-]+)$/);

  if (!giveMatch && !addMatch && !drainMatch && !timeoutMatch && !timeoutRemoveMatch && !titleMatch) {
    return Response.json(
      {
        error:
          "Invalid command. Use: /give 500 @username, /add 500 @username, /drain 500 @username, /timeout @username 30, /timeout remove @username, or /title @username",
      },
      { status: 400 },
    );
  }

  const amount = giveMatch
    ? Number(giveMatch[1])
    : addMatch
      ? Number(addMatch[1])
      : drainMatch
        ? Number(drainMatch[1])
      : Number(timeoutMatch?.[2]);
  const username = (giveMatch?.[2] ?? addMatch?.[2] ?? drainMatch?.[2] ?? timeoutMatch?.[1] ?? timeoutRemoveMatch?.[1] ?? "")
    || titleMatch?.[1]
    || "";
  const normalizedUsername = username
    .toLowerCase();

  const supabase = admin.supabase;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, twitter_handle, coins")
    .eq("username", normalizedUsername)
    .maybeSingle();

  if (profileError) {
    console.error("Admin profile lookup failed", profileError);
    return Response.json({ error: profileError.message }, { status: 500 });
  }

  if (!profile) {
    return Response.json(
      { error: "User not found in Supabase profiles." },
      { status: 404 },
    );
  }

  // /add and /give require two-step approval unless the verified Supabase user id is explicitly allowlisted.
  if ((giveMatch || addMatch) && !isDirectCoinAdminUserId(admin.adminUser.id)) {
    const cmd = giveMatch ? "give" : "add";
    try {
      const pending = await createPendingCoinAction({
        requestedByUserId: admin.adminUser.id,
        command: cmd,
        targetUserId: profile.id,
        targetUsername: profile.username,
        amount,
        originalCommand: command,
      });
      return Response.json({
        pending: true,
        actionId: pending.id,
        message: `/${cmd} ${amount} @${profile.username} queued for Companion App approval (expires in ~5 min).`,
        command: cmd,
        username: profile.username,
        amount,
      });
    } catch (e) {
      console.error("Failed to queue pending admin action", e);
      return Response.json({ error: "Failed to create approval request. Try again." }, { status: 500 });
    }
  }

  if (timeoutMatch) {
    const timeoutMinutes = Number(timeoutMatch[2]);
    const timeoutUntil = new Date(Date.now() + timeoutMinutes * 60 * 1000).toISOString();
    const { error: timeoutError } = await supabase
      .from("profiles")
      .update({ timeout_reason: null, timeout_until: timeoutUntil, updated_at: new Date().toISOString() })
      .eq("id", profile.id);

    if (timeoutError) {
      console.error("Admin timeout update failed", timeoutError);
      return Response.json({ error: timeoutError.message }, { status: 500 });
    }

    return Response.json({
      message: `${profile.username} timed out for ${timeoutMinutes} minutes.`,
      username: profile.username,
      timeoutUntil,
    });
  }

  if (timeoutRemoveMatch) {
    const { error: timeoutError } = await supabase
      .from("profiles")
      .update({ timeout_reason: null, timeout_until: null, updated_at: new Date().toISOString() })
      .eq("id", profile.id);

    if (timeoutError) {
      console.error("Admin timeout remove command failed", timeoutError);
      return Response.json({ error: timeoutError.message }, { status: 500 });
    }

    return Response.json({
      message: `${profile.username} timeout removed.`,
      username: profile.username,
      timeoutUntil: null,
    });
  }

  if (titleMatch) {
    const { error: titleError } = await supabase.from("user_titles").upsert(
      {
        user_id: profile.id,
        title_id: "admin-principessas-chosen",
        source: "admin",
        equipped: false,
      },
      { onConflict: "user_id,title_id" },
    );

    if (titleError) {
      console.error("Admin title grant failed", titleError);
      return Response.json({ error: titleError.message }, { status: 500 });
    }

    return Response.json({
      message: `Granted Principessa's Chosen title to ${profile.username}.`,
      username: profile.username,
    });
  }

  const previousCoins = Number(profile.coins ?? 0);
  const coinDelta = drainMatch ? -amount : amount;
  const nextCoins = previousCoins + coinDelta;
  const giveBonusPercent = giveMatch ? getGiveBonusPercent(amount) : 0;
  const giveBonusAmount = Math.floor(amount * giveBonusPercent);
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      coins: nextCoins,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  if (updateError) {
    console.error("Admin coin update failed", updateError);
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  const transactionReason = giveMatch ? "throne_tribute" : drainMatch ? "admin_drain" : "admin_add";
  const { data: transaction, error: transactionError } = await supabase
    .from("coin_transactions")
    .insert({
      user_id: profile.id,
      admin_user_id: admin.adminUser.id,
      amount: coinDelta,
      reason: transactionReason,
      balance_before: previousCoins,
      balance_after: nextCoins,
      metadata: {
        command: giveMatch ? "give" : drainMatch ? "drain" : "add",
        kind: giveMatch ? "manual_coin_purchase" : drainMatch ? "coin_loss_request" : "admin_adjustment",
        purchaseType: giveMatch ? "real_money" : drainMatch ? "coin_loss" : "admin_adjustment",
        source: giveMatch ? "throne" : "admin",
        verifiedAdminUserId: admin.adminUser.id,
        requestedAmount: amount,
        tributeTotalChanged: false,
        target_username_snapshot: profile.username,
      },
    })
    .select("id, amount, reason, created_at")
    .single();

  if (transactionError) {
    console.error("Admin coin transaction insert failed", transactionError);
    const { error: rollbackError } = await supabase
      .from("profiles")
      .update({
        coins: previousCoins,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id)
      .eq("coins", nextCoins);

    if (rollbackError) {
      console.error("Admin coin rollback failed", rollbackError);
    }

    return Response.json({ error: "Admin coin logging failed." }, { status: 500 });
  }

  let bonusTransaction: {
    id: string;
    amount: number;
    reason: string;
    created_at: string;
  } | null = null;
  let finalCoins = nextCoins;
  const giveDevotionAmount = giveMatch ? getGiveDevotionAmount(amount) : 0;

  if (giveMatch && giveBonusAmount > 0) {
    const bonusBalanceBefore = nextCoins;
    const bonusBalanceAfter = nextCoins + giveBonusAmount;
    const { error: bonusUpdateError } = await supabase
      .from("profiles")
      .update({
        coins: bonusBalanceAfter,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    if (bonusUpdateError) {
      console.error("Admin give bonus coin update failed", bonusUpdateError);
      if (transaction?.id) {
        const { error: mainTxCleanupError } = await supabase
          .from("coin_transactions")
          .delete()
          .eq("id", transaction.id);

        if (mainTxCleanupError) {
          console.error("Admin give main transaction cleanup after bonus failure failed", mainTxCleanupError);
        }
      }

      const { error: rollbackError } = await supabase
        .from("profiles")
        .update({
          coins: previousCoins,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id)
        .eq("coins", nextCoins);

      if (rollbackError) {
        console.error("Admin give profile rollback after bonus failure failed", rollbackError);
      }

      return Response.json({ error: "Admin bonus coin logging failed." }, { status: 500 });
    } else {
      finalCoins = bonusBalanceAfter;

      const { data: insertedBonusTransaction, error: bonusTransactionError } = await supabase
        .from("coin_transactions")
        .insert({
          user_id: profile.id,
          admin_user_id: admin.adminUser.id,
          amount: giveBonusAmount,
          reason: "give_bonus",
          balance_before: bonusBalanceBefore,
          balance_after: bonusBalanceAfter,
          metadata: {
            command: "give",
            kind: "admin_give_bonus",
            source: "admin",
            verifiedAdminUserId: admin.adminUser.id,
            baseAmount: amount,
            bonusPercent: giveBonusPercent,
            bonusTierAmount: amount,
            balanceTierBeforeGive: previousCoins,
            tributeTotalChanged: false,
          },
        })
        .select("id, amount, reason, created_at")
        .single();

      if (bonusTransactionError) {
        console.error("Admin give bonus transaction insert failed", bonusTransactionError);
        if (transaction?.id) {
          const { error: mainTxCleanupError } = await supabase
            .from("coin_transactions")
            .delete()
            .eq("id", transaction.id);

          if (mainTxCleanupError) {
            console.error("Admin give main transaction cleanup after bonus tx failure failed", mainTxCleanupError);
          }
        }

        const { error: rollbackError } = await supabase
          .from("profiles")
          .update({
            coins: previousCoins,
            updated_at: new Date().toISOString(),
          })
          .eq("id", profile.id)
          .eq("coins", bonusBalanceAfter);

        if (rollbackError) {
          console.error("Admin give profile rollback after bonus tx failure failed", rollbackError);
        }

        return Response.json({ error: "Admin bonus coin logging failed." }, { status: 500 });
      } else {
        bonusTransaction = insertedBonusTransaction;
      }
    }
  }

  if (giveMatch) {
    if (transaction?.id && giveDevotionAmount > 0) {
      try {
        await awardDevotion(supabase, {
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
        console.error("Admin give devotion award failed", devotionError);
      }
    }

    const { data: giftRows, error: giftTotalError } = await supabase
      .from("coin_transactions")
      .select("amount")
      .eq("user_id", profile.id)
      .in("reason", ["throne_tribute", "live_gift"]);

    if (giftTotalError) {
      console.error("Throne title milestone total lookup failed", giftTotalError);
    } else {
      const giftTotal = (giftRows ?? []).reduce(
        (sum, row) => sum + Math.max(0, Number(row.amount ?? 0)),
        0,
      );
      const milestoneTitles = [
        { min: 10000, titleId: "throne-10000" },
        { min: 25000, titleId: "throne-25000" },
        { min: 100000, titleId: "throne-100000" },
      ].filter((milestone) => giftTotal >= milestone.min);

      if (milestoneTitles.length > 0) {
        const { error: titleError } = await supabase.from("user_titles").upsert(
          milestoneTitles.map((milestone) => ({
            user_id: profile.id,
            title_id: milestone.titleId,
            source: "throne",
            equipped: false,
          })),
          { onConflict: "user_id,title_id" },
        );

        if (titleError) {
          console.error("Throne title milestone unlock failed", titleError);
        }
      }
    }
  }

  if (giveMatch || addMatch) {
    await maybeSendAdminCoinSecurityPush(supabase, {
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
      : `Added ${amount} coins to ${profile.username}.`,
    username: profile.username,
    coins: finalCoins,
    transaction,
    bonusTransaction,
  });
}
