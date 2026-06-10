import { Hono } from 'hono'
import type { Env } from '../types/env'
import { createFileRepository } from '../repositories/fileRepository'
import { createStorageRepository } from '../repositories/storageRepository'
import { createShareRepository } from '../repositories/shareRepository'
import { createShareService } from '../services/shareService'
import { createFileService } from '../services/fileService'

const files = new Hono<{ Bindings: Env }>()

function deleteShareCacheEntries(origin: string, token: string, folderId: string) {
  const cache = caches.default
  const rootUrl = `${origin}/api/v1/s/${token}`
  cache.delete(new Request(rootUrl))
  cache.delete(new Request(`${rootUrl}?page=1&pageSize=50`))
  const browseUrl = `${origin}/api/v1/s/${token}/browse/${folderId}`
  cache.delete(new Request(browseUrl))
  cache.delete(new Request(`${browseUrl}?page=1&pageSize=50`))
}

/** Invalidate Cache API entries for a share if the given folder is within a shared tree */
async function invalidateShareCache(db: D1Database, origin: string, folderId: string | null) {
  if (!folderId) return
  const svc = createShareService(createShareRepository(db), createFileRepository(db))
  const token = await svc.findShareTokenByDescendant(folderId)
  if (!token) return
  deleteShareCacheEntries(origin, token, folderId)
}

/** Invalidate Cache API entries if the given file itself is a share root */
async function invalidateShareCacheByFileId(db: D1Database, origin: string, fileId: string | null) {
  if (!fileId) return
  const shareRepo = createShareRepository(db)
  const share = await shareRepo.findByFileId(fileId)
  if (!share) return
  deleteShareCacheEntries(origin, share.token, fileId)
}

files.get('/', async (c) => {
  const parentId = c.req.query('parentId') ?? null
  const svc = createFileService(createFileRepository(c.env.DB), createStorageRepository(c.env.STORAGE))
  const items = await svc.list(parentId)
  return c.json(items)
})

files.get('/search', async (c) => {
  const q = c.req.query('q')
  if (!q) return c.json({ error: 'Query parameter q is required' }, 400)
  const svc = createFileService(createFileRepository(c.env.DB), createStorageRepository(c.env.STORAGE))
  const items = await svc.search(q)
  return c.json(items)
})

files.get('/by-hash', async (c) => {
  const hash = c.req.query('hash')
  if (!hash) return c.json({ error: 'Hash parameter is required' }, 400)
  const svc = createFileService(createFileRepository(c.env.DB), createStorageRepository(c.env.STORAGE))
  const item = await svc.checkHash(hash)
  if (!item) return c.json({ error: 'Not found' }, 404)
  return c.json(item)
})

files.post('/instant', async (c) => {
  const body = await c.req.json<{ hash: string; parentId?: string | null; name: string; mimeType?: string | null }>()
  if (!body.hash || !body.name) return c.json({ error: 'hash and name are required' }, 400)
  const svc = createFileService(createFileRepository(c.env.DB), createStorageRepository(c.env.STORAGE))
  const item = await svc.instant(
    body.hash,
    body.parentId ?? null,
    body.name,
    body.mimeType ?? 'application/octet-stream',
  )
  if (!item) return c.json({ error: 'Hash not found' }, 404)
  const origin = new URL(c.req.url).origin
  c.executionCtx.waitUntil(invalidateShareCache(c.env.DB, origin, item.parentId))
  return c.json(item, 201)
})

files.post('/:id/copy', async (c) => {
  const body = await c.req.json<{ parentId?: string | null }>()
  const svc = createFileService(createFileRepository(c.env.DB), createStorageRepository(c.env.STORAGE))
  const item = await svc.copy(c.req.param('id'), body.parentId ?? null)
  if (!item) return c.json({ error: 'Not found' }, 404)
  const origin = new URL(c.req.url).origin
  c.executionCtx.waitUntil(invalidateShareCache(c.env.DB, origin, item.parentId))
  return c.json(item, 201)
})

files.get('/:id', async (c) => {
  const svc = createFileService(createFileRepository(c.env.DB), createStorageRepository(c.env.STORAGE))
  const item = await svc.get(c.req.param('id'))
  if (!item) return c.json({ error: 'Not found' }, 404)
  return c.json(item)
})

files.post('/', async (c) => {
  const body = await c.req.json<{ name: string; parentId?: string | null }>()
  if (!body.name) return c.json({ error: 'Name is required' }, 400)
  const svc = createFileService(createFileRepository(c.env.DB), createStorageRepository(c.env.STORAGE))
  const item = await svc.createFolder(body.name, body.parentId ?? null)
  const origin = new URL(c.req.url).origin
  c.executionCtx.waitUntil(invalidateShareCache(c.env.DB, origin, item.parentId))
  return c.json(item, 201)
})

files.post('/upload/create', async (c) => {
  const body = await c.req.json<{ name: string }>()
  if (!body.name) return c.json({ error: 'name is required' }, 400)
  const safeName = body.name.replace(/[/\\]/g, '_')
  const key = `uploads/${crypto.randomUUID()}/${safeName}`
  const storage = createStorageRepository(c.env.STORAGE)
  const mpu = await storage.createMultipartUpload(key)
  return c.json({ uploadId: mpu.uploadId, key })
})

