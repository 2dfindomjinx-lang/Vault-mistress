import crypto from "node:crypto";
import { getRebrandProfileWithAssetUrls } from "@/lib/rebrand-profile";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfigErrors,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Body = {
  consent?: boolean;
};

type XUserTokenRow = Record<string, unknown>;

type XUserTokens = {
  accessSecret: string;
  accessToken: string;
};

type SafeDbError = {
  code?: string;
  message?: string;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function getMissingXCredentialFields() {
  return [
    !process.env.X_REBRAND_API_KEY ? "X_REBRAND_API_KEY" : "",
    !process.env.X_REBRAND_API_SECRET ? "X_REBRAND_API_SECRET" : "",
  ].filter(Boolean);
}

function getStringField(row: XUserTokenRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function getXUserTokens(row: XUserTokenRow | null): XUserTokens | null {
  if (!row) {
    return null;
  }

  const accessToken = getStringField(row, [
    "access_token",
    "oauth_token",
    "token",
    "x_access_token",
  ]);
  const accessSecret = getStringField(row, [
    "access_secret",
    "oauth_token_secret",
    "token_secret",
    "x_access_secret",
    "secret",
  ]);

  return accessToken && accessSecret ? { accessSecret, accessToken } : null;
}

function safeDbError(error: unknown): SafeDbError {
  if (!error || typeof error !== "object") {
    return {};
  }

  return {
    code: "code" in error && typeof error.code === "string" ? error.code : undefined,
    message:
      "message" in error && typeof error.message === "string"
        ? error.message
        : undefined,
  };
}

async function readStoredXTokens(userId: string) {
  const adminSupabase = createSupabaseAdminClient();
  const { data: tokenRow, error: tokenError } = await adminSupabase
    .from("x_rebrand_tokens")
    .select("user_id, x_user_id, screen_name, access_token, access_secret, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (tokenError) {
    const safeError = safeDbError(tokenError);
    console.error("[x-rebrand] token lookup failed", {
      code: safeError.code,
      message: safeError.message,
      userId,
    });

    return { error: tokenError, row: null, tokens: null };
  }

  const row = (tokenRow as XUserTokenRow | null) ?? null;
  const tokens = getXUserTokens(row);

  console.info("[x-rebrand] token lookup result", {
    accessSecretPresent: Boolean(tokens?.accessSecret),
    accessTokenPresent: Boolean(tokens?.accessToken),
    rowExists: Boolean(row),
    userId,
  });

  return { error: null, row, tokens };
}

function encodeOAuth(value: string | number) {
  return encodeURIComponent(String(value))
    .replace(/[!'()*]/g, (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );
}

function createOAuthHeader({
  accessSecret,
  accessToken,
  bodyParams,
  method,
  url,
}: {
  accessSecret: string;
  accessToken: string;
  bodyParams?: Record<string, string>;
  method: "POST";
  url: string;
}) {
  const consumerKey = process.env.X_REBRAND_API_KEY;
  const consumerSecret = process.env.X_REBRAND_API_SECRET;

  if (!consumerKey || !consumerSecret) {
    throw new Error("X rebrand API credentials are missing.");
  }

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: "1.0",
  };
  const signingParams = {
    ...oauthParams,
    ...(bodyParams ?? {}),
  };
  const parameterString = Object.entries(signingParams)
    .map(([key, value]) => [encodeOAuth(key), encodeOAuth(value)] as const)
    .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey === rightKey
        ? leftValue.localeCompare(rightValue)
        : leftKey.localeCompare(rightKey),
    )
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const signatureBaseString = [
    method,
    encodeOAuth(url),
    encodeOAuth(parameterString),
  ].join("&");
  const signingKey = `${encodeOAuth(consumerSecret)}&${encodeOAuth(accessSecret)}`;
  const oauthSignature = crypto
    .createHmac("sha1", signingKey)
    .update(signatureBaseString)
    .digest("base64");
  const headerParams = {
    ...oauthParams,
    oauth_signature: oauthSignature,
  };

  return `OAuth ${Object.entries(headerParams)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${encodeOAuth(key)}="${encodeOAuth(value)}"`)
    .join(", ")}`;
}

async function postXForm({
  bodyParams,
  tokens,
  url,
}: {
  bodyParams: Record<string, string>;
  tokens: XUserTokens;
  url: string;
}) {
  const authorization = createOAuthHeader({
    accessSecret: tokens.accessSecret,
    accessToken: tokens.accessToken,
    bodyParams,
    method: "POST",
    url,
  });
  const response = await fetch(url, {
    body: new URLSearchParams(bodyParams),
    headers: {
      Authorization: authorization,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    console.error("[x-rebrand] X API request failed", {
      body: responseText.slice(0, 1000),
      status: response.status,
      url,
    });
    throw new Error(`X profile update failed (${response.status}).`);
  }

  const responseText = await response.text().catch(() => "");

  if (!responseText) {
    return null;
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return responseText;
  }
}

async function fetchImageAsBase64(assetUrl: string, label: string) {
  const response = await fetch(assetUrl);

  if (!response.ok) {
    throw new Error(`${label} image could not be loaded from ${assetUrl}.`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer).toString("base64");
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;

  if (!body?.consent) {
    return jsonError("Explicit rebrand consent is required.", 403);
  }

  if (process.env.X_REBRAND_WRITE_ENABLED !== "true") {
    return jsonError("X rebrand write access is disabled.", 403);
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

  if (!isSupabaseAdminConfigured) {
    return Response.json(
      {
        error: `Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`,
      },
      { status: 500 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return jsonError(error?.message ?? "Authentication required.", 401);
  }

  const plannedProfile = getRebrandProfileWithAssetUrls(new URL(request.url).origin);
  console.info("[x-rebrand] authenticated user resolved", {
    userId: data.user.id,
  });

  const tokenLookup = await readStoredXTokens(data.user.id);

  if (tokenLookup.error) {
    return jsonError("Failed to read stored X write access.", 500);
  }

  const tokens = tokenLookup.tokens;

  if (!tokens) {
    return jsonError("Connect X write access first.", 403);
  }

  try {
    const profileResponse = await postXForm({
      bodyParams: {
        description: plannedProfile.bio,
        location: plannedProfile.location,
        name: plannedProfile.displayName,
        url: plannedProfile.website,
      },
      tokens,
      url: "https://api.twitter.com/1.1/account/update_profile.json",
    });
    const avatarImage = await fetchImageAsBase64(plannedProfile.avatarUrl, "Avatar");
    await postXForm({
      bodyParams: {
        image: avatarImage,
        skip_status: "true",
      },
      tokens,
      url: "https://api.twitter.com/1.1/account/update_profile_image.json",
    });
    const bannerImage = await fetchImageAsBase64(plannedProfile.bannerUrl, "Header");
    await postXForm({
      bodyParams: {
        banner: bannerImage,
      },
      tokens,
      url: "https://api.twitter.com/1.1/account/update_profile_banner.json",
    });

    return Response.json({
      message: "X profile rebrand applied.",
      plannedProfile,
      profileResponse,
    });
  } catch (updateError) {
    console.error("[x-rebrand] profile update failed", {
      error: updateError,
      userId: data.user.id,
    });
    return jsonError(
      updateError instanceof Error ? updateError.message : "X profile rebrand failed.",
      502,
    );
  }
}

export async function GET() {
  if (!isSupabaseAdminConfigured) {
    return Response.json(
      {
        error: `Supabase admin environment is not configured: ${getSupabaseAdminConfigErrors().join(", ")}`,
      },
      { status: 500 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return jsonError(error?.message ?? "Authentication required.", 401);
  }

  console.info("[x-rebrand:debug] authenticated user resolved", {
    userId: data.user.id,
  });

  const tokenLookup = await readStoredXTokens(data.user.id);

  if (tokenLookup.error) {
    const safeError = safeDbError(tokenLookup.error);

    return Response.json(
      {
        databaseError: {
          code: safeError.code,
          message: safeError.message,
        },
        rowExists: false,
        userId: data.user.id,
      },
      { status: 500 },
    );
  }

  return Response.json({
    accessSecretPresent: Boolean(tokenLookup.tokens?.accessSecret),
    accessTokenPresent: Boolean(tokenLookup.tokens?.accessToken),
    rowExists: Boolean(tokenLookup.row),
    screenNamePresent:
      typeof tokenLookup.row?.screen_name === "string" && Boolean(tokenLookup.row.screen_name),
    userId: data.user.id,
    xUserIdPresent: typeof tokenLookup.row?.x_user_id === "string" && Boolean(tokenLookup.row.x_user_id),
  });
}
