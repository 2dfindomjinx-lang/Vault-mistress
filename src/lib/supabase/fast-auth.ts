import type { SupabaseClient } from "@supabase/supabase-js";

// Identifies the caller from their session token WITHOUT a round trip to
// Supabase Auth. auth.getUser() asks the Auth server on every call (one extra
// request, and one extra log row, per API call); getClaims() verifies the
// token's signature locally against the project's public signing key instead.
//
// Trade-off, which is why this is not used everywhere: a token stays valid
// until it expires (about an hour) even if the account has since signed out or
// been removed, whereas getUser() notices at once. So this is for read-only
// routes that only return the caller's own data. Anything that spends, grants
// or changes something keeps getUser().
//
// Requires the project to sign tokens with an asymmetric key (it does: ECC
// P-256). A token signed by the legacy shared secret makes getClaims() fall
// back to asking the Auth server itself, so old sessions still work, just
// without the saving.

export async function getFastUser(authSupabase: Pick<SupabaseClient, "auth">): Promise<{ id: string } | null> {
  try {
    const { data, error } = await authSupabase.auth.getClaims();
    const id = data?.claims?.sub;
    if (error || !id) return null;
    return { id };
  } catch (caught) {
    // An unexpected failure must read as "not signed in", like getUser() errors do.
    console.error("[fast-auth] getClaims failed", caught);
    return null;
  }
}
