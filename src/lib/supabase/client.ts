import { createClient } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  username: string;
  coins: number;
  affection: number;
  created_at?: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(
  supabaseUrl ?? "https://missing-supabase-url.supabase.co",
  supabaseAnonKey ?? "missing-supabase-anon-key",
);

export function normalizeUsername(value: string) {
  const cleaned = value.trim().replace(/\s+/g, "").toLowerCase();
  return cleaned.startsWith("@") ? cleaned : `@${cleaned}`;
}

export function usernameToVaultEmail(username: string) {
  return `${normalizeUsername(username).replace(/^@/, "")}@vault.local`;
}
