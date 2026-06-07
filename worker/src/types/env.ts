/** Environment bindings for the Cloudflare Worker */
export interface Env {
  /** D1 database for file metadata */
  DB: D1Database
  /** R2 bucket for file content storage */
  STORAGE: R2Bucket
}
