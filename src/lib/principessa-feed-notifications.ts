import type { SupabaseClient } from "@supabase/supabase-js";

const MENTION_PATTERN = /(?:^|\s)@([a-zA-Z0-9_.-]{1,40})/g;
const PROFILE_PAGE_SIZE = 500;
const NOTIFICATION_BATCH_SIZE = 500;

export async function notifyPrincipessaPostPublishedToSubs(
  supabase: SupabaseClient,
  payload: { actorId: string; postId: string; postTitle: string },
) {
  let offset = 0;

  while (true) {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("is_admin", false)
      .neq("id", payload.actorId)
      .order("id", { ascending: true })
      .range(offset, offset + PROFILE_PAGE_SIZE - 1);
    if (error) throw error;

    const recipients = profiles ?? [];
    for (let index = 0; index < recipients.length; index += NOTIFICATION_BATCH_SIZE) {
      const batch = recipients.slice(index, index + NOTIFICATION_BATCH_SIZE);
      const { error: insertError } = await supabase.from("user_notifications").insert(
        batch.map((profile) => ({
          body: `“${payload.postTitle}” is now live in Principessa's Social.`,
          kind: "principessa_feed_new_post",
          metadata: {
            channel: "principessa",
            event: "new_post",
            postId: payload.postId,
            source: "principessa_feed",
          },
          title: "New post from Principessa",
          user_id: profile.id,
        })),
      );
      if (insertError) throw insertError;
    }

    if (recipients.length < PROFILE_PAGE_SIZE) return;
    offset += PROFILE_PAGE_SIZE;
  }
}

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
