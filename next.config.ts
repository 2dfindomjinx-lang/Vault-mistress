import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/gallery/[...path]": ["./private/gallery/**/*"],
  },
  async rewrites() {
    return [{ source: "/gallery/:path*", destination: "/api/gallery/:path*" }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
          },
        ],
      },
    ];
  },
  // Prefer modern formats for next/image optimization pipeline.
  images: {
    qualities: [75, 85],
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
