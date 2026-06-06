import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { isTrustedAdminUsername } from "@/lib/admin-identity";

async function getAdminUserId() {
  const authSupabase = await createSupabaseServerClient();
  const { data } = await authSupabase.auth.getUser();

  if (!data.user) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("username, is_admin")
    .eq("id", data.user.id)
    .maybeSingle();

  if (error) {
    console.error("Admin command auth profile lookup failed", error);
    return null;
  }

  const allowed = isTrustedAdminUsername(profile?.username);

  return allowed ? data.user.id : null;
}

function getGiveBonusPercent(currentCoins: number) {
  if (currentCoins >= 100000) {
    return 0.25;
  }

  if (currentCoins >= 50000) {
    return 0.2;
  }

  if (currentCoins >= 20000) {
    return 0.15;
  }

  if (currentCoins >= 10000) {
    return 0.1;
  }

  return 0;
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

  const adminUserId = await getAdminUserId();

  if (!adminUserId) {
    return Response.json({ error: "Admin access required." }, { status: 401 });
  }

  const command = body.command?.trim() ?? "";
  const giveMatch = command.match(/^\/give\s+([1-9]\d*)\s+(@[A-Za-z0-9_.-]+)$/);
  const addMatch = command.match(/^\/add\s+([1-9]\d*)\s+(@[A-Za-z0-9_.-]+)$/);
  const timeoutMatch = command.match(/^\/timeout\s+(@[A-Za-z0-9_.-]+)\s+([1-9]\d*)$/);
  const timeoutRemoveMatch = command.match(/^\/timeout\s+remove\s+(@[A-Za-z0-9_.-]+)$/);
  const titleMatch = command.match(/^\/title\s+(@[A-Za-z0-9_.-]+)$/);

  if (!giveMatch && !addMatch && !timeoutMatch && !timeoutRemoveMatch && !titleMatch) {
    return Response.json(
      {
        error:
          "Invalid command. Use: /give 500 @username, /add 500 @username, /timeout @username 30, /timeout remove @username, or /title @username",
      },
      { status: 400 },
    );
  }

  const amount = giveMatch
    ? Number(giveMatch[1])
    : addMatch
      ? Number(addMatch[1])
      : Number(timeoutMatch?.[2]);
  const username = (giveMatch?.[2] ?? addMatch?.[2] ?? timeoutMatch?.[1] ?? timeoutRemoveMatch?.[1] ?? "")
    || titleMatch?.[1]
    || "";
  const normalizedUsername = username
    .toLowerCase();
  const supabase = createSupabaseAdminClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, coins")
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

  if (timeoutMatch) {
    const timeoutMinutes = Number(timeoutMatch[2]);
    const timeoutUntil = new Date(Date.now() + timeoutMinutes * 60 * 1000).toISOString();
    const { error: timeoutError } = await supabase
      .from("profiles")
      .update({ timeout_until: timeoutUntil, updated_at: new Date().toISOString() })
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
      .update({ timeout_until: null, updated_at: new Date().toISOString() })
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
  const nextCoins = previousCoins + amount;
  const giveBonusPercent = giveMatch ? getGiveBonusPercent(previousCoins) : 0;
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

  const transactionReason = giveMatch ? "throne_tribute" : "admin_add";
  const { data: transaction, error: transactionError } = await supabase
    .from("coin_transactions")
    .insert({
      user_id: profile.id,
      admin_user_id: adminUserId,
      amount,
      reason: transactionReason,
      balance_before: previousCoins,
      balance_after: nextCoins,
      metadata: {
        command: giveMatch ? "give" : "add",
        kind: giveMatch ? "manual_coin_purchase" : "admin_adjustment",
        source: giveMatch ? "throne" : "admin",
        tributeTotalChanged: false,
      },
    })
    .select("id, amount, reason, created_at")
    .single();

  if (transactionError) {
    console.error("Admin coin transaction insert failed", transactionError);
  }

  let bonusTransaction: {
    id: string;
    amount: number;
    reason: string;
    created_at: string;
  } | null = null;
  let finalCoins = nextCoins;

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
    } else {
      finalCoins = bonusBalanceAfter;

      const { data: insertedBonusTransaction, error: bonusTransactionError } = await supabase
        .from("coin_transactions")
        .insert({
          user_id: profile.id,
          admin_user_id: adminUserId,
          amount: giveBonusAmount,
          reason: "give_bonus",
          balance_before: bonusBalanceBefore,
          balance_after: bonusBalanceAfter,
          metadata: {
            command: "give",
            kind: "admin_give_bonus",
            source: "admin",
            baseAmount: amount,
            bonusPercent: giveBonusPercent,
            balanceTierBeforeGive: previousCoins,
            tributeTotalChanged: false,
          },
        })
        .select("id, amount, reason, created_at")
        .single();

      if (bonusTransactionError) {
        console.error("Admin give bonus transaction insert failed", bonusTransactionError);
      } else {
        bonusTransaction = insertedBonusTransaction;
      }
    }
  }

  if (giveMatch) {
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

  return Response.json({
    message: giveMatch
      ? `Granted ${
          giveBonusAmount > 0
            ? `${amount.toLocaleString()} + ${giveBonusAmount.toLocaleString()} bonus`
            : amount.toLocaleString()
        } coins to ${profile.username}.`
      : `Added ${amount} coins to ${profile.username}.`,
    username: profile.username,
    coins: finalCoins,
    transaction,
    bonusTransaction,
  });
}
