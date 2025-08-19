import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CSP headers removed - Privy handles its own security policies
  // The CSP was causing conflicts with Privy's iframe embedding
};

export default nextConfig;
