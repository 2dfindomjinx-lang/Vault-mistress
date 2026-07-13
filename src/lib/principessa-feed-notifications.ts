import type { SupabaseClient } from "@supabase/supabase-js";

const MENTION_PATTERN = /(?:^|\s)@([a-zA-Z0-9_.-]{1,40})/g;

export async function notifyPrincipessaFeedMentions(
  supabase: SupabaseClient,
  payload: { actorId: string; postId: string; postTitle: string; text: string },
) {
  const usernames = Array.from(new Set(
    Array.from(payload.text.matchAll(MENTION_PATTERN), (match) => match[1].toLowerCase()),
  ));
  if (usernames.length === 0) return;

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, username")
    .or(usernames.flatMap((username) => [
      `username.ilike.${username}`,
      `username.ilike.@${username}`,
    ]).join(","));
  if (error) throw error;

  const recipients = (profiles ?? []).filter((profile) => profile.id !== payload.actorId);
  if (recipients.length === 0) return;

  const { error: insertError } = await supabase.from("user_notifications").insert(recipients.map((profile) => ({
    body: `You were tagged in “${payload.postTitle}”.`,
    kind: "principessa_feed_mention",
    metadata: { postId: payload.postId, source: "principessa_feed" },
    title: "You were mentioned",
    user_id: profile.id,
  })));
  if (insertError) throw insertError;
}
