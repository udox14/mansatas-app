// Lokasi: env.d.ts
// Type declarations untuk Cloudflare Workers bindings
// Digunakan oleh getCloudflareContext({ async: true }) dari @opennextjs/cloudflare

// ============================================================
// CLOUDFLARE WORKERS TYPES (inline, tanpa @cloudflare/workers-types)
// ============================================================
declare interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>
  exec(query: string): Promise<D1ExecResult>
}
declare interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = unknown>(colName?: string): Promise<T | null>
  run(): Promise<D1Result>
  all<T = unknown>(): Promise<D1Result<T>>
  raw<T = unknown>(): Promise<T[]>
}
declare interface D1Result<T = unknown> {
  results: T[]
  success: boolean
  error?: string
  meta: Record<string, unknown>
}
declare interface D1ExecResult {
  count: number
  duration: number
}
declare interface R2Bucket {
  put(key: string, value: ArrayBuffer | ArrayBufferView | string | ReadableStream | Blob | null, options?: R2PutOptions): Promise<R2Object>
  get(key: string, options?: R2GetOptions): Promise<R2ObjectBody | null>
  delete(keys: string | string[]): Promise<void>
  list(options?: R2ListOptions): Promise<R2Objects>
  head(key: string): Promise<R2Object | null>
}
declare interface R2Object {
  key: string; version: string; size: number; etag: string; httpEtag: string
  checksums: R2Checksums; uploaded: Date; httpMetadata?: R2HTTPMetadata; customMetadata?: Record<string, string>
}
declare interface R2ObjectBody extends R2Object {
  body: ReadableStream; bodyUsed: boolean
  arrayBuffer(): Promise<ArrayBuffer>; text(): Promise<string>; json<T>(): Promise<T>; blob(): Promise<Blob>
}
declare interface R2PutOptions { httpMetadata?: R2HTTPMetadata; customMetadata?: Record<string, string> }
declare interface R2GetOptions { onlyIf?: R2Conditional }
declare interface R2ListOptions { limit?: number; prefix?: string; cursor?: string; delimiter?: string }
declare interface R2Objects { objects: R2Object[]; truncated: boolean; cursor?: string; delimitedPrefixes: string[] }
declare interface R2HTTPMetadata { contentType?: string; contentLanguage?: string; contentDisposition?: string; contentEncoding?: string; cacheControl?: string; cacheExpiry?: Date }
declare interface R2Checksums { md5?: ArrayBuffer; sha1?: ArrayBuffer; sha256?: ArrayBuffer; sha384?: ArrayBuffer; sha512?: ArrayBuffer }
declare interface R2Conditional { etagMatches?: string; etagDoesNotMatch?: string; uploadedBefore?: Date; uploadedAfter?: Date }
declare interface Fetcher { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> }
declare type Service<T = unknown> = Fetcher & T
declare interface BrowserRun extends Fetcher {}
declare interface RateLimit { limit(options: { key: string }): Promise<{ success: boolean }> }
declare interface ExecutionContext { waitUntil(promise: Promise<unknown>): void; passThroughOnException(): void }
declare interface KVNamespace {
  get(key: string, options?: KVNamespaceGetOptions<undefined>): Promise<string | null>
  get(key: string, type: 'text'): Promise<string | null>
  get<T>(key: string, type: 'json'): Promise<T | null>
  get(key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>
  put(key: string, value: string | ArrayBuffer | ReadableStream, options?: KVNamespacePutOptions): Promise<void>
  delete(key: string): Promise<void>
  list(options?: KVNamespaceListOptions): Promise<KVNamespaceListResult<unknown>>
}
declare interface KVNamespaceGetOptions<T> { type?: T; cacheTtl?: number }
declare interface KVNamespacePutOptions { expiration?: number; expirationTtl?: number; metadata?: Record<string, unknown> }
declare interface KVNamespaceListOptions { limit?: number; prefix?: string; cursor?: string }
declare interface KVNamespaceListResult<T> { keys: { name: string; expiration?: number; metadata?: T }[]; list_complete: boolean; cursor?: string }

// ============================================================
// CLOUDFLARE ENV BINDINGS
// ============================================================
interface CloudflareEnv {
  DB: D1Database
  R2: R2Bucket
  NEXT_INC_CACHE_KV: KVNamespace
  LOGIN_RATE_LIMITER: RateLimit
  BROWSER: BrowserRun
  STATIC_ASSETS: Fetcher
  SELF: Fetcher
  BETTER_AUTH_URL: string
  ALLOWED_APP_ORIGINS: string
  CSP_ENFORCE: string
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: string
  VAPID_SUBJECT: string

  // Secret bindings tidak ditulis di wrangler.jsonc dan ditambahkan melalui `wrangler secret put`.
  BETTER_AUTH_SECRET: string
  MEDIA_SIGNING_SECRET: string
  AUTH_RATE_LIMIT_PEPPER: string
  CRON_SECRET: string
  VAPID_PRIVATE_KEY: string

  // FCM (Firebase Cloud Messaging) HTTP v1 — service account secrets
  FCM_PROJECT_ID: string
  FCM_CLIENT_EMAIL: string
  FCM_PRIVATE_KEY: string
}
