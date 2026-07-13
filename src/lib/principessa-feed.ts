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

export type PrincipessaFeedPost = {
  author: {
    displayName: string;
    username: string;
  };
  comments: Array<{
    author: {
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

function publicIdentity(profile?: ProfileRow) {
  const username = profile?.username || "@unknown";
  const displayName = profile?.display_name?.trim() || username;
  return { displayName, username };
}

export async function listPrincipessaFeedPosts(
  supabase: SupabaseClient,
  options: {
    channel?: "principessa" | "sub";
    status?: "pending" | "published" | "rejected";
  } = {},
): Promise<PrincipessaFeedPost[]> {
  const channel = options.channel ?? "principessa";
  const status = options.status ?? "published";
  const { data: posts, error: postsError } = await supabase
    .from("principessa_posts")
    .select("id, author_id, channel, status, title, description, created_at, updated_at")
    .eq("channel", channel)
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(50);

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
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .in("id", profileIds);

  if (profilesError) {
    throw profilesError;
  }

  const profileMap = new Map(
    ((profiles ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
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
    author: publicIdentity(profileMap.get(post.author_id)),
    channel: post.channel,
    comments: (commentMap.get(post.id) ?? []).map((comment) => ({
      author: publicIdentity(profileMap.get(comment.user_id)),
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
