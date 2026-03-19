import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:test'
import {
  getAllItems, getItemsForFriend, getClaimedCount,
  addItem, deleteItem, updateItemImage,
  claimItem, unclaimItem,
} from '../src/db'

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

beforeEach(async () => {
  await env.DB.exec('DROP TABLE IF EXISTS claims; DROP TABLE IF EXISTS items;')
  await env.DB.exec(SCHEMA)
})

describe('addItem / getAllItems', () => {
  it('adds an item and retrieves it', async () => {
    await addItem(env.DB, { name: 'Test Gift', link: null, image_url: null, price_min: 50, price_max: 50 })
    const items = await getAllItems(env.DB)
    expect(items).toHaveLength(1)
    expect(items[0].name).toBe('Test Gift')
    expect(items[0].price_min).toBe(50)
    expect(items[0].is_claimed).toBe(false)
  })
})

describe('deleteItem', () => {
  it('deletes an existing item', async () => {
    const item = await addItem(env.DB, { name: 'Gift', link: null, image_url: null, price_min: null, price_max: null })
    const result = await deleteItem(env.DB, item.id)
    expect(result).toBe(true)
    expect(await getAllItems(env.DB)).toHaveLength(0)
  })

  it('returns false for non-existent item', async () => {
    expect(await deleteItem(env.DB, 'nope')).toBe(false)
  })
})

describe('claimItem', () => {
  it('claims an unclaimed item', async () => {
    const item = await addItem(env.DB, { name: 'Gift', link: null, image_url: null, price_min: null, price_max: null })
    const result = await claimItem(env.DB, item.id, 999, 'bob')
    expect(result).toEqual({ success: true, conflict: false })
    expect(await getClaimedCount(env.DB)).toBe(1)
  })

  it('returns conflict when already claimed', async () => {
    const item = await addItem(env.DB, { name: 'Gift', link: null, image_url: null, price_min: null, price_max: null })
    await claimItem(env.DB, item.id, 999, 'bob')
    const result = await claimItem(env.DB, item.id, 888, 'alice')
    expect(result).toEqual({ success: false, conflict: true })
  })
})

describe('unclaimItem', () => {
  it('unclaims own claim', async () => {
    const item = await addItem(env.DB, { name: 'Gift', link: null, image_url: null, price_min: null, price_max: null })
    await claimItem(env.DB, item.id, 999, 'bob')
    expect(await unclaimItem(env.DB, item.id, 999)).toBe(true)
    expect(await getClaimedCount(env.DB)).toBe(0)
  })

  it('cannot unclaim someone else\'s claim', async () => {
    const item = await addItem(env.DB, { name: 'Gift', link: null, image_url: null, price_min: null, price_max: null })
    await claimItem(env.DB, item.id, 999, 'bob')
    expect(await unclaimItem(env.DB, item.id, 888)).toBe(false)
  })
})

describe('getItemsForFriend', () => {
  it('returns unclaimed items plus items claimed by the friend', async () => {
    const a = await addItem(env.DB, { name: 'A', link: null, image_url: null, price_min: null, price_max: null })
    const b = await addItem(env.DB, { name: 'B', link: null, image_url: null, price_min: null, price_max: null })
    const c = await addItem(env.DB, { name: 'C', link: null, image_url: null, price_min: null, price_max: null })
    await claimItem(env.DB, a.id, 999, 'bob')
    await claimItem(env.DB, c.id, 888, 'alice')

    const items = await getItemsForFriend(env.DB, 999)
    expect(items).toHaveLength(2)
    expect(items.map(i => i.name).sort()).toEqual(['A', 'B'])
    expect(items.find(i => i.name === 'A')!.is_mine).toBe(true)
    expect(items.find(i => i.name === 'B')!.is_mine).toBe(false)
  })
})
