import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from './types/env'
import files from './routes/files'
import trash from './routes/trash'
import shares from './routes/shares'
import { createFileRepository } from './repositories/fileRepository'
import { createStorageRepository } from './repositories/storageRepository'
import { createShareRepository } from './repositories/shareRepository'
import { createShareService } from './services/shareService'

const app = new Hono<{ Bindings: Env }>()

/** Wraps a handler with Cache API: check edge cache first, store 200/404 responses */
async function withCache(
  req: Request,
  ctx: ExecutionContext,
  handler: () => Promise<{ status: number; body: unknown }>,
): Promise<Response> {
  try {
    const cache = caches.default
    const cached = await cache.match(req)
    if (cached) return cached
  } catch {
    // Cache API unavailable, proceed without caching
  }

  const { status, body } = await handler()

  try {
    const ttl = status === 200 ? 600 : 30
    const response = new Response(JSON.stringify(body), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${ttl}`,
      },
    })

    ctx.waitUntil(caches.default.put(req, response.clone()))
    return response
  } catch {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

app.use('/api/*', cors())

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Internal server error' }, 500)
})

app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404)
})

app.get('/api/health', (c) => {
  return c.json({ status: 'ok' })
})

app.route('/api/v1/files', files)
app.route('/api/v1/trash', trash)
app.route('/api/v1/shares', shares)

app.get('/api/v1/s/:token', (c) =>
  withCache(c.req.raw, c.executionCtx, async () => {
    const svc = createShareService(createShareRepository(c.env.DB), createFileRepository(c.env.DB))
    const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('pageSize') ?? '50', 10)))
    const result = await svc.getPublic(c.req.param('token'), page, pageSize)
    if (!result) return { status: 404, body: { error: 'Not found or expired' } }
    return { status: 200, body: result }
  }),
)

app.get('/api/v1/s/:token/browse/:folderId', (c) =>
  withCache(c.req.raw, c.executionCtx, async () => {
    const svc = createShareService(createShareRepository(c.env.DB), createFileRepository(c.env.DB))
    const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('pageSize') ?? '50', 10)))
    const result = await svc.getPublicBrowse(c.req.param('token'), c.req.param('folderId'), page, pageSize)
    if (!result) return { status: 404, body: { error: 'Not found' } }
    return { status: 200, body: result }
  }),
)

app.get('/api/v1/s/:token/download', async (c) => {
  const shareRepo = createShareRepository(c.env.DB)
  const fileRepo = createFileRepository(c.env.DB)
  const share = await shareRepo.findByToken(c.req.param('token'))
  if (!share) return c.json({ error: 'Not found' }, 404)
  if (share.expiresAt && new Date(share.expiresAt) < new Date()) return c.json({ error: 'Expired' }, 410)
  const record = await fileRepo.findById(share.fileId)
  if (!record || record.isTrashed || !record.r2Key) return c.json({ error: 'Not found' }, 404)
  const storage = createStorageRepository(c.env.STORAGE)
  const obj = await storage.download(record.r2Key)
  if (!obj) return c.json({ error: 'File not found in storage' }, 404)
  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  headers.set('Content-Disposition', `inline; filename="${record.name}"`)
  return new Response(obj.body, { headers })
})

app.get('/api/v1/s/:token/download/:fileId', async (c) => {
  const shareRepo = createShareRepository(c.env.DB)
  const fileRepo = createFileRepository(c.env.DB)
  const share = await shareRepo.findByToken(c.req.param('token'))
  if (!share) return c.json({ error: 'Not found' }, 404)
  if (share.expiresAt && new Date(share.expiresAt) < new Date()) return c.json({ error: 'Expired' }, 410)
  const record = await fileRepo.findById(c.req.param('fileId'))
  if (!record || record.isTrashed || !record.r2Key) return c.json({ error: 'Not found' }, 404)
  const svc = createShareService(shareRepo, fileRepo)
  if (record.id !== share.fileId && !(await svc.isDescendant(record.id, share.fileId))) {
    return c.json({ error: 'Forbidden' }, 403)
  }
  const storage = createStorageRepository(c.env.STORAGE)
  const obj = await storage.download(record.r2Key)
  if (!obj) return c.json({ error: 'File not found in storage' }, 404)
  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  headers.set('Content-Disposition', `attachment; filename="${record.name}"`)
  return new Response(obj.body, { headers })
})

/** Catch-all: serve frontend SPA with client-side routing fallback */
app.all('*', async (c) => {
  const url = new URL(c.req.url)
  // API routes are matched before this catch-all, so this is a SPA or file request
  const res = await c.env.ASSETS.fetch(c.req.raw)
  if (res.status === 404 && !url.pathname.startsWith('/api/')) {
    return c.env.ASSETS.fetch(new Request(new URL('/index.html', c.req.url).toString()))
  }
  return res
})

export default {
  fetch: app.fetch,
}
