import { NextResponse } from "next/server";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { postXOAuthForm } from "@/lib/x-oauth";

export const runtime = "nodejs";

const COOKIE_NAME = "x_rebrand_request";
const REQUEST_TOKEN_URL = "https://api.twitter.com/oauth/request_token";
const AUTHORIZE_URL = "https://api.twitter.com/oauth/authorize";
const REBRAND_CALLBACK_URL = "https://vault-mistress.vercel.app/api/user/rebrand-x/callback";

function jsonError(error: string, status: number, details?: Record<string, unknown>) {
  return Response.json({ ok: false, error, ...(details ?? {}) }, { status });
}

function getMissingXEnvFields() {
  const requiredEnv = [
    "X_REBRAND_API_KEY",
    "X_REBRAND_API_SECRET",
    "X_REBRAND_WRITE_ENABLED",
  ] as const;

  return requiredEnv.filter((key) => !process.env[key]);
}

function logStartError(error: unknown) {
  console.error("[x-rebrand:start] failed", {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
}

export async function GET(request: Request) {
  try {
    const missingEnv = getMissingXEnvFields();

    if (missingEnv.length > 0) {
      return jsonError("X rebrand env is missing", 500, { missingEnv });
    }

    if (process.env.X_REBRAND_WRITE_ENABLED !== "true") {
      return jsonError("X rebrand write is disabled", 403);
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return jsonError(error?.message ?? "Authentication required.", 401);
    }

    const requestUrl = new URL(request.url);
    const requestToken = await postXOAuthForm({
      extraOAuthParams: {
        oauth_callback: REBRAND_CALLBACK_URL,
      },
      url: REQUEST_TOKEN_URL,
    });
    const oauthToken = requestToken.oauth_token;
    const oauthTokenSecret = requestToken.oauth_token_secret;

    if (!oauthToken || !oauthTokenSecret) {
      console.error("[x-rebrand:start] request token response missing token fields", {
        callbackUrl: REBRAND_CALLBACK_URL,
        hasOAuthToken: Boolean(oauthToken),
        hasOAuthTokenSecret: Boolean(oauthTokenSecret),
        userId: data.user.id,
      });
      return jsonError("X write access request failed.", 502);
    }

    const redirectUrl = new URL(AUTHORIZE_URL);
    redirectUrl.searchParams.set("oauth_token", oauthToken);

    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set({
      httpOnly: true,
      maxAge: 10 * 60,
      name: COOKIE_NAME,
      path: "/",
      sameSite: "lax",
      secure: requestUrl.protocol === "https:",
      value: Buffer.from(
        JSON.stringify({
          oauthToken,
          oauthTokenSecret,
          userId: data.user.id,
        }),
      ).toString("base64url"),
    });

    return response;
  } catch (error) {
    logStartError(error);
    return jsonError(
      error instanceof Error ? error.message : "X rebrand start failed.",
      500,
    );
  }
}
