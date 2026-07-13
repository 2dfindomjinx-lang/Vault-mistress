import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "principessa-feed";
const SIGNED_URL_TTL_SECONDS = 6 * 60 * 60;
const SIGNED_URL_REUSE_MS = 5 * 60 * 60 * 1000;

type SignedUrlCacheEntry = {
  expiresAt: number;
  url: string;
};

const globalCache = globalThis as typeof globalThis & {
  principessaFeedSignedUrlCache?: Map<string, SignedUrlCacheEntry>;
};

const signedUrlCache = globalCache.principessaFeedSignedUrlCache
  ?? new Map<string, SignedUrlCacheEntry>();

globalCache.principessaFeedSignedUrlCache = signedUrlCache;

export async function getPrincipessaFeedSignedUrlMap(
  supabase: SupabaseClient,
  paths: string[],
) {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
  if (uniquePaths.length === 0) return new Map<string, string>();

  const now = Date.now();
  const missingPaths = uniquePaths.filter((path) => {
    const cached = signedUrlCache.get(path);
    return !cached || cached.expiresAt <= now;
  });

  if (missingPaths.length > 0) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(missingPaths, SIGNED_URL_TTL_SECONDS);
    if (error) throw error;

    for (const item of data ?? []) {
      if (!item.path || !item.signedUrl) continue;
      signedUrlCache.set(item.path, {
        expiresAt: now + SIGNED_URL_REUSE_MS,
        url: item.signedUrl,
      });
    }
  }

  return new Map(uniquePaths.flatMap((path) => {
    const cached = signedUrlCache.get(path);
    return cached ? [[path, cached.url] as const] : [];
  }));
}
