import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prefer modern formats for next/image optimization pipeline.
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
