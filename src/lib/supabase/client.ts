import { createBrowserClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  username: string;
  twitter_handle?: string | null;
  displayName?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  equipped_avatar_slots?: Record<string, string> | null;
  has_uncensored_avatar?: boolean;
  // email is intentionally not populated for regular client usage (security).
  // It may exist in the DB but must never be returned to non-admin clients.
  coins: number;
  affection: number;
  tribute_total: number;
  lifetime_spent_coins?: number;
  shame_count: number;
  is_admin: boolean;
  hide_from_leaderboard?: boolean;
  pet_score?: number;
  owner_likeness?: number;
  user_level?: number;
  user_xp?: number;
  stored_rights?: number;
  right_expirations?: string[] | null;
  daily_purchase_count?: number;
  right_purchase_date?: string | null;
  pet_unlocked_at?: string | null;
  last_pet_decay_at?: string | null;
  last_owner_likeness_at?: string | null;
  last_pet_tax_at?: string | null;
  loyalty_streak: number;
  last_loyalty_at: string | null;
  last_login_at?: string | null;
  timeout_until: string | null;
  timeout_reason?: string | null;
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

export function cleanUsernameCandidate(value: string) {
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

export type DisplayNameValidation = {
  valid: boolean;
  normalized?: string;
  error?: string;
};

export function validateDisplayName(raw: string | null | undefined): DisplayNameValidation {
  if (!raw || typeof raw !== "string") {
    return { valid: false, error: "Display name is required." };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "Display name cannot be empty." };
  }
  if (trimmed.length < 2) {
    return { valid: false, error: "Display name must be at least 2 characters." };
  }
  if (trimmed.length > 24) {
    return { valid: false, error: "Display name cannot exceed 24 characters." };
  }
  // Block control chars, line breaks, nulls
  if (/[\x00-\x1F\x7F]/.test(raw)) {
    return { valid: false, error: "Display name cannot contain line breaks or control characters." };
  }
  return { valid: true, normalized: trimmed };
}
