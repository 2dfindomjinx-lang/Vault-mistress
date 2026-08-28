import { verify as verifyEd25519 } from "node:crypto";
import { syncThroneMilestoneTitlesFromLedgers } from "@/lib/admin-pet-task-logs";
import { BIRTHDAY_CANDLE_CODE_MONEY_PERCENT, BIRTHDAY_MONEY_BONUS_PERCENT, getBirthdayWindowState } from "@/lib/birthday";
import { PET_THRONE_TASK_BONUS_PERCENT } from "@/lib/pet-throne";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createUserNotification } from "@/lib/user-notifications";

const THRONE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAPXbUfxh7XL4SYUVcfhmYMIbxvtR9E9LDd8gPJ1PwSD8=
-----END PUBLIC KEY-----`;
const text = (...values: unknown[]) => values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim() ?? "";

function verifySignature(rawBody: string, timestamp: string | null, signatureHex: string | null) {
  if (!timestamp || !/^\d+$/.test(timestamp) || !signatureHex || !/^[0-9a-f]{128}$/i.test(signatureHex)) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  return verifyEd25519(
    null,
    Buffer.from(`${timestamp}.${rawBody}`, "utf8"),
    THRONE_PUBLIC_KEY,
    Buffer.from(signatureHex, "hex"),
  );
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) return Response.json({ error: "Supabase is not configured." }, { status: 500 });
  const rawBody = await request.text();
  const signatureTimestamp = request.headers.get("x-signature-timestamp");
  if (!verifySignature(rawBody, signatureTimestamp, request.headers.get("x-signature-ed25519"))) {
    return Response.json({ error: "Invalid Throne signature." }, { status: 401 });
  }

  let payload: { contract_version?: string; event_id?: string; event_type?: string; data?: Record<string, unknown> };
  try { payload = JSON.parse(rawBody) as typeof payload; } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  if (payload.contract_version !== "1" || !payload.event_id || !["gift_purchased", "contribution_purchased", "gift_crowdfunded"].includes(payload.event_type ?? "")) {
    return Response.json({ error: "Unsupported Throne event." }, { status: 400 });
  }
  const eventId = payload.event_id;
  const data = payload.data ?? {};
  const message = text(data.message);
  const smallestCurrencyUnit = Number(data.amount ?? data.price);
  const currency = text(data.currency).toUpperCase();
  if (!Number.isInteger(smallestCurrencyUnit) || smallestCurrencyUnit <= 0 || currency !== "USD") {
    return Response.json({ error: "Only positive USD Throne events are supported." }, { status: 400 });
  }
  const amount = smallestCurrencyUnit / 100;
  const supabase = createSupabaseAdminClient();
  // The signed header is controlled by Throne and already constrained to a
  // five-minute acceptance window above. Keep it separate from created_at,
  // which is merely when Postgres happened to receive the insert.
  let occurredAt = new Date(Number(signatureTimestamp) * 1000).toISOString();
  const { data: inserted, error: insertError } = await supabase
    .from("throne_webhook_events")
    .insert({ event_id: eventId, occurred_at: occurredAt, payload })
    .select("event_id")
    .maybeSingle();
  if (insertError?.code === "23505") {
    const { data: existing, error: existingError } = await supabase
      .from("throne_webhook_events")
      .select("occurred_at, status")
      .eq("event_id", eventId)
      .maybeSingle();
    if (existingError || !existing) {
      return Response.json({ error: "Could not verify duplicate webhook state." }, { status: 500 });
    }
    if (typeof existing.occurred_at === "string" && existing.occurred_at) {
      occurredAt = existing.occurred_at;
    }
    if (["credited", "unmatched", "ignored"].includes(existing.status)) {
      return Response.json({ ok: true, duplicate: true });
    }
    // A previous delivery can die after inserting but before crediting. Resume
    // received/failed rows; the money RPC has its own source-key idempotency.
  } else if (insertError || !inserted) {
    return Response.json({ error: "Could not record webhook." }, { status: 500 });
  }

  // CK- is the candle code. It identifies the sender exactly like VM- does
  // and credits Money on the same terms; the only difference is that the
  // birthday cake counts an event whose attribution_code starts with CK-
  // and ignores every other payment, so lighting a candle is now opt-in.
  // See supabase/birthday-candles-open.sql.
  // Principessa2DFD shares this code: a Court user tributes with the same VM-
  // code as in the vault, and its wheels run on Principessa Money instead of
  // codes of their own.
  const code = message.match(/\b(?:VM|PT|CK|WL)-[A-Z0-9]{4,8}\b/i)?.[0]?.toUpperCase() ?? null;
  const isPetBonusCode = Boolean(code?.startsWith("PT-"));
  const isCandleCode = Boolean(code?.startsWith("CK-"));
  const isWheelCode = Boolean(code?.startsWith("WL-"));

  // WL- is a wheel debt payment, and it deliberately does NOT flow into
  // credit_throne_tribute: paying a wheel order must not hand the debtor the
  // same dollars back as Principessa Money. The RPC accumulates the payment
  // against the spin (partials reduce the debt), counts the real dollars in
  // tribute_total and devotion, and nothing else.
  if (isWheelCode && code) {
    const { data: wheelResult, error: wheelError } = await supabase.rpc("apply_wheel_throne_payment", {
      p_amount_usd: amount,
      p_event_id: eventId,
      p_pay_code: code,
    });

    const wheel = (wheelResult ?? {}) as {
      error?: string;
      remaining?: number;
      status?: string;
      userId?: string;
    };

    if (wheelError || wheel.error) {
      // Unknown or waived code: keep the payment visible to the admin instead
      // of silently dropping real money - same path as an unmatched tribute.
      console.error("Wheel payment could not be applied", { code, eventId, wheel, wheelError });
      const { error: claimError } = await supabase
        .from("tribute_claims")
        .upsert({ event_id: eventId, amount, message }, { ignoreDuplicates: true, onConflict: "event_id" });
      if (claimError) {
        return Response.json({ error: "Could not queue unmatched wheel payment." }, { status: 500 });
      }
      await supabase
        .from("throne_webhook_events")
        .update({ status: "unmatched", processed_at: new Date().toISOString() })
        .eq("event_id", eventId);
      return Response.json({ manualActionRequired: true, matched: false, ok: true });
    }

    await supabase
      .from("throne_webhook_events")
      .update({
        attribution_code: code,
        processed_at: new Date().toISOString(),
        status: "credited",
        user_id: wheel.userId ?? null,
      })
      .eq("event_id", eventId);

    if (wheel.userId) {
      try {
        await createUserNotification(supabase, {
          body:
            wheel.status === "paid"
              ? "Your wheel debt is settled. She noticed."
              : `Payment received. $${(wheel.remaining ?? 0).toLocaleString()} of your wheel debt remains.`,
          kind: "wheel_payment_received",
          metadata: { code, eventId, remaining: wheel.remaining ?? 0, status: wheel.status },
          title: wheel.status === "paid" ? "Wheel debt paid" : "Wheel debt reduced",
          userId: wheel.userId,
        });
      } catch (notificationError) {
        console.error("Wheel payment notification failed", notificationError);
      }
    }

    return Response.json({ ok: true, wheel: { remaining: wheel.remaining ?? 0, status: wheel.status } });
  }

  // Principessa2DFD wheels moved onto Principessa Money and the shared
  // public.wheel_spins ledger, so the Court no longer issues payment codes of
  // its own (W1-W4 keys, WD- debts) and nothing here has to match a payment to
  // a wheel row. Its debts are settled with PM, or on Throne with the WL- code
  // the vault already issues and handles above.
  const codeColumn = isPetBonusCode ? "pet_tribute_code" : isCandleCode ? "candle_code" : "tribute_code";
  const profile: { id: string; username: string | null } | null = code
    ? (await supabase
        .from("profiles")
        .select("id, username")
        .ilike(codeColumn, code)
        .maybeSingle()).data
    : null;

  if (!profile) {
    const { error: claimError } = await supabase
      .from("tribute_claims")
      .upsert({ event_id: eventId, amount, message }, { ignoreDuplicates: true, onConflict: "event_id" });
    if (claimError) {
      console.error("Unmatched Throne claim persistence failed", { claimError, eventId });
      return Response.json({ error: "Could not queue unmatched tribute." }, { status: 500 });
    }
    // Finalize only after the claim exists. If this update fails, a webhook
    // retry sees a resumable event and safely upserts the same claim again.
    const { error: unmatchedError } = await supabase
      .from("throne_webhook_events")
      .update({ status: "unmatched", processed_at: new Date().toISOString() })
      .eq("event_id", eventId);
    if (unmatchedError) {
      console.error("Unmatched Throne event finalization failed", { eventId, unmatchedError });
      return Response.json({ error: "Could not finalize unmatched tribute." }, { status: 500 });
    }
    return Response.json({
      ok: true,
      matched: false,
      manualActionRequired: true,
      message: "Automation could not identify the recipient. Ask the sender to DM Principessa for manual credit.",
    });
  }

  // The tribute is paid in Principessa Money at a flat 1 USD = 1 PM. The coin
  // figure is only the equivalent at base rate (1 PM = 1000 coins, price is in
  // cents) and the RPC uses it purely for the coin-denominated things that hang
  // off a tribute - tribute_total and the devotion scale. The old give/task
  // bonuses are not applied here any more; they moved onto the PM -> Coin
  // conversion, and paying them at both ends would double them.
  const coinEquivalent = Math.max(1, smallestCurrencyUnit * 10);
  // Use Throne's signed occurrence time, not delivery/processing time. A retry
  // after the court closes must retain the reward earned inside the window,
  // and a late delivery cannot manufacture eligibility.
  const birthdayMoneyBonusPercent = getBirthdayWindowState(occurredAt).isLive
    ? BIRTHDAY_MONEY_BONUS_PERCENT
    : 0;
  // The RPC is the authority on the payout: only it knows whether the sender
  // has actually unlocked the Pet track, which is what decides between the
  // plain rate and base + PET_THRONE_TASK_BONUS_PERCENT rounded up. The figure
  // echoed back below comes from the RPC result, never from this guess.
  const { data: credit, error: creditError } = await supabase.rpc("credit_throne_tribute", {
    p_amount: amount,
    p_birthday_bonus_percent: birthdayMoneyBonusPercent,
    // Only bites when the code actually starts with CK-; the RPC decides.
    p_candle_money_percent: BIRTHDAY_CANDLE_CODE_MONEY_PERCENT,
    p_code: code,
    p_coins: coinEquivalent,
    p_event_id: eventId,
    p_pet_bonus_percent: PET_THRONE_TASK_BONUS_PERCENT,
    p_user_id: profile.id,
  });
  if (creditError) {
    await supabase.from("throne_webhook_events").update({ status: "failed", processed_at: new Date().toISOString() }).eq("event_id", eventId);
    try {
      await createUserNotification(supabase, {
        body: "Your Throne tribute could not be credited automatically. DM Principessa with your Throne receipt so your Principessa Money can be added manually.",
        kind: "throne_automation_failed",
        metadata: { eventId, tributeCode: code, reason: creditError.message },
        title: "Throne Automation Needs Help",
        userId: profile.id,
      });
    } catch (notificationError) {
      console.error("Throne automation failure notification failed", notificationError);
    }
    return Response.json({ error: creditError.message }, { status: 409 });
  }
  // Milestone titles used to move only when an admin approved something by
  // hand, which meant a fully automated payer never got one. The ledgers always
  // had the data - nothing recomputed from them. Failure is logged, never
  // fatal: the money is already credited and the next sync catches up.
  try {
    await syncThroneMilestoneTitlesFromLedgers(supabase, profile.id);
  } catch (titleError) {
    console.error("Throne milestone title sync failed", { eventId, titleError });
  }

  const { error: creditedEventError } = await supabase
    .from("throne_webhook_events")
    .update({ attribution_code: code, processed_at: new Date().toISOString(), status: "credited", user_id: profile.id })
    .eq("event_id", eventId);
  if (creditedEventError) {
    console.error("Credited Throne event finalization failed", { error: creditedEventError, eventId });
    return Response.json({ error: "Tribute was credited but its event could not be finalized." }, { status: 500 });
  }

  const creditResult = (credit ?? {}) as {
    awarded?: number;
    birthdayBonusAwarded?: number;
    bonusAwarded?: number;
    petBonusAwarded?: number;
    petTaskApproved?: boolean;
  };
  return Response.json({
    ok: true,
    matched: true,
    moneyAwarded: Number(creditResult.awarded ?? 0),
    moneyBonusAwarded: Number(creditResult.bonusAwarded ?? 0),
    moneyBirthdayBonusAwarded: Number(creditResult.birthdayBonusAwarded ?? 0),
    moneyPetBonusAwarded: Number(creditResult.petBonusAwarded ?? 0),
    coinEquivalent,
    credit,
    // Whether the PT- code actually earned the pet branch, not merely whether
    // one was used - a non-pet sending PT- lands on the plain flow.
    petBonusAutomated: Boolean(creditResult.petTaskApproved),
  });
}
