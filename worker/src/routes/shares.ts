import { Hono } from 'hono'
import type { Env } from '../types/env'
import { createFileRepository } from '../repositories/fileRepository'
import { createShareRepository } from '../repositories/shareRepository'
import { createShareService } from '../services/shareService'

const shares = new Hono<{ Bindings: Env }>()

shares.get('/', async (c) => {
  const svc = createShareService(createShareRepository(c.env.DB), createFileRepository(c.env.DB))
  const items = await svc.list()
  return c.json(items)
})

shares.post('/', async (c) => {
  const body = await c.req.json<{ fileId: string; expiresAt?: string | null }>()
  if (!body.fileId) return c.json({ error: 'fileId is required' }, 400)
  const svc = createShareService(createShareRepository(c.env.DB), createFileRepository(c.env.DB))
  try {
    const item = await svc.create(body.fileId, body.expiresAt ?? null)
    return c.json(item, 201)
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400)
  }
})

shares.delete('/:id', async (c) => {
  const svc = createShareService(createShareRepository(c.env.DB), createFileRepository(c.env.DB))
  await svc.revoke(c.req.param('id'))
  return c.body(null, 204)
})

export default shares
