import { requireAdminProfile } from "@/lib/admin-guard";
import { listPrincipessaFeedPosts } from "@/lib/principessa-feed";

const BUCKET = "principessa-feed";
const MAX_IMAGES = 8;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MIME_EXTENSIONS: Record<string, string> = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

type StoredImageRow = {
  id: string;
  image_url: string;
  post_id: string;
  sort_order: number;
  storage_path: string;
};

function getImageFiles(formData: FormData) {
  return formData
    .getAll("images")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

function validatePostFields(title: string, description: string) {
  if (title.length < 2 || title.length > 120) {
    return "Title must be 2-120 characters.";
  }
  if (description.length < 1 || description.length > 4000) {
    return "Description must be 1-4000 characters.";
  }
  return null;
}

function validateImageFiles(files: File[], { required }: { required: boolean }) {
  if ((required && files.length < 1) || files.length > MAX_IMAGES) {
    return `Choose ${required ? "1" : "0"}-${MAX_IMAGES} images.`;
  }
  if (files.some((file) => !MIME_EXTENSIONS[file.type] || file.size > MAX_IMAGE_BYTES)) {
    return "Images must be JPG, PNG, WEBP or GIF and at most 8MB each.";
  }
  return null;
}

async function uploadImages(
  admin: Exclude<Awaited<ReturnType<typeof requireAdminProfile>>, { error: string; status: number }>,
  postId: string,
  files: File[],
) {
  const uploadedPaths: string[] = [];
  const imageRows: Omit<StoredImageRow, "id">[] = [];

  for (const [index, file] of files.entries()) {
    const extension = MIME_EXTENSIONS[file.type];
    const storagePath = `${postId}/${String(index + 1).padStart(2, "0")}-${crypto.randomUUID()}.${extension}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await admin.supabase.storage.from(BUCKET).upload(storagePath, bytes, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

    if (uploadError) {
      if (uploadedPaths.length > 0) {
        await admin.supabase.storage.from(BUCKET).remove(uploadedPaths);
      }
      throw uploadError;
    }

    uploadedPaths.push(storagePath);
    imageRows.push({
      image_url: storagePath,
      post_id: postId,
      sort_order: index,
      storage_path: storagePath,
    });
  }

  return { imageRows, uploadedPaths };
}

export async function POST(request: Request) {
  const admin = await requireAdminProfile();
  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  const formData = await request.formData();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const files = getImageFiles(formData);
  const validationError = validatePostFields(title, description) ?? validateImageFiles(files, { required: true });
  if (validationError) {
    return Response.json({ error: validationError }, { status: 422 });
  }

  const postId = crypto.randomUUID();
  const { error: postError } = await admin.supabase.from("principessa_posts").insert({
    author_id: admin.adminUser.id,
    channel: "principessa",
    description,
    id: postId,
    status: "published",
    title,
  });

  if (postError) {
    console.error("Principessa feed post insert failed", postError);
    return Response.json({ error: postError.message }, { status: 500 });
  }

  const uploadedPaths: string[] = [];

  try {
    const upload = await uploadImages(admin, postId, files);
    uploadedPaths.push(...upload.uploadedPaths);

    const { error: imagesError } = await admin.supabase.from("principessa_post_images").insert(upload.imageRows);
    if (imagesError) {
      throw imagesError;
    }
  } catch (error) {
    console.error("Principessa feed image upload failed", error);
    if (uploadedPaths.length > 0) {
      await admin.supabase.storage.from(BUCKET).remove(uploadedPaths);
    }
    await admin.supabase.from("principessa_posts").delete().eq("id", postId);
    return Response.json(
      { error: error instanceof Error ? error.message : "Post images could not be uploaded." },
      { status: 500 },
    );
  }

  return Response.json({ posts: await listPrincipessaFeedPosts(admin.supabase) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const admin = await requireAdminProfile();
  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  const formData = await request.formData();
  const postId = String(formData.get("postId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const files = getImageFiles(formData);
  const validationError = validatePostFields(title, description) ?? validateImageFiles(files, { required: false });

  if (!postId) {
    return Response.json({ error: "Missing post id." }, { status: 400 });
  }
  if (validationError) {
    return Response.json({ error: validationError }, { status: 422 });
  }

  const { data: post, error: postError } = await admin.supabase
    .from("principessa_posts")
    .select("id, title, description, channel")
    .eq("id", postId)
    .maybeSingle();
  if (postError || !post) {
    return Response.json({ error: postError?.message ?? "Post not found." }, { status: postError ? 500 : 404 });
  }

  const { data: oldImages, error: oldImagesError } = await admin.supabase
    .from("principessa_post_images")
    .select("id, post_id, image_url, storage_path, sort_order")
    .eq("post_id", postId)
    .order("sort_order", { ascending: true });
  if (oldImagesError) {
    return Response.json({ error: oldImagesError.message }, { status: 500 });
  }

  let replacement: Awaited<ReturnType<typeof uploadImages>> | null = null;
  try {
    if (files.length > 0) {
      replacement = await uploadImages(admin, postId, files);
    }

    const { error: updateError } = await admin.supabase
      .from("principessa_posts")
      .update({ description, title, updated_at: new Date().toISOString() })
      .eq("id", postId);
    if (updateError) {
      throw updateError;
    }

    if (replacement) {
      const { error: deleteImagesError } = await admin.supabase
        .from("principessa_post_images")
        .delete()
        .eq("post_id", postId);
      if (deleteImagesError) {
        throw deleteImagesError;
      }

      const { error: insertImagesError } = await admin.supabase
        .from("principessa_post_images")
        .insert(replacement.imageRows);
      if (insertImagesError) {
        const restoreRows = ((oldImages ?? []) as StoredImageRow[]).map((image) => ({
          id: image.id,
          image_url: image.image_url,
          post_id: image.post_id,
          sort_order: image.sort_order,
          storage_path: image.storage_path,
        }));
        if (restoreRows.length > 0) {
          await admin.supabase.from("principessa_post_images").insert(restoreRows);
        }
        throw insertImagesError;
      }

      const oldPaths = ((oldImages ?? []) as StoredImageRow[]).map((image) => image.storage_path);
      if (oldPaths.length > 0) {
        const { error: oldStorageError } = await admin.supabase.storage.from(BUCKET).remove(oldPaths);
        if (oldStorageError) {
          console.error("Principessa feed old image cleanup failed", oldStorageError);
        }
      }
    }
  } catch (error) {
    if (replacement?.uploadedPaths.length) {
      await admin.supabase.storage.from(BUCKET).remove(replacement.uploadedPaths);
    }
    await admin.supabase
      .from("principessa_posts")
      .update({ description: post.description, title: post.title, updated_at: new Date().toISOString() })
      .eq("id", postId);
    console.error("Principessa feed post update failed", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Post could not be updated." },
      { status: 500 },
    );
  }

  return Response.json({
    posts: await listPrincipessaFeedPosts(admin.supabase, {
      channel: post.channel === "sub" ? "sub" : "principessa",
    }),
  });
}

export async function DELETE(request: Request) {
  const admin = await requireAdminProfile();
  if ("error" in admin) {
    return Response.json({ error: admin.error }, { status: admin.status });
  }

  const body = (await request.json()) as { postId?: string };
  const postId = String(body.postId ?? "").trim();
  if (!postId) {
    return Response.json({ error: "Missing post id." }, { status: 400 });
  }

  const { data: post, error: postError } = await admin.supabase
    .from("principessa_posts")
    .select("id, channel")
    .eq("id", postId)
    .maybeSingle();
  if (postError || !post) {
    return Response.json({ error: postError?.message ?? "Post not found." }, { status: postError ? 500 : 404 });
  }

  const { data: images, error: imagesError } = await admin.supabase
    .from("principessa_post_images")
    .select("storage_path")
    .eq("post_id", postId);
  if (imagesError) {
    return Response.json({ error: imagesError.message }, { status: 500 });
  }

  const { data: deletedPost, error: deleteError } = await admin.supabase
    .from("principessa_posts")
    .delete()
    .eq("id", postId)
    .select("id")
    .maybeSingle();
  if (deleteError) {
    return Response.json({ error: deleteError.message }, { status: 500 });
  }
  if (!deletedPost) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }

  const storagePaths = (images ?? []).map((image) => String(image.storage_path));
  if (storagePaths.length > 0) {
    const { error: storageError } = await admin.supabase.storage.from(BUCKET).remove(storagePaths);
    if (storageError) {
      console.error("Principessa feed deleted image cleanup failed", storageError);
    }
  }

  return Response.json({
    posts: await listPrincipessaFeedPosts(admin.supabase, {
      channel: post.channel === "sub" ? "sub" : "principessa",
    }),
  });
}
