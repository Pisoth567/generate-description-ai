import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // OAuth callback query strings contain authorization codes.
  logging: { incomingRequests: { ignore: [/\/api\/auth\/google\//] } },

};

export default nextConfig;
