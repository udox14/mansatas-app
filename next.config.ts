import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["@vercel/og"],
  productionBrowserSourceMaps: false,
  experimental: {
    serverMinification: true,
    optimizePackageImports: ["lucide-react", "framer-motion", "@radix-ui/react-avatar", "@radix-ui/react-checkbox", "@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "@radix-ui/react-label", "@radix-ui/react-scroll-area", "@radix-ui/react-select", "@radix-ui/react-slot", "@radix-ui/react-tabs", "recharts", "date-fns"],
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },


};

export default nextConfig;