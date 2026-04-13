import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";

const config = defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
});

// Exclude paket besar yang gak perlu di-bundle ke worker
config.edgeExternals = [
  "@vercel/og",
  "node:crypto",
  "next/dist/compiled/@vercel/og",
  "next/dist/compiled/@vercel/og/index.edge.js",
  "next/dist/compiled/@vercel/og/resvg.wasm",
  "next/dist/compiled/@vercel/og/yoga.wasm",
];

// AKTIFKAN minifikasi OpenNext — wajib biar muat di Cloudflare Free (3 MB)
// Kalau ternyata bikin runtime error setelah deploy, ganti ke false
config.default.minify = true;

export default config;