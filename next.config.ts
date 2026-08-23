import type { NextConfig } from "next";

// Local Supabase Storage lives on a loopback address. Detect that from
// the Supabase URL rather than NODE_ENV, so a production build pointed
// at a local stack (demos, `next start` against `supabase start`) still
// optimises images. A real deployment points at https://*.supabase.co,
// where this is false.
const usingLocalSupabase = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
);

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    // Next.js 16 blocks loopback/private IPs as image upstreams by default
    // (SSRF protection). Opt in only when Supabase Storage is itself
    // local — a hosted deployment never trips this.
    dangerouslyAllowLocalIP: usingLocalSupabase,
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
