import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  if (error) {
    console.error("OAuth callback error", { error, errorDescription });
    return NextResponse.redirect(
      new URL(
        `/?error=${encodeURIComponent(errorDescription || error)}`,
        requestUrl.origin,
      ),
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error("OAuth exchange failed", exchangeError);
      return NextResponse.redirect(
        new URL(
          `/?error=${encodeURIComponent(exchangeError.message)}`,
          requestUrl.origin,
        ),
      );
    }
  }

  return NextResponse.redirect(new URL("/", requestUrl.origin));
}
