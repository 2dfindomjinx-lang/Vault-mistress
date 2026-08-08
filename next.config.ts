import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prefer modern formats for next/image optimization pipeline.
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // The Devotion board moved onto Home as a compact widget, so /devotion no
  // longer exists as its own panel. 307 (not 308) so the URL stays reclaimable
  // and nothing caches the redirect permanently.
  async redirects() {
    return [{ source: "/devotion", destination: "/", permanent: false }];
  },
};

export default nextConfig;
