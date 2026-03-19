import { describe, it, expect, beforeEach, vi } from 'vitest'
import { env } from 'cloudflare:test'
import { Hono } from 'hono'
import { makeInitData } from './helpers/auth'
import { addItem } from '../src/db'
import { handleGetItems, handleAddItem, handleDeleteItem } from '../src/handlers/items'

const BOT_TOKEN = 'test-token'
const OWNER_USERNAME = 'testowner'

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, link TEXT,
    image_url TEXT, price_min REAL, price_max REAL, created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS claims (
    item_id TEXT PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
    telegram_user_id INTEGER NOT NULL, telegram_username TEXT, claimed_at INTEGER NOT NULL
  );
`

function makeApp() {
  type TestEnv = { DB: D1Database; TELEGRAM_BOT_TOKEN: string; TELEGRAM_OWNER_USERNAME: string }
  const app = new Hono<{ Bindings: TestEnv }>()
  app.use('*', async (c, next) => {
    c.env = { DB: env.DB, TELEGRAM_BOT_TOKEN: BOT_TOKEN, TELEGRAM_OWNER_USERNAME: OWNER_USERNAME }
    await next()
  })
  app.get('/api/items', handleGetItems)
  app.post('/api/items', handleAddItem)
  app.delete('/api/items/:id', handleDeleteItem)
  return app
}

async function authHeader(userId: number, username?: string): Promise<Record<string, string>> {
  return { 'X-Telegram-Init-Data': await makeInitData(BOT_TOKEN, { id: userId, username }) }
}

beforeEach(async () => {
  await env.DB.exec('DROP TABLE IF EXISTS claims; DROP TABLE IF EXISTS items;')
  await env.DB.exec(SCHEMA)
})

describe('GET /api/items as owner', () => {
  it('returns all items with is_owner true', async () => {
    await addItem(env.DB, { name: 'Gift A', link: null, image_url: null, price_min: null, price_max: null })
    const app = makeApp()
    const res = await app.request('/api/items', { headers: await authHeader(111, OWNER_USERNAME) })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.is_owner).toBe(true)
    expect(body.items).toHaveLength(1)
    expect(body.claimed_count).toBe(0)
  })
})

describe('GET /api/items as friend', () => {
  it('returns unclaimed items only with is_owner false', async () => {
    const app = makeApp()
    const res = await app.request('/api/items', { headers: await authHeader(999) })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.is_owner).toBe(false)
  })
})

describe('POST /api/items', () => {
  it('owner can add an item', async () => {
    const app = makeApp()
    const res = await app.request('/api/items', {
      method: 'POST',
      headers: { ...await authHeader(111, OWNER_USERNAME), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Gift', price: '50-100' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.name).toBe('New Gift')
    expect(body.price_min).toBe(50)
    expect(body.price_max).toBe(100)
  })

  it('friend cannot add an item', async () => {
    const app = makeApp()
    const res = await app.request('/api/items', {
      method: 'POST',
      headers: { ...await authHeader(999), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Sneaky Gift' }),
    })
    expect(res.status).toBe(403)
  })

  it('rejects missing name', async () => {
    const app = makeApp()
    const res = await app.request('/api/items', {
      method: 'POST',
      headers: { ...await authHeader(111, OWNER_USERNAME), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/items/:id', () => {
  it('owner can delete an item', async () => {
    const item = await addItem(env.DB, { name: 'X', link: null, image_url: null, price_min: null, price_max: null })
    const app = makeApp()
    const res = await app.request(`/api/items/${item.id}`, {
      method: 'DELETE',
      headers: await authHeader(111, OWNER_USERNAME),
    })
    expect(res.status).toBe(200)
  })
})
