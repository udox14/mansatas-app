import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // Cegah paket-paket besar masuk ke server bundle (Worker Cloudflare)
  serverExternalPackages: ["@vercel/og"],
  productionBrowserSourceMaps: false,
  experimental: {
    serverMinification: true,
    optimizePackageImports: [
      "framer-motion",
      "@radix-ui/react-avatar", "@radix-ui/react-checkbox",
      "@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-label", "@radix-ui/react-scroll-area",
      "@radix-ui/react-select", "@radix-ui/react-slot",
      "@radix-ui/react-tabs", "recharts", "date-fns",
    ],
    serverActions: {
      // Batas 5 MB berlaku untuk seluruh multipart request, bukan hanya PDF.
      // Form pengajuan sendiri ikut memakai sebagian ukuran request.
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
