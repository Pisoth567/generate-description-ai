import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep browser verification separate from an already-running developer server.
  distDir: process.env.NEXT_TEST_DIST_DIR || ".next",
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // OAuth callback query strings contain authorization codes.
  logging: { incomingRequests: { ignore: [/\/api\/auth\/google\//] } },

};

export default nextConfig;
