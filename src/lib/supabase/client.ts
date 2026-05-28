import { createBrowserClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  username: string;
  avatar_url?: string | null;
  coins: number;
  affection: number;
  tribute_total: number;
  shame_count: number;
  is_admin: boolean;
  hide_from_leaderboard?: boolean;
  loyalty_streak: number;
  last_loyalty_at: string | null;
  timeout_until: string | null;
  created_at?: string;
  updated_at?: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createBrowserClient(
  supabaseUrl ?? "https://missing-supabase-url.supabase.co",
  supabaseAnonKey ?? "missing-supabase-anon-key",
);

function cleanUsernameCandidate(value: string) {
  return value
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function profileUsernameFromUser(user: Pick<User, "id" | "user_metadata">) {
  const metadata = user.user_metadata ?? {};
  const candidate =
    metadata.preferred_username ??
    metadata.user_name ??
    metadata.screen_name ??
    metadata.name ??
    metadata.full_name ??
    `vault_${user.id.slice(0, 8)}`;

  const clean = cleanUsernameCandidate(String(candidate));

  return `@${clean.length >= 3 ? clean : `vault_${user.id.slice(0, 8)}`}`;
}

export function profileAvatarFromUser(user: Pick<User, "user_metadata">) {
  const metadata = user.user_metadata ?? {};
  const avatar =
    metadata.avatar_url ??
    metadata.picture ??
    metadata.image ??
    metadata.profile_image_url ??
    metadata.profile_image_url_https;

  return typeof avatar === "string" && avatar.trim().length > 0
    ? avatar
    : null;
}
