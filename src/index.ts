// src/index.ts
import { Hono } from 'hono'
import type { Env } from './types'

export type { Env }
import { validateInitData } from './auth'
import { handleGetItems, handleAddItem, handleDeleteItem } from './handlers/items'
import { handleClaim, handleUnclaim } from './handlers/claims'
import { handleWebhook } from './handlers/webhook'
import { INDEX_HTML } from './frontend'

const app = new Hono<{ Bindings: Env }>()

// Request logging middleware
app.use('*', async (c, next) => {
  const start = Date.now()
  const method = c.req.method
  const path = c.req.path
  console.info(`[req] ${method} ${path}`)
  await next()
  const ms = Date.now() - start
  console.info(`[res] ${method} ${path} → ${c.res.status} (${ms}ms)`)
})

// Serve the Mini App frontend
app.get('/', (c) => c.html(INDEX_HTML))

// Telegram bot webhook (no auth needed — Telegram calls this)
app.post('/webhook', async (c) => {
  const appUrl = new URL(c.req.url).origin
  return handleWebhook(c.req.raw, c.env.TELEGRAM_BOT_TOKEN, appUrl)
})

// Auth middleware — validates initData for all /api/* routes
app.use('/api/*', async (c, next) => {
  const initData = c.req.header('X-Telegram-Init-Data')
  if (!initData) {
    console.warn('[middleware] no X-Telegram-Init-Data header')
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const result = await validateInitData(initData, c.env.TELEGRAM_BOT_TOKEN)
  if (!result.valid || !result.user) return c.json({ error: 'Unauthorized' }, 401)

  c.set('user', result.user)
  await next()
})

app.get('/api/items', handleGetItems)
app.post('/api/items', handleAddItem)
app.delete('/api/items/:id', handleDeleteItem)
app.post('/api/items/:id/claim', handleClaim)
app.delete('/api/items/:id/claim', handleUnclaim)

export default app
