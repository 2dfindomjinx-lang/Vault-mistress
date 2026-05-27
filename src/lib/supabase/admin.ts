import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseAdminConfigured = Boolean(supabaseUrl && serviceRoleKey);

export function getSupabaseAdminConfigErrors() {
  return [
    !supabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL is missing" : "",
    !serviceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY is missing" : "",
  ].filter(Boolean);
}

export function createSupabaseAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Supabase admin environment variables are missing", {
      hasNextPublicSupabaseUrl: Boolean(supabaseUrl),
      hasServiceRoleKey: Boolean(serviceRoleKey),
    });
    throw new Error(
      `Supabase admin environment variables are missing: ${getSupabaseAdminConfigErrors().join(", ")}`,
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
