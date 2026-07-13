import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

const BUCKET = "principessa-feed";
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MIME_EXTENSIONS: Record<string, string> = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return Response.json({ error: "Supabase admin is not configured." }, { status: 500 });
  }

  const authSupabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await authSupabase.auth.getUser();
  if (authError || !authData.user) {
    return Response.json({ error: "Sign in to submit a post." }, { status: 401 });
  }

  const formData = await request.formData();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const image = formData.get("image");

  if (title.length < 2 || title.length > 80) {
    return Response.json({ error: "Title must be 2-80 characters." }, { status: 422 });
  }
  if (description.length < 1 || description.length > 500) {
    return Response.json({ error: "Post text must be 1-500 characters." }, { status: 422 });
  }
  if (!(image instanceof File) || image.size < 1 || image.size > MAX_IMAGE_BYTES || !MIME_EXTENSIONS[image.type]) {
    return Response.json({ error: "Choose one JPG, PNG, WEBP or GIF image up to 4MB." }, { status: 422 });
  }

  const supabase = createSupabaseAdminClient();
  const { count: pendingCount, error: pendingError } = await supabase
    .from("principessa_posts")
    .select("id", { count: "exact", head: true })
    .eq("author_id", authData.user.id)
    .eq("channel", "sub")
    .eq("status", "pending");
  if (pendingError) {
    return Response.json({ error: pendingError.message }, { status: 500 });
  }
  if ((pendingCount ?? 0) >= 3) {
    return Response.json({ error: "You can have at most 3 posts waiting for approval." }, { status: 429 });
  }

  const postId = crypto.randomUUID();
  const extension = MIME_EXTENSIONS[image.type];
  const storagePath = `subs/${postId}/${crypto.randomUUID()}.${extension}`;
  const { error: postError } = await supabase.from("principessa_posts").insert({
    author_id: authData.user.id,
    channel: "sub",
    description,
    id: postId,
    status: "pending",
    title,
  });
  if (postError) {
    return Response.json({ error: postError.message }, { status: 500 });
  }

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, Buffer.from(await image.arrayBuffer()), {
      cacheControl: "3600",
      contentType: image.type,
      upsert: false,
    });
  if (uploadError) {
    await supabase.from("principessa_posts").delete().eq("id", postId);
    return Response.json({ error: uploadError.message }, { status: 500 });
  }

  const { error: imageError } = await supabase.from("principessa_post_images").insert({
    image_url: storagePath,
    post_id: postId,
    sort_order: 0,
    storage_path: storagePath,
  });
  if (imageError) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    await supabase.from("principessa_posts").delete().eq("id", postId);
    return Response.json({ error: imageError.message }, { status: 500 });
  }

  return Response.json(
    { message: "Your post was submitted and is waiting for Principessa approval." },
    { status: 201 },
  );
}
