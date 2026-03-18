import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:test'
import { Hono } from 'hono'
import { makeInitData } from './helpers/auth'
import { addItem } from '../src/db'
import { handleClaim, handleUnclaim } from '../src/handlers/claims'

const BOT_TOKEN = 'test-token'
const OWNER_ID = '111'
const FRIEND_ID = 999

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
  type TestEnv = { DB: D1Database; TELEGRAM_BOT_TOKEN: string; OWNER_TELEGRAM_ID: string }
  const app = new Hono<{ Bindings: TestEnv }>()
  app.use('*', async (c, next) => {
    c.env = { DB: env.DB, TELEGRAM_BOT_TOKEN: BOT_TOKEN, OWNER_TELEGRAM_ID: OWNER_ID }
    await next()
  })
  app.post('/api/items/:id/claim', handleClaim)
  app.delete('/api/items/:id/claim', handleUnclaim)
  return app
}

async function authHeader(userId: number) {
  return { 'X-Telegram-Init-Data': await makeInitData(BOT_TOKEN, { id: userId }) }
}

beforeEach(async () => {
  await env.DB.exec('DROP TABLE IF EXISTS claims; DROP TABLE IF EXISTS items;')
  await env.DB.exec(SCHEMA)
})

describe('POST /api/items/:id/claim', () => {
  it('friend can claim an item', async () => {
    const item = await addItem(env.DB, { name: 'Gift', link: null, image_url: null, price_min: null, price_max: null })
    const app = makeApp()
    const res = await app.request(`/api/items/${item.id}/claim`, {
      method: 'POST',
      headers: await authHeader(FRIEND_ID),
    })
    expect(res.status).toBe(200)
  })

  it('returns 409 when already claimed by another', async () => {
    const item = await addItem(env.DB, { name: 'Gift', link: null, image_url: null, price_min: null, price_max: null })
    const app = makeApp()
    await app.request(`/api/items/${item.id}/claim`, { method: 'POST', headers: await authHeader(FRIEND_ID) })
    const res = await app.request(`/api/items/${item.id}/claim`, { method: 'POST', headers: await authHeader(888) })
    expect(res.status).toBe(409)
  })

  it('owner cannot claim', async () => {
    const item = await addItem(env.DB, { name: 'Gift', link: null, image_url: null, price_min: null, price_max: null })
    const app = makeApp()
    const res = await app.request(`/api/items/${item.id}/claim`, {
      method: 'POST',
      headers: await authHeader(parseInt(OWNER_ID)),
    })
    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/items/:id/claim', () => {
  it('friend can unclaim their own claim', async () => {
    const item = await addItem(env.DB, { name: 'Gift', link: null, image_url: null, price_min: null, price_max: null })
    const app = makeApp()
    await app.request(`/api/items/${item.id}/claim`, { method: 'POST', headers: await authHeader(FRIEND_ID) })
    const res = await app.request(`/api/items/${item.id}/claim`, {
      method: 'DELETE',
      headers: await authHeader(FRIEND_ID),
    })
    expect(res.status).toBe(200)
  })

  it('cannot unclaim someone else\'s claim', async () => {
    const item = await addItem(env.DB, { name: 'Gift', link: null, image_url: null, price_min: null, price_max: null })
    const app = makeApp()
    await app.request(`/api/items/${item.id}/claim`, { method: 'POST', headers: await authHeader(FRIEND_ID) })
    const res = await app.request(`/api/items/${item.id}/claim`, {
      method: 'DELETE',
      headers: await authHeader(888),
    })
    expect(res.status).toBe(404)
  })
})
