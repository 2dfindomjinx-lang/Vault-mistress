import { randomInt } from "node:crypto";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { SAMPLE_CRATE_ITEMS } from "@/lib/crates";
import { computeCrateUpgradeChance, findCrateUpgradeTargetItem, isUpgradeExcluded } from "@/lib/crate-upgrade";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

// The Upgrader's only endpoint. One item in, one roll, and either exactly the
// named target item out or nothing. The chance is recomputed here from the
// same shared module the client used to show a preview - the client's number
// is never trusted, only reproduced.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type UpgradeBody = {
  requestId?: unknown;
  itemId?: unknown;
  targetItemId?: unknown;
  targetVariant?: unknown;
  variant?: unknown;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const textField = (value: unknown) => typeof value === "string" && value.length <= 160 ? value.trim() : "";

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();
  if (authError || !authData.user) {
    return jsonError("Authentication required.", 401);
  }
  const userId = authData.user.id;

  const supabase = createSupabaseAdminClient();
  const rateLimit = await checkRateLimit(supabase, `crate-upgrade:${userId}`, 30, 60);
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfterSeconds);

  const body = (await request.json().catch(() => null)) as UpgradeBody | null;
  const requestId = textField(body?.requestId);
  if (!UUID.test(requestId)) return jsonError("Refresh the page and try again.");
  const itemId = textField(body?.itemId);
  const variant = textField(body?.variant) || "normal";
  const targetItemId = textField(body?.targetItemId);
  const targetVariant = textField(body?.targetVariant) || "normal";

  if (!itemId || !targetItemId) {
    return jsonError("Pick a target.");
  }

  // Only items that really drop from an enabled crate can be targets -
  // exclusives kept out of every drop table stay out of reach here too.
  const target = findCrateUpgradeTargetItem(targetItemId, targetVariant);
  if (!target) {
    return jsonError("Invalid target.", 422);
  }

  const itemDef = SAMPLE_CRATE_ITEMS[itemId];
  // Same rule as a plain sell: the classic starter item has no value and
  // cannot be fed into anything.
  if (!itemDef || itemDef.sell_value <= 0 || itemId === "classic" || isUpgradeExcluded(itemId)) {
    return jsonError("This item cannot be upgraded.", 422);
  }

  const chance = computeCrateUpgradeChance(itemDef.sell_value, target.sellValue);
  if (chance === null) {
    return jsonError("Target must be worth more.", 422);
  }

  // Consume, grant and log atomically. A retry returns the original receipt.
  // Extra precision prevents a discrete probability floor on tiny chances.
  const { data, error } = await supabase.rpc("execute_crate_upgrade", {
    p_user_id: userId, p_request_id: requestId,
    p_from_item_id: itemId, p_from_variant: variant, p_from_value: itemDef.sell_value,
    p_target_item_id: target.itemId, p_target_variant: target.variant, p_target_value: target.sellValue,
    p_target_crate: target.crateType, p_target_rarity: target.rarity,
    p_roll: randomInt(0, 2 ** 47) / 2 ** 47,
  });
  if (error) {
    console.error("[crate-upgrade] transaction failed", error);
    return jsonError("Upgrade could not be confirmed. Retry to check the same attempt.", 503);
  }
  const result = data as { success?: boolean; error?: string } | null;
  if (result?.error === "not_owned") return jsonError("You do not own this item.", 422);
  if (result?.error === "request_mismatch") return jsonError("This attempt belongs to a different target. Reopen Upgrade.", 409);
  if (!result?.success) return jsonError("Upgrade is temporarily unavailable.", 503);
  return Response.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
