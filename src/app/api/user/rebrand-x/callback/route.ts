import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { postXOAuthForm } from "@/lib/x-oauth";

export const runtime = "nodejs";

const ACCESS_TOKEN_URL = "https://api.twitter.com/oauth/access_token";
const COOKIE_NAME = "x_rebrand_request";

type StoredRequestToken = {
  oauthToken: string;
  oauthTokenSecret: string;
  userId: string;
};

function getStoredRequestToken(value: string | undefined): StoredRequestToken | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<StoredRequestToken>;

    if (
      typeof parsed.oauthToken === "string" &&
      typeof parsed.oauthTokenSecret === "string" &&
      typeof parsed.userId === "string"
    ) {
      return {
        oauthToken: parsed.oauthToken,
        oauthTokenSecret: parsed.oauthTokenSecret,
        userId: parsed.userId,
      };
    }
  } catch (error) {
    console.error("[x-rebrand:callback] failed to parse request token cookie", error);
  }

  return null;
}

function redirectHome(origin: string, message: string) {
  return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(message)}`, origin));
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const oauthToken = requestUrl.searchParams.get("oauth_token");
  const oauthVerifier = requestUrl.searchParams.get("oauth_verifier");
  const denied = requestUrl.searchParams.get("denied");
  const cookieStore = await cookies();
  const storedRequest = getStoredRequestToken(cookieStore.get(COOKIE_NAME)?.value);

  if (denied) {
    const response = redirectHome(requestUrl.origin, "X write access was denied.");
    response.cookies.delete(COOKIE_NAME);
    return response;
  }

  if (!oauthToken || !oauthVerifier || !storedRequest || oauthToken !== storedRequest.oauthToken) {
    const response = redirectHome(requestUrl.origin, "X write access callback is invalid or expired.");
    response.cookies.delete(COOKIE_NAME);
    return response;
  }

  if (!isSupabaseAdminConfigured) {
    const response = redirectHome(
      requestUrl.origin,
      `Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`,
    );
    response.cookies.delete(COOKIE_NAME);
    return response;
  }

  const authSupabase = await createSupabaseServerClient();
  const { data, error } = await authSupabase.auth.getUser();

  if (error || !data.user || data.user.id !== storedRequest.userId) {
    const response = redirectHome(requestUrl.origin, "Sign in again before connecting X write access.");
    response.cookies.delete(COOKIE_NAME);
    return response;
  }

  try {
    const accessTokenResponse = await postXOAuthForm({
      accessToken: storedRequest.oauthToken,
      extraOAuthParams: {
        oauth_verifier: oauthVerifier,
      },
      tokenSecret: storedRequest.oauthTokenSecret,
      url: ACCESS_TOKEN_URL,
    });
    const accessToken = accessTokenResponse.oauth_token;
    const accessSecret = accessTokenResponse.oauth_token_secret;
    const xUserId = accessTokenResponse.user_id;

    if (!accessToken || !accessSecret) {
      console.error("[x-rebrand:callback] access token response missing token fields", {
        hasAccessSecret: Boolean(accessSecret),
        hasAccessToken: Boolean(accessToken),
        userId: data.user.id,
        xUserIdPresent: Boolean(xUserId),
      });
      const response = redirectHome(requestUrl.origin, "X write access token exchange failed.");
      response.cookies.delete(COOKIE_NAME);
      return response;
    }

    const adminSupabase = createSupabaseAdminClient();
    const { error: upsertError } = await adminSupabase
      .from("x_rebrand_tokens")
      .upsert(
        {
          access_secret: accessSecret,
          access_token: accessToken,
          updated_at: new Date().toISOString(),
          user_id: data.user.id,
          x_user_id: typeof xUserId === "string" ? xUserId : null,
        },
        { onConflict: "user_id" },
      );

    if (upsertError) {
      console.error("[x-rebrand:callback] token upsert failed", {
        code: upsertError.code,
        message: upsertError.message,
        userId: data.user.id,
      });
      const response = redirectHome(requestUrl.origin, "Failed to save X write access.");
      response.cookies.delete(COOKIE_NAME);
      return response;
    }

    console.info("[x-rebrand:callback] token stored", {
      accessSecretPresent: true,
      accessTokenPresent: true,
      userId: data.user.id,
      xUserIdPresent: Boolean(xUserId),
    });

    const response = NextResponse.redirect(new URL("/", requestUrl.origin));
    response.cookies.delete(COOKIE_NAME);
    return response;
  } catch (callbackError) {
    console.error("[x-rebrand:callback] failed", {
      error: callbackError,
      userId: data.user.id,
    });
    const response = redirectHome(requestUrl.origin, "X write access connection failed.");
    response.cookies.delete(COOKIE_NAME);
    return response;
  }
}
