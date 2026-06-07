import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from './types/env'

const app = new Hono<{ Bindings: Env }>()

app.use('/api/*', cors())

app.get('/api/health', (c) => {
  return c.json({ status: 'ok' })
})

export default app
