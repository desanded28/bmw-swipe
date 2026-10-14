import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client", "libsql"],
  experimental: {
    // Two root layouts ([locale] and dashboard) and none at the top: unmatched URLs need their own page.
    globalNotFound: true,
  },
};

export default nextConfig;
