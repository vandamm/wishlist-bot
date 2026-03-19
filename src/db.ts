import { nanoid } from 'nanoid'

export interface Item {
  id: string
  name: string
  link: string | null
  image_url: string | null
  price_min: number | null
  price_max: number | null
  created_at: number
}

export interface ItemWithClaim extends Item {
  is_claimed: boolean
  claimer_id?: number
}

export async function getAllItems(db: D1Database): Promise<ItemWithClaim[]> {
  const { results } = await db.prepare(`
    SELECT i.*, c.telegram_user_id AS claimer_id
    FROM items i
    LEFT JOIN claims c ON i.id = c.item_id
    ORDER BY i.created_at ASC
  `).all<Item & { claimer_id: number | null }>()

  return results.map(row => ({
    ...row,
    is_claimed: row.claimer_id !== null,
    claimer_id: row.claimer_id ?? undefined,
  }))
}

export interface FriendItem extends Item {
  is_mine: boolean
}

export async function getItemsForFriend(db: D1Database, telegramUserId: number): Promise<FriendItem[]> {
  const { results } = await db.prepare(`
    SELECT i.*, c.telegram_user_id AS claimer_id
    FROM items i
    LEFT JOIN claims c ON i.id = c.item_id
    WHERE c.item_id IS NULL OR c.telegram_user_id = ?
    ORDER BY i.created_at ASC
  `).bind(telegramUserId).all<Item & { claimer_id: number | null }>()
  return results.map(({ claimer_id, ...item }) => ({
    ...item,
    is_mine: claimer_id === telegramUserId,
  }))
}

export async function getClaimedCount(db: D1Database): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) AS count FROM claims`).first<{ count: number }>()
  return row?.count ?? 0
}

export async function addItem(
  db: D1Database,
  item: Omit<Item, 'id' | 'created_at'>
): Promise<Item> {
  const id = nanoid(10)
  const created_at = Math.floor(Date.now() / 1000)
  await db.prepare(`
    INSERT INTO items (id, name, link, image_url, price_min, price_max, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, item.name, item.link, item.image_url, item.price_min, item.price_max, created_at).run()
  return { id, created_at, ...item }
}

export async function deleteItem(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare(`DELETE FROM items WHERE id = ?`).bind(id).run()
  return (result.meta.changes ?? 0) > 0
}

export async function updateItemImage(db: D1Database, id: string, image_url: string): Promise<void> {
  await db.prepare(`UPDATE items SET image_url = ? WHERE id = ?`).bind(image_url, id).run()
}

export async function claimItem(
  db: D1Database,
  item_id: string,
  telegram_user_id: number,
  telegram_username: string | null
): Promise<{ success: boolean; conflict: boolean }> {
  const claimed_at = Math.floor(Date.now() / 1000)
  try {
    await db.prepare(`
      INSERT INTO claims (item_id, telegram_user_id, telegram_username, claimed_at)
      VALUES (?, ?, ?, ?)
    `).bind(item_id, telegram_user_id, telegram_username, claimed_at).run()
    return { success: true, conflict: false }
  } catch {
    return { success: false, conflict: true }
  }
}

export async function unclaimItem(
  db: D1Database,
  item_id: string,
  telegram_user_id: number
): Promise<boolean> {
  const result = await db.prepare(`
    DELETE FROM claims WHERE item_id = ? AND telegram_user_id = ?
  `).bind(item_id, telegram_user_id).run()
  return (result.meta.changes ?? 0) > 0
}
