import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      // Local Supabase Storage (CLI)
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "54421",
        pathname: "/storage/v1/**",
      },
      // Hosted Supabase Storage
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/**",
      },
    ],
  },
};

export default nextConfig;
