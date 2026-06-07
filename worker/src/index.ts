import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from './types/env'
import files from './routes/files'
import trash from './routes/trash'
import shares from './routes/shares'
import { createFileRepository } from './repositories/fileRepository'
import { createStorageRepository, TEMP_CHUNK_TTL_MS } from './repositories/storageRepository'
import { createShareRepository } from './repositories/shareRepository'
import { createShareService } from './services/shareService'

const app = new Hono<{ Bindings: Env }>()

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

app.get('/api/v1/s/:token', async (c) => {
  const svc = createShareService(createShareRepository(c.env.DB), createFileRepository(c.env.DB))
  const result = await svc.getPublic(c.req.param('token'))
  if (!result) return c.json({ error: 'Not found or expired' }, 404)
  return c.json(result)
})

app.get('/api/v1/s/:token/browse/:folderId', async (c) => {
  const svc = createShareService(createShareRepository(c.env.DB), createFileRepository(c.env.DB))
  const result = await svc.getPublicBrowse(c.req.param('token'), c.req.param('folderId'))
  if (!result) return c.json({ error: 'Not found' }, 404)
  return c.json(result)
})

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
  const storage = createStorageRepository(c.env.STORAGE)
  const obj = await storage.download(record.r2Key)
  if (!obj) return c.json({ error: 'File not found in storage' }, 404)
  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  headers.set('Content-Disposition', `attachment; filename="${record.name}"`)
  return new Response(obj.body, { headers })
})

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    try {
      const storage = createStorageRepository(env.STORAGE)
      const cutoff = new Date(Date.now() - TEMP_CHUNK_TTL_MS)
      const count = await storage.deleteOrphanedTempChunks(cutoff)
      console.log(`Scheduled cleanup: deleted ${count} orphaned temp chunks`)
    } catch (e) {
      console.error('Scheduled cleanup failed:', e)
    }
  },
}
