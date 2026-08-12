import { createHash } from "node:crypto";
import { isTrustedAdminUserId } from "@/lib/admin-identity";
import {
  BIRTHDAY_WISH_MAX_LENGTH,
  normalizeBirthdayWish,
  type BirthdayCelebration,
  type BirthdayWish,
} from "@/lib/birthday-celebration";
import { getBirthdayWindowState } from "@/lib/birthday";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

type WishRow = {
  created_at: string;
  id: string;
  message: string;
  user_id: string;
};

type ProfileRow = {
  display_name: string | null;
  id: string;
  username: string | null;
};

function fingerprint(request: Request) {
  const value = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "unknown";
  return createHash("sha256").update(value.split(",")[0].trim()).digest("hex").slice(0, 24);
}

function jsonError(error: string, status: number, code?: string) {
  return Response.json({ code, error }, { status });
}

function isSameOriginWrite(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function getOptionalUserId() {
  const auth = await createSupabaseServerClient();
  const { data } = await auth.auth.getUser();
  return data.user?.id ?? null;
}

async function loadCelebration(userId: string | null): Promise<BirthdayCelebration> {
  const supabase = createSupabaseAdminClient();
  const [roseResult, wishesResult, myRoseResult, myWishResult] = await Promise.all([
    supabase.from("birthday_2026_roses").select("user_id", { count: "exact", head: true }),
    supabase
      .from("birthday_2026_wishes")
      .select("id, user_id, message, created_at", { count: "exact" })
      .eq("is_hidden", false)
      .order("created_at", { ascending: false })
      .limit(60),
    userId
      ? supabase.from("birthday_2026_roses").select("user_id").eq("user_id", userId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    userId
      ? supabase
          .from("birthday_2026_wishes")
          .select("id, user_id, message, created_at")
          .eq("user_id", userId)
          .eq("is_hidden", false)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (roseResult.error || wishesResult.error || myRoseResult.error || myWishResult.error) {
    throw roseResult.error ?? wishesResult.error ?? myRoseResult.error ?? myWishResult.error;
  }

  const rows = (wishesResult.data ?? []) as WishRow[];
  const myWishRow = myWishResult.data as WishRow | null;
  const profileIds = Array.from(new Set([...rows.map((row) => row.user_id), ...(myWishRow ? [myWishRow.user_id] : [])]));
  const profileResult = profileIds.length
    ? await supabase.from("profiles").select("id, username, display_name").in("id", profileIds)
    : { data: [], error: null };
  if (profileResult.error) throw profileResult.error;

  const profiles = new Map(
    ((profileResult.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
  );
  const wishes: BirthdayWish[] = rows.map((row) => {
    const profile = profiles.get(row.user_id);
    return {
      createdAt: row.created_at,
      displayName: profile?.display_name ?? null,
      id: row.id,
      isMine: row.user_id === userId,
      message: row.message,
      username: profile?.username ?? null,
    };
  });
  const ownWish = myWishRow
    ? {
        createdAt: myWishRow.created_at,
        displayName: profiles.get(myWishRow.user_id)?.display_name ?? null,
        id: myWishRow.id,
        isMine: true,
        message: myWishRow.message,
        username: profiles.get(myWishRow.user_id)?.username ?? null,
      }
    : null;

  return {
    canModerate: Boolean(userId && isTrustedAdminUserId(userId)),
    hasLeftRose: Boolean(myRoseResult.data),
    myWish: ownWish,
    roseCount: roseResult.count ?? 0,
    wishCount: wishesResult.count ?? 0,
    wishes,
  };
}

export async function GET(request: Request) {
  if (!isSupabaseAdminConfigured) return jsonError("Birthday celebration is unavailable.", 503);
  const supabase = createSupabaseAdminClient();
  const rate = await checkRateLimit(supabase, `birthday-celebration-read:${fingerprint(request)}`, 120, 60);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);

  try {
    const celebration = await loadCelebration(await getOptionalUserId());
    return Response.json({ celebration }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Birthday celebration load failed", error);
    return jsonError("Birthday celebration is temporarily unavailable.", 500);
  }
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) return jsonError("Birthday celebration is unavailable.", 503);
  if (!isSameOriginWrite(request)) return jsonError("Untrusted request origin.", 403);
  const userId = await getOptionalUserId();
  if (!userId) return jsonError("Sign in to join the birthday court.", 401, "AUTH_REQUIRED");

  const body = await request.json().catch(() => null) as { action?: unknown; message?: unknown; wishId?: unknown } | null;
  const action = body?.action;
  if (action !== "rose" && action !== "wish" && action !== "hide") return jsonError("Invalid celebration action.", 400);
  if (action !== "hide" && !getBirthdayWindowState().isLive) {
    return jsonError("The birthday court is not accepting new entries.", 409, "BIRTHDAY_CLOSED");
  }
  if (action === "hide" && !isTrustedAdminUserId(userId)) {
    return jsonError("Admin access required.", 403);
  }

  const supabase = createSupabaseAdminClient();
  const rate = await checkRateLimit(supabase, `birthday-celebration-write:${userId}`, 12, 60);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);

  try {
    if (action === "hide") {
      const wishId = typeof body?.wishId === "string" ? body.wishId.trim() : "";
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(wishId)) {
        return jsonError("Invalid wish id.", 400);
      }
      const { error } = await supabase
        .from("birthday_2026_wishes")
        .update({ is_hidden: true, updated_at: new Date().toISOString() })
        .eq("id", wishId);
      if (error) throw error;
    } else if (action === "rose") {
      const { error } = await supabase
        .from("birthday_2026_roses")
        .upsert({ user_id: userId }, { ignoreDuplicates: true, onConflict: "user_id" });
      if (error) throw error;
    } else {
      const message = normalizeBirthdayWish(body?.message);
      if (!message) {
        return jsonError(`Write 1-${BIRTHDAY_WISH_MAX_LENGTH} characters without links or HTML.`, 400);
      }
      const now = new Date().toISOString();
      const { error } = await supabase.from("birthday_2026_wishes").upsert(
        // Deliberately omit is_hidden. On insert PostgreSQL applies the false
        // default; on update an admin-hidden message stays hidden instead of
        // letting its author publish it again by editing it.
        { message, updated_at: now, user_id: userId },
        { onConflict: "user_id" },
      );
      if (error) throw error;
    }

    return Response.json(
      { celebration: await loadCelebration(userId) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("Birthday celebration write failed", error);
    return jsonError("Your birthday entry could not be saved.", 500);
  }
}
