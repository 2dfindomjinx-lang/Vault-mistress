import type { SupabaseClient } from "@supabase/supabase-js";
import { isTrustedAdminUserId } from "@/lib/admin-identity";
import { getPrincipessaFeedSignedUrlMap } from "@/lib/principessa-feed-media";
import { loadCommunityProfiles } from "@/lib/prestige-server";

type PostRow = {
  author_id: string;
  channel: "principessa" | "sub";
  created_at: string;
  description: string;
  achievement_data: Record<string, unknown> | null;
  achievement_key: string | null;
  confession_mode: "anonymous" | "pseudonymous" | null;
  highlighted_until: string | null;
  id: string;
  pinned_at: string | null;
  post_type: "normal" | "confession" | "achievement";
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

type FeedProfileRow = {
  avatar_path: string | null;
  user_id: string;
};

const OPTIONAL_POST_COLUMNS = [
  "achievement_data",
  "achievement_key",
  "confession_mode",
  "highlighted_until",
  "pinned_at",
  "post_type",
] as const;

function isMissingOptionalPostColumn(error: { code?: string; message?: string } | null) {
  if (!error || (error.code !== "42703" && error.code !== "PGRST204")) return false;
  const message = String(error.message ?? "").toLowerCase();
  return OPTIONAL_POST_COLUMNS.some((column) => message.includes(column));
}

export type PrincipessaFeedPost = {
  author: {
    avatarUrl: string | null;
    displayName: string | null;
    userId?: string | null;
    username: string;
    usernameStyle?: { color?: string; textShadow?: string };
  };
  achievement: { key: string; data: Record<string, unknown> } | null;
  comments: Array<{
    author: {
      avatarUrl: string | null;
      displayName: string | null;
      username: string;
      usernameStyle?: { color?: string; textShadow?: string };
    };
    body: string;
    createdAt: string;
    id: string;
  }>;
  createdAt: string;
  channel: "principessa" | "sub";
  description: string;
  confessionMode: "anonymous" | "pseudonymous" | null;
  highlightedUntil: string | null;
  id: string;
  images: Array<{
    id: string;
    url: string;
  }>;
  likedByViewer: boolean;
  likedByAdmin: boolean;
  likeCount: number;
  repostedByViewer: boolean;
  repostCount: number;
  ownedByViewer: boolean;
  pinned: boolean;
  postType: "normal" | "confession" | "achievement";
  title: string;
  status: "pending" | "published" | "rejected";
};

function publicIdentity(
  profile?: { displayName: string | null; userId?: string; username: string; usernameStyle?: { color?: string; textShadow?: string } },
  avatarUrl: string | null = null,
) {
  return {
    avatarUrl,
    displayName: profile?.displayName?.trim() || null,
    userId: profile?.userId ?? null,
    username: profile?.username || "@unknown",
    usernameStyle: profile?.usernameStyle,
  };
}

export async function listPrincipessaFeedPosts(
  supabase: SupabaseClient,
  options: {
    authorId?: string;
    channel?: "all" | "principessa" | "sub";
    status?: "all" | "pending" | "published" | "rejected";
    viewerId?: string;
    viewerIsAdmin?: boolean;
  } = {},
): Promise<PrincipessaFeedPost[]> {
  const channel = options.channel ?? "principessa";
  const status = options.status ?? "published";
  let postsQuery = supabase
    .from("principessa_posts")
    .select("id, author_id, channel, status, title, description, post_type, confession_mode, achievement_key, achievement_data, pinned_at, highlighted_until, created_at, updated_at")
    .order("pinned_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (channel !== "all") postsQuery = postsQuery.eq("channel", channel);
  if (status !== "all") postsQuery = postsQuery.eq("status", status);
  if (options.authorId) postsQuery = postsQuery.eq("author_id", options.authorId);

  let { data: posts, error: postsError } = await postsQuery;

  // The social post extras were added after the original moderation table.
  // A normal Sub submission and its approval queue should remain usable during
  // a rolling deploy even when those optional columns have not landed yet.
  if (isMissingOptionalPostColumn(postsError)) {
    let compatibilityQuery = supabase
      .from("principessa_posts")
      .select("id, author_id, channel, status, title, description, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (channel !== "all") compatibilityQuery = compatibilityQuery.eq("channel", channel);
    if (status !== "all") compatibilityQuery = compatibilityQuery.eq("status", status);
    if (options.authorId) compatibilityQuery = compatibilityQuery.eq("author_id", options.authorId);

    const compatibilityResult = await compatibilityQuery;
    postsError = compatibilityResult.error;
    posts = (compatibilityResult.data ?? []).map((post) => ({
      ...post,
      achievement_data: {},
      achievement_key: null,
      confession_mode: null,
      highlighted_until: null,
      pinned_at: null,
      post_type: "normal",
    }));
  }

  if (postsError) {
    throw postsError;
  }

  const postRows = (posts ?? []) as PostRow[];
  if (postRows.length === 0) {
    return [];
  }

  const postIds = postRows.map((post) => post.id);
  const [imagesResult, commentsResult, likesResult, repostsResult] = await Promise.all([
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
    supabase.from("principessa_post_likes").select("post_id, user_id").in("post_id", postIds),
    supabase.from("principessa_post_reposts").select("post_id, user_id").in("post_id", postIds),
  ]);

  if (imagesResult.error) {
    throw imagesResult.error;
  }
  if (commentsResult.error) {
    throw commentsResult.error;
  }
  if (likesResult.error) throw likesResult.error;
  if (repostsResult.error) throw repostsResult.error;

  const imageRows = (imagesResult.data ?? []) as ImageRow[];
  const commentRows = (commentsResult.data ?? []) as CommentRow[];
  const likeRows = (likesResult.data ?? []) as Array<{ post_id: string; user_id: string }>;
  const repostRows = (repostsResult.data ?? []) as Array<{ post_id: string; user_id: string }>;
  const signedImageMap = await getPrincipessaFeedSignedUrlMap(
    supabase,
    imageRows.map((image) => image.storage_path),
  );
  const profileIds = Array.from(
    new Set([...postRows.map((post) => post.author_id), ...commentRows.map((comment) => comment.user_id)]),
  );
  const [communityProfiles, feedProfilesResult] = await Promise.all([
    loadCommunityProfiles(supabase, profileIds),
    supabase.from("principessa_feed_profiles").select("user_id, avatar_path").in("user_id", profileIds),
  ]);

  const feedProfileRows = (feedProfilesResult.error ? [] : (feedProfilesResult.data ?? [])) as FeedProfileRow[];
  const avatarPaths = feedProfileRows.flatMap((profile) => profile.avatar_path ? [profile.avatar_path] : []);
  const signedAvatarMap = await getPrincipessaFeedSignedUrlMap(supabase, avatarPaths);
  const avatarMap = new Map(feedProfileRows.map((profile) => [
    profile.user_id,
    profile.avatar_path ? signedAvatarMap.get(profile.avatar_path) ?? null : null,
  ]));

  const imageMap = new Map<string, ImageRow[]>();
  const commentMap = new Map<string, CommentRow[]>();

  for (const image of imageRows) {
    imageMap.set(image.post_id, [...(imageMap.get(image.post_id) ?? []), image]);
  }
  for (const comment of commentRows) {
    commentMap.set(comment.post_id, [...(commentMap.get(comment.post_id) ?? []), comment]);
  }

  return postRows.map((post) => {
    const canSeeConfessionIdentity = post.post_type !== "confession" || options.viewerIsAdmin || options.viewerId === post.author_id;
    const confessionIdentity = post.confession_mode === "pseudonymous"
      ? { displayName: "Veiled Confessor", username: `veil-${post.author_id.slice(0, 6)}` }
      : { displayName: "Anonymous Confession", username: "confession" };
    return ({
    achievement: post.achievement_key ? { data: post.achievement_data ?? {}, key: post.achievement_key } : null,
    author: canSeeConfessionIdentity
      ? publicIdentity(communityProfiles.get(post.author_id), avatarMap.get(post.author_id) ?? null)
      : publicIdentity(confessionIdentity),
    channel: post.channel,
    comments: (commentMap.get(post.id) ?? []).map((comment) => ({
      author: publicIdentity(communityProfiles.get(comment.user_id), avatarMap.get(comment.user_id) ?? null),
      body: comment.body,
      createdAt: comment.created_at,
      id: comment.id,
    })),
    createdAt: post.created_at,
    confessionMode: post.confession_mode,
    description: post.description,
    highlightedUntil: post.highlighted_until && new Date(post.highlighted_until).getTime() > Date.now() ? post.highlighted_until : null,
    id: post.id,
    images: (imageMap.get(post.id) ?? []).map((image) => ({
      id: image.id,
      url: signedImageMap.get(image.storage_path) ?? "",
    })).filter((image) => Boolean(image.url)),
    likedByViewer: Boolean(options.viewerId && likeRows.some((like) => like.post_id === post.id && like.user_id === options.viewerId)),
    likedByAdmin: likeRows.some((like) => like.post_id === post.id && isTrustedAdminUserId(like.user_id)),
    likeCount: likeRows.filter((like) => like.post_id === post.id).length,
    repostedByViewer: Boolean(options.viewerId && repostRows.some((repost) => repost.post_id === post.id && repost.user_id === options.viewerId)),
    repostCount: repostRows.filter((repost) => repost.post_id === post.id).length,
    ownedByViewer: options.viewerId === post.author_id,
    pinned: Boolean(post.pinned_at),
    postType: post.post_type,
    title: post.title,
    status: post.status,
  });
  });
}
