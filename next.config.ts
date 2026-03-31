import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // Exclude heavy packages from server bundle
  serverExternalPackages: [],
  // Optimize bundle
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
