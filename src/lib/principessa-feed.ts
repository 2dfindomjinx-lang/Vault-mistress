import type { SupabaseClient } from "@supabase/supabase-js";

type PostRow = {
  author_id: string;
  channel: "principessa" | "sub";
  created_at: string;
  description: string;
  id: string;
  title: string;
  updated_at: string;
  status: "pending" | "published" | "rejected";
};

type ImageRow = {
  id: string;
  post_id: string;
  sort_order: number;
  storage_path: string;
};

type CommentRow = {
  body: string;
  created_at: string;
  id: string;
  post_id: string;
  user_id: string;
};

type ProfileRow = {
  display_name: string | null;
  id: string;
  username: string;
};

type FeedProfileRow = {
  avatar_path: string | null;
  user_id: string;
};

export type PrincipessaFeedPost = {
  author: {
    avatarUrl: string | null;
    displayName: string;
    username: string;
  };
  comments: Array<{
    author: {
      avatarUrl: string | null;
      displayName: string;
      username: string;
    };
    body: string;
    createdAt: string;
    id: string;
  }>;
  createdAt: string;
  channel: "principessa" | "sub";
  description: string;
  id: string;
  images: Array<{
    id: string;
    url: string;
  }>;
  title: string;
  status: "pending" | "published" | "rejected";
};

function publicIdentity(profile?: ProfileRow, avatarUrl: string | null = null) {
  const username = profile?.username || "@unknown";
  const displayName = profile?.display_name?.trim() || username;
  return { avatarUrl, displayName, username };
}

export async function listPrincipessaFeedPosts(
  supabase: SupabaseClient,
  options: {
    authorId?: string;
    channel?: "all" | "principessa" | "sub";
    status?: "all" | "pending" | "published" | "rejected";
  } = {},
): Promise<PrincipessaFeedPost[]> {
  const channel = options.channel ?? "principessa";
  const status = options.status ?? "published";
  let postsQuery = supabase
    .from("principessa_posts")
    .select("id, author_id, channel, status, title, description, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (channel !== "all") postsQuery = postsQuery.eq("channel", channel);
  if (status !== "all") postsQuery = postsQuery.eq("status", status);
  if (options.authorId) postsQuery = postsQuery.eq("author_id", options.authorId);

  const { data: posts, error: postsError } = await postsQuery;

  if (postsError) {
    throw postsError;
  }

  const postRows = (posts ?? []) as PostRow[];
  if (postRows.length === 0) {
    return [];
  }

  const postIds = postRows.map((post) => post.id);
  const [imagesResult, commentsResult] = await Promise.all([
    supabase
      .from("principessa_post_images")
      .select("id, post_id, storage_path, sort_order")
      .in("post_id", postIds)
      .order("sort_order", { ascending: true }),
    supabase
      .from("principessa_post_comments")
      .select("id, post_id, user_id, body, created_at")
      .in("post_id", postIds)
      .order("created_at", { ascending: true })
      .limit(1000),
  ]);

  if (imagesResult.error) {
    throw imagesResult.error;
  }
  if (commentsResult.error) {
    throw commentsResult.error;
  }

  const imageRows = (imagesResult.data ?? []) as ImageRow[];
  const commentRows = (commentsResult.data ?? []) as CommentRow[];
  const { data: signedImages, error: signedImagesError } = await supabase.storage
    .from("principessa-feed")
    .createSignedUrls(imageRows.map((image) => image.storage_path), 60 * 60);

  if (signedImagesError) {
    throw signedImagesError;
  }

  const signedImageMap = new Map(
    (signedImages ?? []).map((image) => [image.path, image.signedUrl]),
  );
  const profileIds = Array.from(
    new Set([...postRows.map((post) => post.author_id), ...commentRows.map((comment) => comment.user_id)]),
  );
  const [profilesResult, feedProfilesResult] = await Promise.all([
    supabase.from("profiles").select("id, username, display_name").in("id", profileIds),
    supabase.from("principessa_feed_profiles").select("user_id, avatar_path").in("user_id", profileIds),
  ]);

  if (profilesResult.error) throw profilesResult.error;
  if (feedProfilesResult.error) throw feedProfilesResult.error;

  const feedProfileRows = (feedProfilesResult.data ?? []) as FeedProfileRow[];
  const avatarPaths = feedProfileRows.flatMap((profile) => profile.avatar_path ? [profile.avatar_path] : []);
  const { data: signedAvatars, error: signedAvatarsError } = avatarPaths.length > 0
    ? await supabase.storage.from("principessa-feed").createSignedUrls(avatarPaths, 60 * 60)
    : { data: [], error: null };
  if (signedAvatarsError) throw signedAvatarsError;
  const signedAvatarMap = new Map((signedAvatars ?? []).map((image) => [image.path, image.signedUrl]));
  const avatarMap = new Map(feedProfileRows.map((profile) => [
    profile.user_id,
    profile.avatar_path ? signedAvatarMap.get(profile.avatar_path) ?? null : null,
  ]));

  const profileMap = new Map(
    ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
  );
  const imageMap = new Map<string, ImageRow[]>();
  const commentMap = new Map<string, CommentRow[]>();

  for (const image of imageRows) {
    imageMap.set(image.post_id, [...(imageMap.get(image.post_id) ?? []), image]);
  }
  for (const comment of commentRows) {
    commentMap.set(comment.post_id, [...(commentMap.get(comment.post_id) ?? []), comment]);
  }

  return postRows.map((post) => ({
    author: publicIdentity(profileMap.get(post.author_id), avatarMap.get(post.author_id) ?? null),
    channel: post.channel,
    comments: (commentMap.get(post.id) ?? []).map((comment) => ({
      author: publicIdentity(profileMap.get(comment.user_id), avatarMap.get(comment.user_id) ?? null),
      body: comment.body,
      createdAt: comment.created_at,
      id: comment.id,
    })),
    createdAt: post.created_at,
    description: post.description,
    id: post.id,
    images: (imageMap.get(post.id) ?? []).map((image) => ({
      id: image.id,
      url: signedImageMap.get(image.storage_path) ?? "",
    })).filter((image) => Boolean(image.url)),
    title: post.title,
    status: post.status,
  }));
}
