import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Placeholder imagery only — remove once real photos replace src/content/images.ts.
      { protocol: "https", hostname: "placehold.co" },
    ],
  },
};

export default nextConfig;