files.post('/upload/part', async (c) => {
  const form = await c.req.formData()
  const uploadId = form.get('uploadId') as string
  const key = form.get('key') as string
  const partNumber = parseInt(form.get('partNumber') as string, 10)
  const chunk = form.get('chunk') as File | null
  if (!uploadId || !key || isNaN(partNumber) || !chunk) {
    return c.json({ error: 'Missing required fields' }, 400)
  }
  const storage = createStorageRepository(c.env.STORAGE)
  const mpu = storage.resumeMultipartUpload(key, uploadId)
  const part = await storage.uploadPart(mpu, partNumber, chunk)
  return c.json({ partNumber: part.partNumber, etag: part.etag })
})

files.post('/upload/complete', async (c) => {
  const body = await c.req.json<{
    uploadId: string
    key: string
    parts: { partNumber: number; etag: string }[]
    name: string
    parentId?: string | null
    mimeType?: string | null
  }>()
  if (!body.uploadId || !body.key || !body.name || !body.parts) {
    return c.json({ error: 'Missing required fields' }, 400)
  }
  const svc = createFileService(createFileRepository(c.env.DB), createStorageRepository(c.env.STORAGE))
  const item = await svc.finalizeMultipartUpload(
    body.uploadId,
    body.key,
    body.parts,
    body.parentId ?? null,
    body.name,
    body.mimeType ?? 'application/octet-stream',
  )
  const origin = new URL(c.req.url).origin
  c.executionCtx.waitUntil(invalidateShareCache(c.env.DB, origin, item.parentId))
  return c.json(item, 201)
})

files.post('/upload/abort', async (c) => {
  const body = await c.req.json<{ uploadId: string; key: string }>()
  if (!body.uploadId || !body.key) return c.json({ error: 'uploadId and key are required' }, 400)
  const storage = createStorageRepository(c.env.STORAGE)
  const mpu = storage.resumeMultipartUpload(body.key, body.uploadId)
  await storage.abortMultipartUpload(mpu)
  return c.body(null, 204)
})

files.post('/upload', async (c) => {
  const parentId = c.req.query('parentId') ?? null
  const form = await c.req.formData()
  const file = form.get('file') as File | null
  if (!file) return c.json({ error: 'File is required' }, 400)
  const hash = (form.get('hash') as string | null) || undefined
  const svc = createFileService(createFileRepository(c.env.DB), createStorageRepository(c.env.STORAGE))
  const buf = await file.arrayBuffer()
  const item = await svc.upload(file.name, parentId, file.type, buf, hash)
  const origin = new URL(c.req.url).origin
  c.executionCtx.waitUntil(invalidateShareCache(c.env.DB, origin, item.parentId))
  return c.json(item, 201)
})

files.get('/:id/download', async (c) => {
  const svc = createFileService(createFileRepository(c.env.DB), createStorageRepository(c.env.STORAGE))
  const item = await svc.get(c.req.param('id'))
  if (!item || item.type !== 'file' || !item.r2Key) return c.json({ error: 'Not found' }, 404)
  const storage = createStorageRepository(c.env.STORAGE)
  const obj = await storage.download(item.r2Key)
  if (!obj) return c.json({ error: 'File not found in storage' }, 404)
  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  headers.set('Content-Disposition', `attachment; filename="${item.name}"`)
  return new Response(obj.body, { headers })
})

files.patch('/:id', async (c) => {
  const body = await c.req.json<{ name?: string; parentId?: string | null }>()
  const fileRepo = createFileRepository(c.env.DB)
  const old = await fileRepo.findById(c.req.param('id'))
  const svc = createFileService(fileRepo, createStorageRepository(c.env.STORAGE))
  try {
    const item = await svc.update(c.req.param('id'), body)
    const origin = new URL(c.req.url).origin
    c.executionCtx.waitUntil(
      (async () => {
        await invalidateShareCache(c.env.DB, origin, old?.parentId ?? null)
        if (body.parentId !== undefined && body.parentId !== old?.parentId) {
          await invalidateShareCache(c.env.DB, origin, body.parentId ?? null)
        }
        await invalidateShareCacheByFileId(c.env.DB, origin, old?.id ?? null)
      })(),
    )
    return c.json(item)
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400)
  }
})

files.delete('/:id', async (c) => {
  const fileRepo = createFileRepository(c.env.DB)
  const file = await fileRepo.findById(c.req.param('id'))
  const svc = createFileService(fileRepo, createStorageRepository(c.env.STORAGE))
  await svc.trash(c.req.param('id'))
  const origin = new URL(c.req.url).origin
  c.executionCtx.waitUntil(
    (async () => {
      await invalidateShareCache(c.env.DB, origin, file?.parentId ?? null)
      await invalidateShareCacheByFileId(c.env.DB, origin, file?.id ?? null)
    })(),
  )
  return c.body(null, 204)
})

export default files
