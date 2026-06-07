import { Hono } from 'hono'
import type { Env } from '../types/env'

const shares = new Hono<{ Bindings: Env }>()

shares.get('/', async (c) => {
  return c.json([])
})

shares.post('/', async (c) => {
  return c.json({}, 201)
})

shares.delete('/:id', async (c) => {
  return c.body(null, 204)
})

export default shares
