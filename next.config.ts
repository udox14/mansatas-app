import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev(
    process.env.CLOUDFLARE_REMOTE_CONFIG_PATH
      ? {
          configPath: process.env.CLOUDFLARE_REMOTE_CONFIG_PATH,
          remoteBindings: true,
        }
      : undefined
  );
}

const nextConfig: NextConfig = {
  async headers() {
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()' },
      { key: 'X-Frame-Options', value: 'DENY' },
      ...(process.env.NODE_ENV === 'production'
        ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
        : []),
    ]
    return [{ source: '/:path*', headers: securityHeaders }]
  },
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
      bodySizeLimit: '3mb',
    },
  },
};

export default nextConfig;
