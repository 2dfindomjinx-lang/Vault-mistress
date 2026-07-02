import { cosmeticItems, type CosmeticType } from "@/lib/cosmetics";
import { profileSelect } from "@/lib/server-game-rules";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  action?: "equip" | "purchase" | "unequip";
  itemId?: string;
  itemType?: CosmeticType;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function getCosmetic(itemId: string | undefined) {
  return cosmeticItems.find((item) => item.id === itemId) ?? null;
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
  const item = action === "unequip" ? null : getCosmetic(body?.itemId);

  if (!action || (action !== "unequip" && !item)) {
    return jsonError("Invalid cosmetic request.");
  }

  const supabase = createSupabaseAdminClient();
  const userId = authData.user.id;

  if (action === "unequip") {
    const itemType = body?.itemType;
    const validTypes = new Set(cosmeticItems.map((entry) => entry.type));

    if (!itemType || !validTypes.has(itemType)) {
      return jsonError("Invalid cosmetic type.");
    }

    const { error: clearError } = await supabase
      .from("user_cosmetics")
      .update({ equipped: false })
      .eq("user_id", userId)
      .eq("item_type", itemType);

    if (clearError) {
      console.error("[cosmetics] unequip failed", clearError);
      return jsonError("Cosmetic unequip failed.", 500);
    }

    if (itemType === "speech-avatar") {
      const defaultItem = getCosmetic("default-principessa");

      if (!defaultItem) {
        return jsonError("Default speech avatar is missing.", 500);
      }

      const { data: cosmetic, error: restoreError } = await supabase
        .from("user_cosmetics")
        .upsert(
          {
            user_id: userId,
            item_id: defaultItem.id,
            item_type: defaultItem.type,
            equipped: true,
          },
          { onConflict: "user_id,item_id" },
        )
        .select("item_id, item_type, equipped")
        .single();

      if (restoreError || !cosmetic) {
        console.error("[cosmetics] default speech avatar restore failed", restoreError);
        return jsonError("Default speech avatar restore failed.", 500);
      }

      return Response.json({ cosmetic });
    }

    return Response.json({ unequipped: true, itemType });
  }

  if (!item) {
    return jsonError("Invalid cosmetic request.");
  }

  if (action === "equip") {
    if (item.price > 0) {
      const { data: ownedCosmetic, error: ownedError } = await supabase
        .from("user_cosmetics")
        .select("item_id")
        .eq("user_id", userId)
        .eq("item_id", item.id)
        .maybeSingle();

      if (ownedError) {
        console.error("[cosmetics] ownership lookup failed", ownedError);
        return jsonError("Cosmetic ownership check failed.", 500);
      }

      if (!ownedCosmetic) {
        return jsonError("Cosmetic is not owned.", 403);
      }
    }

    const { error: clearError } = await supabase
      .from("user_cosmetics")
      .update({ equipped: false })
      .eq("user_id", userId)
      .eq("item_type", item.type);

    if (clearError) {
      console.error("[cosmetics] clear equipped failed", clearError);
      return jsonError("Cosmetic equip failed.", 500);
    }

    const { data: cosmetic, error: equipError } = await supabase
      .from("user_cosmetics")
      .upsert(
        {
          user_id: userId,
          item_id: item.id,
          item_type: item.type,
          equipped: true,
        },
        { onConflict: "user_id,item_id" },
      )
      .select("item_id, item_type, equipped")
      .single();

    if (equipError || !cosmetic) {
      console.error("[cosmetics] equip upsert failed", equipError);
      return jsonError("Cosmetic equip failed.", 500);
    }

    return Response.json({ cosmetic });
  }

  if (item.price <= 0) {
    return jsonError("This cosmetic does not need purchase.", 422);
  }

  const { data: existingCosmetic, error: existingError } = await supabase
    .from("user_cosmetics")
    .select("item_id")
    .eq("user_id", userId)
    .eq("item_id", item.id)
    .maybeSingle();

  if (existingError) {
    console.error("[cosmetics] existing purchase lookup failed", existingError);
    return jsonError("Cosmetic purchase check failed.", 500);
  }

  if (existingCosmetic) {
    return Response.json({ alreadyOwned: true });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(profileSelect)
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    console.error("[cosmetics] profile lookup failed", profileError);
    return jsonError(profileError?.message ?? "Profile not found.", 404);
  }

  const previousCoins = Number(profile.coins ?? 0);

  if (previousCoins < item.price) {
    return jsonError("Not enough coins for that cosmetic.", 402);
  }

  const nextCoins = previousCoins - item.price;
  const now = new Date().toISOString();
  const { data: updatedProfile, error: profileUpdateError } = await supabase
    .from("profiles")
    .update({ coins: nextCoins, updated_at: now })
    .eq("id", userId)
    .eq("coins", previousCoins)
    .select(profileSelect)
    .maybeSingle();

  if (profileUpdateError || !updatedProfile) {
    console.error("[cosmetics] profile coin update failed", profileUpdateError);
    return jsonError(profileUpdateError?.message ?? "Cosmetic coin update was stale.", profileUpdateError ? 500 : 409);
  }

  const { data: transaction, error: transactionError } = await supabase
    .from("coin_transactions")
    .insert({
      amount: -item.price,
      balance_after: nextCoins,
      balance_before: previousCoins,
      metadata: {
        cosmeticId: item.id,
        cosmeticType: item.type,
        spendAmount: item.price,
        tributeTotalChanged: false,
      },
      reason: "spend:cosmetic",
      user_id: userId,
    })
    .select("id")
    .single();

  if (transactionError || !transaction) {
    console.error("[cosmetics] transaction insert failed", transactionError);
    await supabase
      .from("profiles")
      .update({ coins: previousCoins, updated_at: now })
      .eq("id", userId)
      .eq("coins", nextCoins);
    return jsonError("Cosmetic purchase logging failed.", 500);
  }

  const { data: cosmetic, error: cosmeticError } = await supabase
    .from("user_cosmetics")
    .upsert(
      {
        user_id: userId,
        item_id: item.id,
        item_type: item.type as CosmeticType,
        equipped: false,
      },
      { onConflict: "user_id,item_id" },
    )
    .select("item_id, item_type, equipped")
    .single();

  if (cosmeticError || !cosmetic) {
    console.error("[cosmetics] purchase upsert failed", cosmeticError);
    await supabase.from("coin_transactions").delete().eq("id", transaction.id);
    await supabase
      .from("profiles")
      .update({ coins: previousCoins, updated_at: now })
      .eq("id", userId)
      .eq("coins", nextCoins);
    return jsonError("Cosmetic purchase failed.", 500);
  }

  return Response.json({
    cosmetic,
    profile: updatedProfile,
  });
}
