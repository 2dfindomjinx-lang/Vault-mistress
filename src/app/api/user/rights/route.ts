import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { DAY_MS, getGmt3DateKey, getNextGmt3Reset } from "@/lib/time";

type Body = {
  action?: "buy" | "use";
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
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

  if (body?.action !== "buy" && body?.action !== "use") {
    return jsonError("Invalid rights action.");
  }

  const supabase = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, coins, daily_purchase_count, right_purchase_date, right_expirations, stored_rights")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Rights profile lookup failed", {
      code: profileError.code,
      message: profileError.message,
      userId: authData.user.id,
    });
    return jsonError(profileError.message || "Rights profile lookup failed.", 500);
  }

  if (!profile) {
    return jsonError("Profile not found.", 404);
  }

  const todayKey = getGmt3DateKey();
  const isSameGmt3Day = profile.right_purchase_date === todayKey;
  const effectiveDailyPurchaseCount = isSameGmt3Day ? Number(profile.daily_purchase_count ?? 0) : 0;
  const activeRightExpirations = Array.isArray(profile.right_expirations)
    ? profile.right_expirations
        .filter((expiresAt) => typeof expiresAt === "string" && new Date(expiresAt).getTime() > Date.now())
        .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())
    : [];
  const currentStoredRights =
    activeRightExpirations.length > 0 ? activeRightExpirations.length : Number(profile.stored_rights ?? 0);

  if (body.action === "use") {
    if (currentStoredRights <= 0) {
      return jsonError("You have no stored rights.", 422);
    }

    const nextExpirations = activeRightExpirations.length > 0 ? activeRightExpirations.slice(1) : [];
    const nextStoredRights = Math.max(0, currentStoredRights - 1);
    const { data: updatedProfile, error: updateError } = await supabase
      .from("profiles")
      .update({
        right_expirations: nextExpirations,
        right_purchase_date: profile.right_purchase_date,
        stored_rights: nextStoredRights,
        updated_at: new Date().toISOString(),
      })
      .eq("id", authData.user.id)
      .select("coins, daily_purchase_count, right_purchase_date, right_expirations, stored_rights")
      .maybeSingle();

    if (updateError || !updatedProfile) {
      console.error("Rights use update failed", {
        code: updateError?.code,
        message: updateError?.message,
        userId: authData.user.id,
      });
      return jsonError(updateError?.message || "Rights action failed.", 500);
    }

    return Response.json({
      result: {
        coins: updatedProfile.coins,
        dailyPurchaseCount: isSameGmt3Day ? Number(updatedProfile.daily_purchase_count ?? 0) : 0,
        price: 0,
        rightExpirations: Array.isArray(updatedProfile.right_expirations) ? updatedProfile.right_expirations : [],
        rightPurchaseDate: updatedProfile.right_purchase_date ?? null,
        storedRights: Number(updatedProfile.stored_rights ?? 0),
      },
    });
  }

  const prices = [1500, 2500, 5000, 7500, 10000] as const;
  const price = prices[effectiveDailyPurchaseCount] ?? null;

  if (price === null) {
    return Response.json(
      {
        error: "Daily maximum reached.",
        nextResetAt: getNextGmt3Reset(todayKey).toISOString(),
      },
      { status: 429 },
    );
  }

  if (Number(profile.coins ?? 0) < price) {
    return jsonError("Not enough coins.", 402);
  }

  const nextExpirations = [...activeRightExpirations, new Date(Date.now() + 2 * DAY_MS).toISOString()].sort(
    (left, right) => new Date(left).getTime() - new Date(right).getTime(),
  );
  const nextPurchaseCount = effectiveDailyPurchaseCount + 1;
  const nextCoins = Number(profile.coins ?? 0) - price;
  const { data: updatedProfile, error: updateError } = await supabase
    .from("profiles")
    .update({
      coins: nextCoins,
      daily_purchase_count: nextPurchaseCount,
      right_expirations: nextExpirations,
      right_purchase_date: todayKey,
      stored_rights: nextExpirations.length,
      updated_at: new Date().toISOString(),
    })
    .eq("id", authData.user.id)
    .select("coins, daily_purchase_count, right_purchase_date, right_expirations, stored_rights")
    .maybeSingle();

  if (updateError || !updatedProfile) {
    console.error("Rights buy update failed", {
      code: updateError?.code,
      message: updateError?.message,
      userId: authData.user.id,
    });
    return jsonError(updateError?.message || "Rights action failed.", 500);
  }

  return Response.json({
    result: {
      coins: updatedProfile.coins,
      dailyPurchaseCount: Number(updatedProfile.daily_purchase_count ?? 0),
      price,
      rightExpirations: Array.isArray(updatedProfile.right_expirations) ? updatedProfile.right_expirations : [],
      rightPurchaseDate: updatedProfile.right_purchase_date ?? null,
      storedRights: Number(updatedProfile.stored_rights ?? 0),
    },
  });
}
