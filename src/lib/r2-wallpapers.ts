import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

const ALLOWED_CONTENT_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name} environment variable.`);
  }
  return value;
}

function r2Client() {
  const accountId = requiredEnv("R2_ACCOUNT_ID");
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
}

export async function prepareWallpaperUpload(contentType: string) {
  const extension = ALLOWED_CONTENT_TYPES.get(contentType);
  if (!extension) {
    throw new Error("Only JPEG, PNG, and WebP wallpaper files are supported.");
  }

  const bucket = requiredEnv("R2_BUCKET_NAME");
  const publicBaseUrl = requiredEnv("R2_PUBLIC_BASE_URL").replace(/\/+$/, "");
  const now = new Date();
  const objectKey = [
    "wallpapers",
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    `${randomUUID()}.${extension}`,
  ].join("/");

  const uploadUrl = await getSignedUrl(
    r2Client(),
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: contentType,
    }),
    { expiresIn: 10 * 60 },
  );

  return {
    uploadUrl,
    objectKey,
    wallpaperUrl: `${publicBaseUrl}/${objectKey}`,
    version: randomUUID(),
    expiresInSeconds: 10 * 60,
  };
}
