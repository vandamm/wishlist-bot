import type { Context } from 'hono'
import type { Env } from '../types'
import { claimItem, unclaimItem } from '../db'
import { validateInitData } from '../auth'

async function getUser(c: Context<{ Bindings: Env }>) {
  const existing = c.get('user')
  if (existing) return existing
  const initData = c.req.header('X-Telegram-Init-Data') ?? ''
  const result = await validateInitData(initData, c.env.TELEGRAM_BOT_TOKEN)
  if (!result.valid || !result.user) return null
  c.set('user', result.user)
  return result.user
}

export async function handleClaim(c: Context<{ Bindings: Env }>) {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  if (String(user.id) === c.env.OWNER_TELEGRAM_ID) {
    return c.json({ error: 'Owner cannot claim gifts' }, 403)
  }

  const id = c.req.param('id') ?? ''
  const result = await claimItem(c.env.DB, id, user.id, user.username ?? null)

  if (result.conflict) {
    return c.json({ error: 'Кто-то успел раньше!' }, 409)
  }
  return c.json({ ok: true })
}

export async function handleUnclaim(c: Context<{ Bindings: Env }>) {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id') ?? ''
  const unclaimed = await unclaimItem(c.env.DB, id, user.id)
  if (!unclaimed) return c.json({ error: 'Not found or not your claim' }, 404)
  return c.json({ ok: true })
}
