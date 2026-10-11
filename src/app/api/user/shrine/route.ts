import assetNames from "@/lib/generated/asset-names.json";
import { getFastUser } from "@/lib/supabase/fast-auth";
import { normalizeAddressTerm, type AddressTerm } from "@/lib/address-term";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { executeWalletAction, validWalletRequestId } from "@/lib/wallet-action";
import {
  buildShrineBonusStatus,
  buildShrineStatus,
  FEMSUB_SHRINE_MEMORY_LIBRARY,
  isShrinePurchaseAmount,
  resolveShrineMemories,
  type ShrineBonusStatus,
} from "@/lib/shrine";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

async function getShrineImageFileNames(subdir?: string) {
  return (assetNames.shrine as Record<string, string[]>)[subdir || "."] ?? [];
}

function resolveMainShrineMemories(
  addressTerm: AddressTerm,
  subFileNames: string[],
  femsubFileNames: string[],
) {
  if (addressTerm === "femsub") {
    return resolveShrineMemories(femsubFileNames, {
      library: FEMSUB_SHRINE_MEMORY_LIBRARY,
      publicPath: "/shrine/main/femsub",
    });
  }

  // The existing root pool remains the sub pool.
  return resolveShrineMemories(subFileNames);
}

function getShrineBonusSubdir(addressTerm: AddressTerm) {
  return addressTerm;
}

async function getShrineBonusStatus(addressTerm: AddressTerm, level: number): Promise<ShrineBonusStatus> {
  const subdir = getShrineBonusSubdir(addressTerm);

  const fileNames = await getShrineImageFileNames(subdir);
  const images = resolveShrineMemories(fileNames).map((memory) => ({
    ...memory,
    path: `/shrine/${subdir}/${memory.fileName}`,
  }));

  return buildShrineBonusStatus(level, images);
}

async function loadShrine(supabase: ReturnType<typeof createSupabaseAdminClient>, userId: string) {
  const { data, error } = await supabase.rpc("get_shrine_summary", { p_user_id: userId });
  if (error || !data) throw new Error("Shrine progress could not be loaded.");
  const addressTerm = normalizeAddressTerm(data.addressTerm);
  const shrine = buildShrineStatus(Number(data.totalSpent), resolveMainShrineMemories(addressTerm, await getShrineImageFileNames(), await getShrineImageFileNames("main/femsub")));
  return { ...shrine, topWorshippers: data.topWorshippers, bonus: await getShrineBonusStatus(addressTerm, shrine.level) };
}

// `fast` skips the Auth server round trip (see fast-auth.ts); GET only.
async function getAuthedUserId(fast = false) {
  const authSupabase = await createSupabaseServerClient();
  if (fast) {
    const fastUser = await getFastUser(authSupabase);
    if (!fastUser) return { error: jsonError("Authentication required.", 401), userId: null };
    return { error: null, userId: fastUser.id };
  }
  const { data: authData, error: authError } = await authSupabase.auth.getUser();

  if (authError || !authData.user) {
    return {
      error: jsonError(authError?.message ?? "Authentication required.", 401),
      userId: null,
    };
  }

  return {
    error: null,
    userId: authData.user.id,
  };
}

export async function GET() {
  if (!isSupabaseAdminConfigured) {
    return jsonError(`Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`, 500);
  }

  const authResult = await getAuthedUserId(true);

  if (authResult.error) {
    return authResult.error;
  }

  if (!authResult.userId) {
    return jsonError("Authentication required.", 401);
  }

  try {
    return Response.json({ shrine: await loadShrine(createSupabaseAdminClient(), authResult.userId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { console.error("[shrine] summary failed", error); return jsonError("Shrine progress could not be loaded.", 503); }
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) return jsonError("Service unavailable.", 503);
  const auth = await getAuthedUserId();
  if (auth.error) return auth.error;
  if (!auth.userId) return jsonError("Authentication required.", 401);
  const body = await request.json().catch(() => null) as { amount?: number; requestId?: string } | null;
  if (!isShrinePurchaseAmount(Number(body?.amount)) || !validWalletRequestId(body?.requestId)) return jsonError("Invalid shrine offering. Refresh and try again.", 422);
  const db = createSupabaseAdminClient();
  const limit = await checkRateLimit(db, "shrine:" + auth.userId, 15, 60);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);
  const action = await executeWalletAction(db, auth.userId, body.requestId, "shrine", Number(body.amount));
  if (action.response) return action.response;
  try {
    return Response.json({ profile: action.profile, shrine: await loadShrine(db, auth.userId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { console.error("[shrine] post-offering summary failed", error); return jsonError("Your offering was recorded. Retry to refresh the Shrine.", 503); }
}
