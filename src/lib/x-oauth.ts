import crypto from "node:crypto";

export type XOAuthTokenPair = {
  token: string;
  tokenSecret: string;
};

function encodeOAuth(value: string | number) {
  return encodeURIComponent(String(value)).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function createXOAuthHeader({
  accessToken,
  bodyParams,
  extraOAuthParams,
  method,
  tokenSecret = "",
  url,
}: {
  accessToken?: string;
  bodyParams?: Record<string, string>;
  extraOAuthParams?: Record<string, string>;
  method: "POST";
  tokenSecret?: string;
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
    oauth_version: "1.0",
    ...(accessToken ? { oauth_token: accessToken } : {}),
    ...(extraOAuthParams ?? {}),
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
  const signingKey = `${encodeOAuth(consumerSecret)}&${encodeOAuth(tokenSecret)}`;
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

export function parseOAuthFormResponse(responseText: string) {
  const params = new URLSearchParams(responseText);
  return Object.fromEntries(params.entries());
}

export async function postXOAuthForm({
  accessToken,
  bodyParams,
  extraOAuthParams,
  tokenSecret,
  url,
}: {
  accessToken?: string;
  bodyParams?: Record<string, string>;
  extraOAuthParams?: Record<string, string>;
  tokenSecret?: string;
  url: string;
}) {
  const authorization = createXOAuthHeader({
    accessToken,
    bodyParams,
    extraOAuthParams,
    method: "POST",
    tokenSecret,
    url,
  });
  const response = await fetch(url, {
    body: bodyParams ? new URLSearchParams(bodyParams) : undefined,
    headers: {
      Authorization: authorization,
      ...(bodyParams ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    method: "POST",
  });
  const responseText = await response.text().catch(() => "");

  if (!response.ok) {
    console.error("[x-oauth] X OAuth request failed", {
      body: responseText.slice(0, 1000),
      status: response.status,
      url,
    });
    throw new Error(`X OAuth request failed (${response.status}).`);
  }

  return parseOAuthFormResponse(responseText);
}
