import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/dist/api/kv-cache";

export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
});
