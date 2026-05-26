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

export function usernameToEmail(username: string) {
  const clean = username
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9_]/g, "");

  return `${clean}@vault.local`;
}

export function validateUsername(username: string) {
  const trimmed = username.trim().toLowerCase();

  if (!trimmed.startsWith("@")) {
    return {
      error: "Username must start with @.",
      username: "",
    };
  }

  const clean = trimmed.replace(/^@/, "");

  if (clean.length < 3) {
    return {
      error: "Username must be at least 3 characters after @.",
      username: "",
    };
  }

  if (!/^[a-z0-9_]+$/.test(clean)) {
    return {
      error: "Username can only use letters, numbers, and underscore.",
      username: "",
    };
  }

  return {
    error: "",
    username: `@${clean}`,
  };
}
