import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    // Next.js 16 blocks loopback/private IPs as image upstreams by default
    // (SSRF protection). Local Supabase Storage runs on 127.0.0.1, so we
    // opt in only in dev. Production uses *.supabase.co over HTTPS and is
    // unaffected.
    dangerouslyAllowLocalIP: isDev,
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
