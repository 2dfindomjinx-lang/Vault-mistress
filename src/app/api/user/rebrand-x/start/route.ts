import { NextResponse } from "next/server";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { postXOAuthForm } from "@/lib/x-oauth";

export const runtime = "nodejs";

const COOKIE_NAME = "x_rebrand_request";
const REQUEST_TOKEN_URL = "https://api.twitter.com/oauth/request_token";
const AUTHORIZE_URL = "https://api.twitter.com/oauth/authorize";

function getMissingXCredentialFields() {
  return [
    !process.env.X_REBRAND_API_KEY ? "X_REBRAND_API_KEY" : "",
    !process.env.X_REBRAND_API_SECRET ? "X_REBRAND_API_SECRET" : "",
  ].filter(Boolean);
}

export async function GET(request: Request) {
  if (process.env.X_REBRAND_WRITE_ENABLED !== "true") {
    return Response.json({ error: "X rebrand write access is disabled." }, { status: 403 });
  }

  const missingCredentialFields = getMissingXCredentialFields();

  if (missingCredentialFields.length > 0) {
    return Response.json(
      {
        error: "X rebrand API credentials are not configured.",
        missingFields: missingCredentialFields,
      },
      { status: 500 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return Response.json({ error: error?.message ?? "Authentication required." }, { status: 401 });
  }

  const requestUrl = new URL(request.url);
  const callbackUrl = new URL("/api/user/rebrand-x/callback", requestUrl.origin).toString();
  const requestToken = await postXOAuthForm({
    extraOAuthParams: {
      oauth_callback: callbackUrl,
    },
    url: REQUEST_TOKEN_URL,
  });
  const oauthToken = requestToken.oauth_token;
  const oauthTokenSecret = requestToken.oauth_token_secret;

  if (!oauthToken || !oauthTokenSecret) {
    console.error("[x-rebrand:start] request token response missing token fields", {
      hasOAuthToken: Boolean(oauthToken),
      hasOAuthTokenSecret: Boolean(oauthTokenSecret),
      userId: data.user.id,
    });
    return Response.json({ error: "X write access request failed." }, { status: 502 });
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
}
