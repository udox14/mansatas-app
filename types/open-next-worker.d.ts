// OpenNext creates this module during build. Keep pre-build typechecking usable
// on a clean checkout, including the Worker imported by tests and SELF bindings.
declare module '*.open-next/worker.js' {
  const worker: {
    fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response>
  }
  export default worker

  export { DOQueueHandler } from '@opennextjs/cloudflare/durable-objects/queue'
  export { DOShardedTagCache } from '@opennextjs/cloudflare/durable-objects/sharded-tag-cache'
  export { BucketCachePurge } from '@opennextjs/cloudflare/durable-objects/bucket-cache-purge'
}
