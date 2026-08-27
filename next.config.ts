import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Placeholder imagery only — remove once real photos replace src/content/images.ts.
      { protocol: "https", hostname: "placehold.co" },
    ],
  },
  async redirects() {
    return [
      {
        source: "/services",
        destination: "/services/wash-and-fold",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
