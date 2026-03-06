import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Diperlukan agar next/font/google tidak mencoba download saat build di Cloudflare
  // Inter akan di-load via CSS fallback
  images: {
    // Cloudflare Workers tidak mendukung Image Optimization bawaan Next.js
    // Gunakan loader: 'custom' atau unoptimized: true
    unoptimized: true,
  },
};

export default nextConfig;