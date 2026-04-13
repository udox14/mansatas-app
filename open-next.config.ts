import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";

const config = defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
});

config.edgeExternals = ["@vercel/og", "node:crypto"];

// Matikan minifikasi OpenNext karena merusak runtime
config.default.minify = false;

export default config;