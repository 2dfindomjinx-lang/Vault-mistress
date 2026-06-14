import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabasePublicConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export function getSupabasePublicConfigErrors() {
  return [
    !supabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL is missing" : "",
    !supabaseAnonKey ? "NEXT_PUBLIC_SUPABASE_ANON_KEY is missing" : "",
  ].filter(Boolean);
}

export function createPublicSupabaseClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      `Supabase public environment variables are missing: ${getSupabasePublicConfigErrors().join(", ")}`,
    );
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
