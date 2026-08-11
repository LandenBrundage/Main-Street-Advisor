import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    // This workspace has a slow filesystem. Next's default development disk
    // cache spent up to 89 seconds compacting and blocked browser hydration.
    // The in-memory development cache is faster and more reliable here.
    turbopackFileSystemCacheForDev: false,
  },
  // Separate build directories let the real and fictional-customer dev
  // workspaces run side by side without sharing Next.js's dev lock.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
