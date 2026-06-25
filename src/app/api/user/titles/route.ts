import { getTitleItem, type TitleItem } from "@/lib/cosmetics";
import { profileSelect } from "@/lib/server-game-rules";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  action?: "equip" | "purchase" | "unlock";
  equipTitleId?: string | null;
  source?: TitleItem["source"];
  titleId?: string;
  titleIds?: string[];
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function uniqueValidTitleIds(titleIds: unknown) {
  if (!Array.isArray(titleIds)) {
    return [];
  }

  return Array.from(new Set(
    titleIds
      .filter((id): id is string => typeof id === "string" && Boolean(getTitleItem(id))),
  ));
}

async function equipTitle(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  titleId: string,
) {
  const title = getTitleItem(titleId);

  if (!title) {
    return "Invalid title.";
  }

  const { data: ownedTitle, error: ownedError } = await supabase
    .from("user_titles")
    .select("title_id")
    .eq("user_id", userId)
    .eq("title_id", titleId)
    .maybeSingle();

  if (ownedError) {
    console.error("[titles] ownership lookup failed", ownedError);
    return "Title ownership check failed.";
  }

  if (!ownedTitle) {
    return "Title is not owned.";
  }

  const { error: equipError } = await supabase.from("user_titles").upsert(
    {
      user_id: userId,
      title_id: title.id,
      source: title.source,
      equipped: true,
    },
    { onConflict: "user_id,title_id" },
  );

  if (equipError) {
    console.error("[titles] equip upsert failed", equipError);
    return "Title equip failed.";
  }

  const { error: clearError } = await supabase
    .from("user_titles")
    .update({ equipped: false })
    .eq("user_id", userId)
    .neq("title_id", title.id);

  if (clearError) {
    console.error("[titles] clear other equipped titles failed", clearError);
  }

  return null;
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
  const action = body?.action;
  const supabase = createSupabaseAdminClient();
  const userId = authData.user.id;

  if (action === "unlock") {
    const titleIds = uniqueValidTitleIds(body?.titleIds);

    if (titleIds.length === 0) {
      return Response.json({ titleIds: [] });
    }

    const { error } = await supabase.from("user_titles").upsert(
      titleIds.map((titleId) => ({
        user_id: userId,
        title_id: titleId,
        source: getTitleItem(titleId)?.source ?? body?.source ?? "progression",
        equipped: false,
      })),
      { onConflict: "user_id,title_id" },
    );

    if (error) {
      console.error("[titles] unlock upsert failed", error);
      return jsonError("Title unlock failed.", 500);
    }

    if (body?.equipTitleId) {
      const equipError = await equipTitle(supabase, userId, body.equipTitleId);

      if (equipError) {
        return jsonError(equipError, 500);
      }
    }

    return Response.json({ equippedTitleId: body?.equipTitleId ?? null, titleIds });
  }

  const title = getTitleItem(body?.titleId ?? "");

  if (!title) {
    return jsonError("Invalid title.");
  }

  if (action === "equip") {
    const equipError = await equipTitle(supabase, userId, title.id);

    if (equipError) {
      return jsonError(equipError, equipError === "Title is not owned." ? 403 : 500);
    }

    return Response.json({ equippedTitleId: title.id });
  }

  if (action !== "purchase") {
    return jsonError("Invalid title request.");
  }

  const price = title.price ?? 0;

  if (price <= 0) {
    return jsonError("This title does not need purchase.", 422);
  }

  const { data: existingTitle, error: existingError } = await supabase
    .from("user_titles")
    .select("title_id")
    .eq("user_id", userId)
    .eq("title_id", title.id)
    .maybeSingle();

  if (existingError) {
    console.error("[titles] existing purchase lookup failed", existingError);
    return jsonError("Title purchase check failed.", 500);
  }

  if (existingTitle) {
    return Response.json({ alreadyOwned: true });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(profileSelect)
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    console.error("[titles] profile lookup failed", profileError);
    return jsonError(profileError?.message ?? "Profile not found.", 404);
  }

  const previousCoins = Number(profile.coins ?? 0);

  if (previousCoins < price) {
    return jsonError("Not enough coins for that title.", 402);
  }

  const nextCoins = previousCoins - price;
  const now = new Date().toISOString();
  const { data: updatedProfile, error: profileUpdateError } = await supabase
    .from("profiles")
    .update({ coins: nextCoins, updated_at: now })
    .eq("id", userId)
    .eq("coins", previousCoins)
    .select(profileSelect)
    .maybeSingle();

  if (profileUpdateError || !updatedProfile) {
    console.error("[titles] profile coin update failed", profileUpdateError);
    return jsonError(profileUpdateError?.message ?? "Title coin update was stale.", profileUpdateError ? 500 : 409);
  }

  const { data: transaction, error: transactionError } = await supabase
    .from("coin_transactions")
    .insert({
      amount: -price,
      balance_after: nextCoins,
      balance_before: previousCoins,
      metadata: {
        spendAmount: price,
        titleId: title.id,
        tributeTotalChanged: false,
      },
      reason: "spend:title",
      user_id: userId,
    })
    .select("id")
    .single();

  if (transactionError || !transaction) {
    console.error("[titles] transaction insert failed", transactionError);
    await supabase
      .from("profiles")
      .update({ coins: previousCoins, updated_at: now })
      .eq("id", userId)
      .eq("coins", nextCoins);
    return jsonError("Title purchase logging failed.", 500);
  }

  const { error: titleError } = await supabase.from("user_titles").upsert(
    {
      user_id: userId,
      title_id: title.id,
      source: title.source,
      equipped: false,
    },
    { onConflict: "user_id,title_id" },
  );

  if (titleError) {
    console.error("[titles] purchase upsert failed", titleError);
    await supabase.from("coin_transactions").delete().eq("id", transaction.id);
    await supabase
      .from("profiles")
      .update({ coins: previousCoins, updated_at: now })
      .eq("id", userId)
      .eq("coins", nextCoins);
    return jsonError("Title purchase failed.", 500);
  }

  return Response.json({
    profile: updatedProfile,
    titleId: title.id,
  });
}
