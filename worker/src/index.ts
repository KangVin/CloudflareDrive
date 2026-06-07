import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from './types/env'
import files from './routes/files'
import trash from './routes/trash'
import shares from './routes/shares'

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

app.get('/api/v1/s/:token', (c) => {
  return c.json({ error: 'Not found' }, 404)
})

export default app
