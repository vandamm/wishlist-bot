import type { Context } from 'hono'
import type { Env } from '../types'
import {
  getAllItems, getItemsForFriend, getClaimedCount,
  addItem, deleteItem, updateItemImage, updateItemEmoji,
} from '../db'
import { parsePrice } from '../price'
import { fetchOgImage } from '../ogimage'
import { validateInitData } from '../auth'

async function getUser(c: Context<{ Bindings: Env }>) {
  // Check if user was already set by middleware
  try {
    const existing = c.get('user')
    if (existing) return existing
  } catch {
    // not set
  }

  const initData = c.req.header('X-Telegram-Init-Data') ?? ''
  const result = await validateInitData(initData, c.env.TELEGRAM_BOT_TOKEN)
  if (!result.valid || !result.user) return null
  c.set('user', result.user)
  return result.user
}

export async function handleGetItems(c: Context<{ Bindings: Env }>) {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const isOwner = user.username?.toLowerCase() === c.env.TELEGRAM_OWNER_USERNAME?.toLowerCase()
  console.info('[items] getItems by user:', user.id, isOwner ? '(owner)' : '(friend)')

  try {
    const claimed_count = await getClaimedCount(c.env.DB)

    if (isOwner) {
      const items = (await getAllItems(c.env.DB)).map(({ claimer_id: _c, ...item }) => item)
      return c.json({ is_owner: true, claimed_count, items })
    }

    const items = await getItemsForFriend(c.env.DB, user.id)
    return c.json({ is_owner: false, claimed_count, items })
  } catch (err) {
    console.error('[items] DB error in getItems:', err)
    return c.json({ error: 'Internal error' }, 500)
  }
}

export async function handleAddItem(c: Context<{ Bindings: Env }>) {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  if (user.username?.toLowerCase() !== c.env.TELEGRAM_OWNER_USERNAME?.toLowerCase()) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const body = await c.req.json<{ name?: string; link?: string; price?: string }>()
  if (!body.name?.trim()) {
    return c.json({ error: 'name is required' }, 400)
  }

  const priceStr = body.price?.trim() ?? ''
  const parsed = priceStr ? parsePrice(priceStr) : null
  if (priceStr && !parsed) {
    return c.json({ error: 'invalid price format, use "50" or "50-100"' }, 400)
  }

  const linkStr = body.link?.trim() || null
  if (linkStr) {
    try {
      const url = new URL(linkStr)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return c.json({ error: 'link must be an http or https URL' }, 400)
      }
    } catch {
      return c.json({ error: 'link must be a valid URL' }, 400)
    }
  }

  console.info('[items] addItem:', body.name, 'by user:', user.id)
  const item = await addItem(c.env.DB, {
    name: body.name.trim(),
    link: linkStr,
    image_url: null,
    emoji: null,
    price_min: parsed?.min ?? null,
    price_max: parsed?.max ?? null,
  })

  if (item.link) {
    try {
      c.executionCtx.waitUntil(
        fetchOgImage(item.link).then(imageUrl => {
          if (imageUrl) return updateItemImage(c.env.DB, item.id, imageUrl)
        })
      )
    } catch {
      // executionCtx may not be available in test environment
    }
  }

  return c.json(item, 201)
}

export async function handleDeleteItem(c: Context<{ Bindings: Env }>) {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  if (user.username?.toLowerCase() !== c.env.TELEGRAM_OWNER_USERNAME?.toLowerCase()) {
    return c.json({ error: 'Forbidden' }, 403)
  }
  const id = c.req.param('id') ?? ''
  const deleted = await deleteItem(c.env.DB, id)
  if (!deleted) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
}

export async function handleUpdateEmoji(c: Context<{ Bindings: Env }>) {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  if (user.username?.toLowerCase() !== c.env.TELEGRAM_OWNER_USERNAME?.toLowerCase()) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const id = c.req.param('id') ?? ''
  const body = await c.req.json<{ emoji?: string }>()
  const emoji = body.emoji?.trim()
  if (!emoji) return c.json({ error: 'emoji is required' }, 400)

  const updated = await updateItemEmoji(c.env.DB, id, emoji)
  if (!updated) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
}
