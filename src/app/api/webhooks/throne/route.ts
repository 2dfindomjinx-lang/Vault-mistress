import { verify as verifyEd25519 } from "node:crypto";
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
  if (!verifySignature(rawBody, request.headers.get("x-signature-timestamp"), request.headers.get("x-signature-ed25519"))) {
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
  const { data: inserted, error: insertError } = await supabase.from("throne_webhook_events").insert({ event_id: eventId, payload }).select("event_id").maybeSingle();
  if (insertError?.code === "23505") return Response.json({ ok: true, duplicate: true });
  if (insertError || !inserted) return Response.json({ error: insertError?.message ?? "Could not record webhook." }, { status: 500 });

  const code = message.match(/\b(?:VM|PT)-[A-Z0-9]{4,8}\b/i)?.[0]?.toUpperCase() ?? null;
  const isPetBonusCode = Boolean(code?.startsWith("PT-"));
  const gifterUsername = text(data.gifter_username).replace(/^@/, "");
  const profile = code
    ? (await supabase
        .from("profiles")
        .select("id, username")
        .ilike(isPetBonusCode ? "pet_tribute_code" : "tribute_code", code)
        .maybeSingle()).data
    : gifterUsername
      ? (await supabase.from("profiles").select("id, username").ilike("username", gifterUsername).maybeSingle()).data
      : null;
  if (!profile) {
    await supabase.from("throne_webhook_events").update({ status: "unmatched", processed_at: new Date().toISOString() }).eq("event_id", eventId);
    await supabase.from("tribute_claims").insert({ event_id: eventId, amount, message });
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
  const moneyAwarded = Math.floor(amount);
  const { data: credit, error: creditError } = await supabase.rpc("credit_throne_tribute", { p_event_id: eventId, p_user_id: profile.id, p_coins: coinEquivalent, p_amount: amount, p_code: code });
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
  await supabase.from("throne_webhook_events").update({ status: "credited", user_id: profile.id, processed_at: new Date().toISOString() }).eq("event_id", eventId);
  return Response.json({ ok: true, matched: true, moneyAwarded, coinEquivalent, credit, petBonusAutomated: isPetBonusCode });
}
