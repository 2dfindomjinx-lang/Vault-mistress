import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@/lib/supabase/server";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { isTrustedAdminUserId } from "@/lib/admin-identity";
import {
  galleryMoodRequirements,
  petGalleryScoreRequirements,
} from "@/lib/server-game-rules";

const galleryIds = {
  common: [
    "common-velvet-arrival",
    "common-midnight-maid",
    "common-executive-glare",
    "common-rose-vault",
  ],
  rare: [
    "rare-loyal-glimpse",
    "rare-private-smile",
    "rare-purple-obsession",
    "rare-golden-approval",
  ],
  divine: [
    "divine-throne-room",
    "divine-goddess-mood",
    "divine-final-favor",
    "divine-velvet-throne",
  ],
  secret: ["secret-defnes-final-favor"],
} as const;
export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const segments = (await context.params).path;
  const variant =
    segments.length === 2 && segments[0] === "femsub" ? "femsub" : null;
  if (segments.length !== (variant ? 2 : 1))
    return new Response(null, { status: 404 });
  const file = segments.at(-1) ?? "";
  const match = /^(common|rare|divine|secret|sacrifice|pet)-(\d+)\.webp$/.exec(
    file,
  );
  if (!match) return new Response(null, { status: 404 });
  const kind = match[1];
  const index = Number(match[2]);
  const itemId =
    kind === "pet"
      ? "pet-gallery-" + index
      : kind === "sacrifice"
        ? "sacrifice-" + index
        : galleryIds[kind as keyof typeof galleryIds]?.[index - 1];
  if (
    !itemId ||
    index < 1 ||
    (kind === "pet" && index > 30) ||
    (kind === "sacrifice" && index > 10)
  )
    return new Response(null, { status: 404 });
  if (!isSupabaseAdminConfigured) return new Response(null, { status: 503 });
  const auth = await createClient();
  const { data, error } = await auth.auth.getUser();
  if (error || !data.user)
    return new Response(null, {
      status: 401,
      headers: { "Cache-Control": "private, no-store" },
    });
  const db = createSupabaseAdminClient();
  if (!isTrustedAdminUserId(data.user.id)) {
    const [
      { data: profile, error: profileError },
      { data: owned, error: ownershipError },
    ] = await Promise.all([
      db
        .from("profiles")
        .select("affection,pet_score")
        .eq("id", data.user.id)
        .single(),
      db
        .from(kind === "pet" ? "user_pet_gallery" : "user_gallery")
        .select("item_id")
        .eq("user_id", data.user.id)
        .eq("item_id", itemId)
        .maybeSingle(),
    ]);
    if (profileError || ownershipError)
      return new Response(null, { status: 503 });
    const threshold =
      kind === "pet"
        ? petGalleryScoreRequirements.get(itemId)
        : galleryMoodRequirements.get(itemId);
    const eligible =
      typeof threshold === "number" &&
      Number(kind === "pet" ? profile?.pet_score : profile?.affection) >=
        threshold;
    if (!owned && !eligible)
      return new Response(null, {
        status: 403,
        headers: { "Cache-Control": "private, no-store" },
      });
  }
  try {
    let bytes: Buffer;
    try {
      bytes = await readFile(
        path.join(
          process.cwd(),
          "private",
          "gallery",
          ...(variant ? [variant] : []),
          file,
        ),
      );
    } catch {
      if (!variant) throw Error("missing");
      bytes = await readFile(
        path.join(process.cwd(), "private", "gallery", file),
      );
    }
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        Vary: "Cookie",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
