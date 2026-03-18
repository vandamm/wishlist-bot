// src/index.ts
import { Hono } from 'hono'
import type { Env } from './types'
import './types' // ensures ContextVariableMap augmentation is applied
import { validateInitData } from './auth'
import { handleGetItems, handleAddItem, handleDeleteItem } from './handlers/items'
import { handleClaim, handleUnclaim } from './handlers/claims'
import { handleWebhook } from './handlers/webhook'
import { INDEX_HTML } from './frontend'

const app = new Hono<{ Bindings: Env }>()

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
  if (!initData) return c.json({ error: 'Unauthorized' }, 401)

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
