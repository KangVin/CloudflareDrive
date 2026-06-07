import { Hono } from 'hono'
import type { Env } from '../types/env'
import { createFileRepository } from '../repositories/fileRepository'
import { createStorageRepository } from '../repositories/storageRepository'
import { createShareRepository } from '../repositories/shareRepository'
import { createFileService } from '../services/fileService'

const trash = new Hono<{ Bindings: Env }>()

trash.get('/', async (c) => {
  const svc = createFileService(createFileRepository(c.env.DB), createStorageRepository(c.env.STORAGE))
  const items = await svc.listTrashed()
  return c.json(items)
})

trash.post('/empty', async (c) => {
  const svc = createFileService(
    createFileRepository(c.env.DB),
    createStorageRepository(c.env.STORAGE),
    createShareRepository(c.env.DB),
  )
  await svc.emptyTrash()
  return c.body(null, 204)
})

trash.post('/:id/restore', async (c) => {
  const svc = createFileService(createFileRepository(c.env.DB), createStorageRepository(c.env.STORAGE))
  await svc.restore(c.req.param('id'))
  return c.body(null, 204)
})

trash.delete('/:id', async (c) => {
  const svc = createFileService(
    createFileRepository(c.env.DB),
    createStorageRepository(c.env.STORAGE),
    createShareRepository(c.env.DB),
  )
  await svc.permanentDelete(c.req.param('id'))
  return c.body(null, 204)
})

export default trash
