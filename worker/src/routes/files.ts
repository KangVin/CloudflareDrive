import { Hono } from 'hono'
import type { Env } from '../types/env'
import { createFileRepository } from '../repositories/fileRepository'
import { createStorageRepository } from '../repositories/storageRepository'
import { createFileService } from '../services/fileService'

const files = new Hono<{ Bindings: Env }>()

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
  return c.json(item, 201)
})

files.post('/:id/copy', async (c) => {
  const body = await c.req.json<{ parentId?: string | null }>()
  const svc = createFileService(createFileRepository(c.env.DB), createStorageRepository(c.env.STORAGE))
  const item = await svc.copy(c.req.param('id'), body.parentId ?? null)
  if (!item) return c.json({ error: 'Not found' }, 404)
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
  return c.json(item, 201)
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
  const svc = createFileService(createFileRepository(c.env.DB), createStorageRepository(c.env.STORAGE))
  try {
    const item = await svc.update(c.req.param('id'), body)
    return c.json(item)
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400)
  }
})

files.delete('/:id', async (c) => {
  const svc = createFileService(createFileRepository(c.env.DB), createStorageRepository(c.env.STORAGE))
  await svc.trash(c.req.param('id'))
  return c.body(null, 204)
})

export default files
