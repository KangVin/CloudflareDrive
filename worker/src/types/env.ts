/** Environment bindings for the Cloudflare Worker */
export interface Env {
  /** D1 database for file metadata */
  DB: D1Database
  /** R2 bucket for file content storage */
  STORAGE: R2Bucket
  /** Static assets binding for frontend SPA */
  ASSETS: Fetcher
  /** Secret key used for HMAC share verify token signing. Set via `wrangler secret put`. Falls back to a dev-only default if not set. */
  SHARED_SECRET?: string
}
