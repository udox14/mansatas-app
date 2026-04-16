import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";

const config = defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
});

// Exclude paket besar yang tidak perlu di-bundle ke worker
config.edgeExternals = [
  "@vercel/og",
  "node:crypto",
  "next/dist/compiled/@vercel/og",
  "next/dist/compiled/@vercel/og/index.edge.js",
  "next/dist/compiled/@vercel/og/resvg.wasm",
  "next/dist/compiled/@vercel/og/yoga.wasm",
];

// Matikan minifikasi OpenNext — bikin instrumentation hook Next.js error runtime
// Bundle size dikecilkan via externals + serverExternalPackages di next.config.ts
config.default.minify = false;

export default config;