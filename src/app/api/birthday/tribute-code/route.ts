import { randomBytes } from "node:crypto";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const MAX_CODE_ATTEMPTS = 6;

function unavailableResponse() {
  const errors = [
    ...getSupabaseAdminConfigErrors(),
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "NEXT_PUBLIC_SUPABASE_ANON_KEY is missing" : "",
  ].filter(Boolean);

  console.error("Birthday tribute codes are not configured", errors);
  return Response.json(
    {
      code: "BIRTHDAY_CODE_NOT_CONFIGURED",
      error: "Birthday tribute codes are not configured.",
    },
    { status: 503 },
  );
}

// Returns the authenticated user's existing VM code. Profiles created before
// the Throne-code migration can still have a null value, so this endpoint also
// fills that one missing value with a collision-resistant server-side code.
export async function POST() {
  if (!isSupabaseAdminConfigured || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return unavailableResponse();
  }

  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();
  if (authError || !authData.user) {
    return Response.json(
      { code: "BIRTHDAY_CODE_AUTH_REQUIRED", error: "Sign in to get your personal candle code." },
      { status: 401 },
    );
  }

  const supabase = createSupabaseAdminClient();
  const rateLimit = await checkRateLimit(supabase, `birthday-code:${authData.user.id}`, 12, 60);
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfterSeconds);

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("tribute_code")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Birthday tribute-code lookup failed", profileError);
    return Response.json(
      { code: "BIRTHDAY_CODE_LOOKUP_FAILED", error: "Your candle code could not be loaded." },
      { status: 500 },
    );
  }
  if (!profile) {
    return Response.json(
      { code: "BIRTHDAY_PROFILE_REQUIRED", error: "Open Vault Mistress once to finish creating your profile." },
      { status: 404 },
    );
  }
  if (profile.tribute_code) {
    return Response.json(
      { tributeCode: String(profile.tribute_code).toUpperCase() },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const tributeCode = `VM-${randomBytes(4).toString("hex").toUpperCase()}`;
    const { data: updated, error: updateError } = await supabase
      .from("profiles")
      .update({ tribute_code: tributeCode, updated_at: new Date().toISOString() })
      .eq("id", authData.user.id)
      .is("tribute_code", null)
      .select("tribute_code")
      .maybeSingle();

    if (updated?.tribute_code) {
      return Response.json(
        { tributeCode: String(updated.tribute_code).toUpperCase() },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    if (updateError?.code === "23505") {
      continue;
    }
    if (updateError) {
      console.error("Birthday tribute-code generation failed", updateError);
      return Response.json(
        { code: "BIRTHDAY_CODE_GENERATION_FAILED", error: "Your candle code could not be generated." },
        { status: 500 },
      );
    }

    // Another request may have filled the code between our read and update.
    const { data: refreshed } = await supabase
      .from("profiles")
      .select("tribute_code")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (refreshed?.tribute_code) {
      return Response.json(
        { tributeCode: String(refreshed.tribute_code).toUpperCase() },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
  }

  return Response.json(
    { code: "BIRTHDAY_CODE_GENERATION_FAILED", error: "Your candle code could not be generated." },
    { status: 500 },
  );
}
