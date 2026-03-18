# Wishlist Telegram Mini App — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers-extended-cc:subagent-driven-development (if subagents available) or superpowers-extended-cc:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Telegram Mini App wishlist where the owner adds gifts and friends claim them, deployed to Cloudflare Workers with D1 storage.

**Architecture:** A single Cloudflare Worker handles all traffic: serves the Mini App HTML at `/`, processes the Telegram bot webhook at `/webhook`, and exposes a REST API at `/api/*`. Hono is used for routing. All API requests carry a `X-Telegram-Init-Data` header validated via HMAC-SHA256 to establish identity. D1 (SQLite) stores items and claims.

**Tech Stack:** TypeScript, Cloudflare Workers, Cloudflare D1, Hono, Telegram Bot API, Telegram Mini App SDK, Vitest + @cloudflare/vitest-pool-workers, Wrangler

---

## File Structure

```
wishlist-bot/
├── src/
│   ├── index.ts              # Worker entry: Hono app + route wiring
│   ├── types.ts              # Shared Env interface and Hono context types
│   ├── auth.ts               # initData HMAC validation, TelegramUser extraction
│   ├── price.ts              # Price string parsing ("50" or "50-100")
│   ├── ogimage.ts            # og:image URL extraction from a webpage
│   ├── db.ts                 # All D1 query functions
│   ├── frontend.ts           # Exports INDEX_HTML string (complete Mini App)
│   └── handlers/
│       ├── items.ts          # GET/POST/DELETE /api/items
│       ├── claims.ts         # POST/DELETE /api/items/:id/claim
│       └── webhook.ts        # POST /webhook (Telegram /start command)
├── test/
│   ├── helpers/
│   │   └── auth.ts           # makeInitData() helper for tests
│   ├── price.test.ts
│   ├── auth.test.ts
│   ├── ogimage.test.ts
│   ├── db.test.ts
│   ├── items.test.ts
│   └── claims.test.ts
├── migrations/
│   └── 0001_initial.sql      # D1 schema
├── wrangler.toml
├── vitest.config.ts
├── tsconfig.json
└── package.json
```

---

### Task 0: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `wrangler.toml`
- Create: `vitest.config.ts`

- [ ] **Step 1: Initialize the project**

```bash
cd /Users/vandamm/Development/wishlist-bot
npm init -y
npm install hono nanoid
npm install -D typescript wrangler @cloudflare/workers-types @cloudflare/vitest-pool-workers vitest
```

- [ ] **Step 2: Write `package.json` scripts**

```json
{
  "name": "wishlist-bot",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "hono": "^4.0.0",
    "nanoid": "^5.0.0"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.5.0",
    "@cloudflare/workers-types": "^4.0.0",
    "typescript": "^5.0.0",
    "vitest": "^2.0.0",
    "wrangler": "^3.0.0"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noEmit": true
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 4: Write `wrangler.toml`**

```toml
name = "wishlist-bot"
main = "src/index.ts"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "wishlist"
database_id = "placeholder-replace-after-create"

# Secrets (set with `wrangler secret put`):
# TELEGRAM_BOT_TOKEN
# OWNER_TELEGRAM_ID
```

- [ ] **Step 5: Write `vitest.config.ts`**

```typescript
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
      },
    },
  },
})
```

- [ ] **Step 6: Create directory structure and shared types**

```bash
mkdir -p src/handlers test/helpers migrations
```

Write `src/types.ts` immediately so all handler files can import `Env` without circular dependencies:

```typescript
// src/types.ts
import type { TelegramUser } from './auth'

export interface Env {
  DB: D1Database
  TELEGRAM_BOT_TOKEN: string
  OWNER_TELEGRAM_ID: string
}

// Extend Hono context to carry the authenticated user
declare module 'hono' {
  interface ContextVariableMap {
    user: TelegramUser
  }
}
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors (no source files yet, just config check)

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json wrangler.toml vitest.config.ts
git commit -m "chore: scaffold TypeScript Cloudflare Worker project"
```

---

### Task 1: Database Schema

**Files:**
- Create: `migrations/0001_initial.sql`

- [ ] **Step 1: Write the migration**

```sql
-- migrations/0001_initial.sql
CREATE TABLE IF NOT EXISTS items (
  id         TEXT    PRIMARY KEY,
  name       TEXT    NOT NULL,
  link       TEXT,
  image_url  TEXT,
  price_min  REAL,
  price_max  REAL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS claims (
  item_id            TEXT    PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
  telegram_user_id   INTEGER NOT NULL,
  telegram_username  TEXT,
  claimed_at         INTEGER NOT NULL
);
```

- [ ] **Step 2: Create D1 database (requires Cloudflare account login)**

```bash
npx wrangler login
npx wrangler d1 create wishlist
```

Copy the `database_id` from the output and replace `placeholder-replace-after-create` in `wrangler.toml`.

- [ ] **Step 3: Apply migration to local dev DB**

```bash
npx wrangler d1 execute wishlist --local --file=migrations/0001_initial.sql
```

Expected: `Successfully executed 2 statements`

- [ ] **Step 4: Apply migration to production DB**

```bash
npx wrangler d1 execute wishlist --remote --file=migrations/0001_initial.sql
```

- [ ] **Step 5: Commit**

```bash
git add migrations/0001_initial.sql wrangler.toml
git commit -m "feat: add D1 schema migration"
```

---

### Task 2: Price Parsing

**Files:**
- Create: `src/price.ts`
- Create: `test/price.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// test/price.test.ts
import { describe, it, expect } from 'vitest'
import { parsePrice, formatPrice } from '../src/price'

describe('parsePrice', () => {
  it('parses fixed price', () => {
    expect(parsePrice('50')).toEqual({ min: 50, max: 50 })
  })
  it('parses fixed decimal price', () => {
    expect(parsePrice('49.99')).toEqual({ min: 49.99, max: 49.99 })
  })
  it('parses range with hyphen', () => {
    expect(parsePrice('50-100')).toEqual({ min: 50, max: 100 })
  })
  it('parses range with en-dash', () => {
    expect(parsePrice('50–100')).toEqual({ min: 50, max: 100 })
  })
  it('parses range with spaces', () => {
    expect(parsePrice('50 - 100')).toEqual({ min: 50, max: 100 })
  })
  it('returns null for empty string', () => {
    expect(parsePrice('')).toBeNull()
  })
  it('returns null for whitespace', () => {
    expect(parsePrice('  ')).toBeNull()
  })
  it('returns null for non-numeric input', () => {
    expect(parsePrice('abc')).toBeNull()
  })
  it('returns null when min > max', () => {
    expect(parsePrice('100-50')).toBeNull()
  })
})

describe('formatPrice', () => {
  it('formats null as empty string', () => {
    expect(formatPrice(null, null)).toBe('')
  })
  it('formats fixed price', () => {
    expect(formatPrice(50, 50)).toBe('50€')
  })
  it('formats range', () => {
    expect(formatPrice(50, 100)).toBe('50–100€')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- test/price.test.ts
```

Expected: FAIL — `Cannot find module '../src/price'`

- [ ] **Step 3: Implement `src/price.ts`**

```typescript
// src/price.ts
export interface ParsedPrice {
  min: number
  max: number
}

export function parsePrice(input: string): ParsedPrice | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // Range: "50-100" or "50–100" (en-dash), with optional spaces
  const rangeMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/)
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1])
    const max = parseFloat(rangeMatch[2])
    if (min > max) return null
    return { min, max }
  }

  // Fixed price: "50" or "49.99"
  const fixedMatch = trimmed.match(/^(\d+(?:\.\d+)?)$/)
  if (fixedMatch) {
    const val = parseFloat(fixedMatch[1])
    return { min: val, max: val }
  }

  return null
}

export function formatPrice(min: number | null, max: number | null): string {
  if (min === null) return ''
  if (min === max) return `${min}€`
  return `${min}–${max}€`
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- test/price.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/price.ts test/price.test.ts
git commit -m "feat: add price string parsing"
```

---

### Task 3: Auth Module

**Files:**
- Create: `src/auth.ts`
- Create: `test/helpers/auth.ts`
- Create: `test/auth.test.ts`

- [ ] **Step 1: Write the test helper that builds valid initData**

```typescript
// test/helpers/auth.ts
export interface FakeUser {
  id: number
  username?: string
  first_name?: string
}

export async function makeInitData(botToken: string, user: FakeUser): Promise<string> {
  const authDate = Math.floor(Date.now() / 1000).toString()
  const params = new URLSearchParams({
    user: JSON.stringify(user),
    auth_date: authDate,
  })

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode('WebAppData'),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const secretKey = await crypto.subtle.sign('HMAC', keyMaterial, encoder.encode(botToken))
  const hmacKey = await crypto.subtle.importKey(
    'raw', secretKey,
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', hmacKey, encoder.encode(dataCheckString))
  const hash = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  params.set('hash', hash)
  return params.toString()
}
```

- [ ] **Step 2: Write the failing tests**

```typescript
// test/auth.test.ts
import { describe, it, expect } from 'vitest'
import { validateInitData } from '../src/auth'
import { makeInitData } from './helpers/auth'

const BOT_TOKEN = 'test-bot-token-123'

describe('validateInitData', () => {
  it('validates correct initData', async () => {
    const initData = await makeInitData(BOT_TOKEN, { id: 12345, username: 'alice' })
    const result = await validateInitData(initData, BOT_TOKEN)
    expect(result.valid).toBe(true)
    expect(result.user?.id).toBe(12345)
    expect(result.user?.username).toBe('alice')
  })

  it('rejects tampered hash', async () => {
    const initData = await makeInitData(BOT_TOKEN, { id: 12345 })
    const tampered = initData.replace(/hash=[^&]+/, 'hash=deadbeef')
    const result = await validateInitData(tampered, BOT_TOKEN)
    expect(result.valid).toBe(false)
  })

  it('rejects wrong bot token', async () => {
    const initData = await makeInitData(BOT_TOKEN, { id: 12345 })
    const result = await validateInitData(initData, 'wrong-token')
    expect(result.valid).toBe(false)
  })

  it('rejects missing hash', async () => {
    const result = await validateInitData('user=%7B%22id%22%3A1%7D&auth_date=1234567890', BOT_TOKEN)
    expect(result.valid).toBe(false)
  })

  it('rejects empty string', async () => {
    const result = await validateInitData('', BOT_TOKEN)
    expect(result.valid).toBe(false)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test -- test/auth.test.ts
```

Expected: FAIL — `Cannot find module '../src/auth'`

- [ ] **Step 4: Implement `src/auth.ts`**

```typescript
// src/auth.ts
export interface TelegramUser {
  id: number
  username?: string
  first_name?: string
}

export interface AuthResult {
  valid: boolean
  user?: TelegramUser
}

export async function validateInitData(
  initData: string,
  botToken: string
): Promise<AuthResult> {
  if (!initData) return { valid: false }

  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return { valid: false }

  params.delete('hash')
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode('WebAppData'),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const secretKey = await crypto.subtle.sign('HMAC', keyMaterial, encoder.encode(botToken))
  const hmacKey = await crypto.subtle.importKey(
    'raw', secretKey,
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', hmacKey, encoder.encode(dataCheckString))
  const expectedHash = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  if (expectedHash !== hash) return { valid: false }

  const userStr = params.get('user')
  if (!userStr) return { valid: false }

  try {
    const user = JSON.parse(userStr) as TelegramUser
    return { valid: true, user }
  } catch {
    return { valid: false }
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- test/auth.test.ts
```

Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/auth.ts test/auth.test.ts test/helpers/auth.ts
git commit -m "feat: add Telegram initData HMAC validation"
```

---

### Task 4: og:image Fetcher

**Files:**
- Create: `src/ogimage.ts`
- Create: `test/ogimage.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// test/ogimage.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchOgImage } from '../src/ogimage'

afterEach(() => vi.restoreAllMocks())

describe('fetchOgImage', () => {
  it('extracts og:image from HTML', async () => {
    vi.stubGlobal('fetch', async () => new Response(
      `<html><head><meta property="og:image" content="https://example.com/img.jpg"></head></html>`,
      { status: 200 }
    ))
    expect(await fetchOgImage('https://example.com')).toBe('https://example.com/img.jpg')
  })

  it('extracts og:image with reversed attribute order', async () => {
    vi.stubGlobal('fetch', async () => new Response(
      `<html><head><meta content="https://example.com/img.jpg" property="og:image"></head></html>`,
      { status: 200 }
    ))
    expect(await fetchOgImage('https://example.com')).toBe('https://example.com/img.jpg')
  })

  it('returns null when no og:image present', async () => {
    vi.stubGlobal('fetch', async () => new Response('<html><head></head></html>', { status: 200 }))
    expect(await fetchOgImage('https://example.com')).toBeNull()
  })

  it('returns null for relative image URLs', async () => {
    vi.stubGlobal('fetch', async () => new Response(
      `<html><head><meta property="og:image" content="/images/photo.jpg"></head></html>`,
      { status: 200 }
    ))
    expect(await fetchOgImage('https://example.com')).toBeNull()
  })

  it('returns null on HTTP error', async () => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 404 }))
    expect(await fetchOgImage('https://example.com')).toBeNull()
  })

  it('returns null on fetch exception', async () => {
    vi.stubGlobal('fetch', async () => { throw new Error('network error') })
    expect(await fetchOgImage('https://example.com')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- test/ogimage.test.ts
```

Expected: FAIL — `Cannot find module '../src/ogimage'`

- [ ] **Step 3: Implement `src/ogimage.ts`**

```typescript
// src/ogimage.ts
export async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WishlistBot/1.0)' },
      redirect: 'follow',
    })
    if (!response.ok) return null

    const html = await response.text()

    // Match both attribute orders: property="og:image" content="..." and content="..." property="og:image"
    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)

    if (!match) return null

    // Only store absolute URLs — relative paths can't be resolved without the base URL
    try {
      new URL(match[1])
      return match[1]
    } catch {
      return null
    }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- test/ogimage.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/ogimage.ts test/ogimage.test.ts
git commit -m "feat: add og:image URL extractor"
```

---

### Task 5: Database Access Layer

**Files:**
- Create: `src/db.ts`
- Create: `test/db.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// test/db.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:test'
import {
  getAllItems, getUnclaimedItems, getClaimedCount,
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

describe('getUnclaimedItems', () => {
  it('only returns unclaimed items', async () => {
    const a = await addItem(env.DB, { name: 'A', link: null, image_url: null, price_min: null, price_max: null })
    await addItem(env.DB, { name: 'B', link: null, image_url: null, price_min: null, price_max: null })
    await claimItem(env.DB, a.id, 999, 'bob')
    const unclaimed = await getUnclaimedItems(env.DB)
    expect(unclaimed).toHaveLength(1)
    expect(unclaimed[0].name).toBe('B')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- test/db.test.ts
```

Expected: FAIL — `Cannot find module '../src/db'`

- [ ] **Step 3: Implement `src/db.ts`**

```typescript
// src/db.ts
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

export async function getUnclaimedItems(db: D1Database): Promise<Item[]> {
  const { results } = await db.prepare(`
    SELECT i.*
    FROM items i
    LEFT JOIN claims c ON i.id = c.item_id
    WHERE c.item_id IS NULL
    ORDER BY i.created_at ASC
  `).all<Item>()
  return results
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- test/db.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/db.ts test/db.test.ts
git commit -m "feat: add D1 database access layer"
```

---

### Task 6: Items API Handlers

**Files:**
- Create: `src/handlers/items.ts`
- Create: `test/items.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// test/items.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { env } from 'cloudflare:test'
import { Hono } from 'hono'
import { makeInitData } from './helpers/auth'
import { addItem } from '../src/db'
import { handleGetItems, handleAddItem, handleDeleteItem } from '../src/handlers/items'

const BOT_TOKEN = 'test-token'
const OWNER_ID = '111'

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
  const app = new Hono<{ Bindings: typeof env & { TELEGRAM_BOT_TOKEN: string; OWNER_TELEGRAM_ID: string } }>()
  app.use('*', async (c, next) => {
    // Inject test env
    Object.assign(c.env, { DB: env.DB, TELEGRAM_BOT_TOKEN: BOT_TOKEN, OWNER_TELEGRAM_ID: OWNER_ID })
    await next()
  })
  app.get('/api/items', handleGetItems)
  app.post('/api/items', handleAddItem)
  app.delete('/api/items/:id', handleDeleteItem)
  return app
}

async function authHeader(userId: number): Promise<Record<string, string>> {
  return { 'X-Telegram-Init-Data': await makeInitData(BOT_TOKEN, { id: userId }) }
}

beforeEach(async () => {
  await env.DB.exec('DROP TABLE IF EXISTS claims; DROP TABLE IF EXISTS items;')
  await env.DB.exec(SCHEMA)
})

describe('GET /api/items as owner', () => {
  it('returns all items with is_owner true', async () => {
    await addItem(env.DB, { name: 'Gift A', link: null, image_url: null, price_min: null, price_max: null })
    const app = makeApp()
    const res = await app.request('/api/items', { headers: await authHeader(parseInt(OWNER_ID)) })
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
      headers: { ...await authHeader(parseInt(OWNER_ID)), 'Content-Type': 'application/json' },
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
      headers: { ...await authHeader(parseInt(OWNER_ID)), 'Content-Type': 'application/json' },
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
      headers: await authHeader(parseInt(OWNER_ID)),
    })
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- test/items.test.ts
```

Expected: FAIL — `Cannot find module '../src/handlers/items'`

- [ ] **Step 3: Implement `src/handlers/items.ts`**

```typescript
// src/handlers/items.ts
import type { Context } from 'hono'
import type { Env } from '../types'
import {
  getAllItems, getUnclaimedItems, getClaimedCount,
  addItem, deleteItem, updateItemImage,
} from '../db'
import { parsePrice } from '../price'
import { fetchOgImage } from '../ogimage'

export async function handleGetItems(c: Context<{ Bindings: Env }>) {
  const user = c.get('user')
  const isOwner = String(user.id) === c.env.OWNER_TELEGRAM_ID

  const [items, claimed_count] = await Promise.all([
    isOwner ? getAllItems(c.env.DB) : getUnclaimedItems(c.env.DB),
    getClaimedCount(c.env.DB),
  ])
  return c.json({ is_owner: isOwner, claimed_count, items })
}

export async function handleAddItem(c: Context<{ Bindings: Env }>) {
  const user = c.get('user')
  if (String(user.id) !== c.env.OWNER_TELEGRAM_ID) {
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

  const item = await addItem(c.env.DB, {
    name: body.name.trim(),
    link: body.link?.trim() || null,
    image_url: null,
    price_min: parsed?.min ?? null,
    price_max: parsed?.max ?? null,
  })

  if (item.link) {
    c.executionCtx.waitUntil(
      fetchOgImage(item.link).then(imageUrl => {
        if (imageUrl) return updateItemImage(c.env.DB, item.id, imageUrl)
      })
    )
  }

  return c.json(item, 201)
}

export async function handleDeleteItem(c: Context<{ Bindings: Env }>) {
  const user = c.get('user')
  if (String(user.id) !== c.env.OWNER_TELEGRAM_ID) {
    return c.json({ error: 'Forbidden' }, 403)
  }
  const id = c.req.param('id')
  const deleted = await deleteItem(c.env.DB, id)
  if (!deleted) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- test/items.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/handlers/items.ts test/items.test.ts
git commit -m "feat: add items API handlers"
```

---

### Task 7: Claims API Handlers

**Files:**
- Create: `src/handlers/claims.ts`
- Create: `test/claims.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// test/claims.test.ts
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
  const app = new Hono<{ Bindings: any }>()
  app.use('*', async (c, next) => {
    Object.assign(c.env, { DB: env.DB, TELEGRAM_BOT_TOKEN: BOT_TOKEN, OWNER_TELEGRAM_ID: OWNER_ID })
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- test/claims.test.ts
```

Expected: FAIL — `Cannot find module '../src/handlers/claims'`

- [ ] **Step 3: Implement `src/handlers/claims.ts`**

```typescript
// src/handlers/claims.ts
import type { Context } from 'hono'
import type { Env } from '../types'
import { claimItem, unclaimItem } from '../db'

export async function handleClaim(c: Context<{ Bindings: Env }>) {
  const user = c.get('user')
  if (String(user.id) === c.env.OWNER_TELEGRAM_ID) {
    return c.json({ error: 'Owner cannot claim gifts' }, 403)
  }

  const id = c.req.param('id')
  const result = await claimItem(c.env.DB, id, user.id, user.username ?? null)

  if (result.conflict) {
    return c.json({ error: 'Кто-то успел раньше!' }, 409)
  }
  return c.json({ ok: true })
}

export async function handleUnclaim(c: Context<{ Bindings: Env }>) {
  const user = c.get('user')
  const id = c.req.param('id')
  const unclaimed = await unclaimItem(c.env.DB, id, user.id)
  if (!unclaimed) return c.json({ error: 'Not found or not your claim' }, 404)
  return c.json({ ok: true })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- test/claims.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/handlers/claims.ts test/claims.test.ts
git commit -m "feat: add claim/unclaim API handlers"
```

---

### Task 8: Telegram Webhook Handler

**Files:**
- Create: `src/handlers/webhook.ts`

- [ ] **Step 1: Implement `src/handlers/webhook.ts`**

No TDD here — the handler just calls the Telegram API; mocking it provides little value. Write it directly.

```typescript
// src/handlers/webhook.ts

interface TelegramUpdate {
  message?: {
    chat: { id: number }
    text?: string
  }
}

export async function handleWebhook(
  request: Request,
  botToken: string,
  appUrl: string
): Promise<Response> {
  const update = await request.json<TelegramUpdate>()

  if (update.message?.text?.startsWith('/start')) {
    const chatId = update.message.chat.id
    await sendStartMessage(botToken, chatId, appUrl)
  }

  // Always return 200 to Telegram — any error causes repeated retries
  return new Response('ok')
}

async function sendStartMessage(
  token: string,
  chatId: number,
  appUrl: string
): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: '🎁 Открой мой вишлист!',
      reply_markup: {
        inline_keyboard: [[
          { text: '🎁 Открыть вишлист', web_app: { url: appUrl } }
        ]],
      },
    }),
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/handlers/webhook.ts
git commit -m "feat: add Telegram webhook handler"
```

---

### Task 9: Worker Entry Point

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Implement `src/index.ts`**

This wires everything together. The `INDEX_HTML` import will be added in Task 10.

```typescript
// src/index.ts
import { Hono } from 'hono'
import type { Env } from './types'
import './types' // ensures ContextVariableMap augmentation is applied
import { validateInitData } from './auth'
import { handleGetItems, handleAddItem, handleDeleteItem } from './handlers/items'
import { handleClaim, handleUnclaim } from './handlers/claims'
import { handleWebhook } from './handlers/webhook'
import { INDEX_HTML } from './frontend'

export type { Env }

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
```

- [ ] **Step 2: Verify TypeScript compiles**

`src/frontend.ts` will be completed in Task 10. For now it already exists as a stub from Task 0 (Step 6 created `src/types.ts`; the stub `src/frontend.ts` with `export const INDEX_HTML = ""` should be created here if not already present):

```bash
[ -f src/frontend.ts ] || echo 'export const INDEX_HTML = ""' > src/frontend.ts
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/index.ts src/frontend.ts
git commit -m "feat: add Worker entry point and route wiring"
```

---

### Task 10: Frontend

**Files:**
- Modify: `src/frontend.ts` (replace stub with full implementation)

- [ ] **Step 1: Replace `src/frontend.ts` with the complete Mini App**

```typescript
// src/frontend.ts
export const INDEX_HTML = /* html */`<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Вишлист</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, -apple-system, sans-serif; background: #f0f5fd; color: #2d2d2d; min-height: 100vh; }

:root {
  --accent: #7a9ec9;
  --accent-dark: #4f7aaa;
  --accent-light: #e8f0fa;
  --border: #d8e4f0;
  --bg: #fff;
  --text: #2d2d2d;
  --muted: #7a8fa8;
  --subtle: #f0f5fd;
}

.header { background: var(--accent); color: #fff; padding: 14px 16px; font-weight: 600; font-size: 16px; position: sticky; top: 0; z-index: 10; }
.add-form { background: var(--bg); border-bottom: 1px solid var(--border); padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
.add-form input { border: 1px solid var(--border); border-radius: 8px; padding: 9px 11px; font-size: 14px; outline: none; color: var(--text); width: 100%; background: var(--bg); }
.add-form input:focus { border-color: var(--accent); }
.btn-primary { background: var(--accent); color: #fff; border: none; border-radius: 8px; padding: 10px; font-size: 14px; font-weight: 600; cursor: pointer; width: 100%; }
.btn-primary:active { background: var(--accent-dark); }
.stats-bar { background: var(--subtle); border-bottom: 1px solid var(--border); padding: 8px 14px; font-size: 12px; color: var(--muted); }
.stats-bar strong { color: var(--accent-dark); }
.budget-bar { background: var(--bg); border-bottom: 1px solid var(--border); padding: 12px 14px; }
.budget-label { font-size: 12px; color: var(--muted); font-weight: 600; margin-bottom: 8px; }
.budget-row { display: flex; align-items: center; gap: 10px; }
.budget-row input[type=range] { flex: 1; accent-color: var(--accent); }
.budget-num { border: 1px solid var(--border); border-radius: 8px; padding: 6px 8px; width: 70px; text-align: center; font-size: 13px; color: var(--text); background: var(--bg); }
.budget-unit { font-size: 13px; color: var(--muted); font-weight: 600; }
.budget-hint { font-size: 11px; color: #aaa; margin-top: 6px; }
.item-list { padding: 4px 0; }
.item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--subtle); background: var(--bg); }
.item:last-child { border-bottom: none; }
.item-img { width: 46px; height: 46px; border-radius: 8px; background: var(--accent-light); flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 22px; overflow: hidden; }
.item-img img { width: 100%; height: 100%; object-fit: cover; border-radius: 8px; }
.item-body { flex: 1; min-width: 0; }
.item-name { font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.item-meta { font-size: 12px; color: var(--muted); margin-top: 2px; }
.item-meta a { color: var(--accent-dark); text-decoration: none; }
.btn-claim { background: var(--accent); color: #fff; border: none; border-radius: 8px; padding: 7px 13px; font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; flex-shrink: 0; }
.btn-unclaim { background: var(--bg); color: var(--accent-dark); border: 1.5px solid var(--accent); border-radius: 8px; padding: 6px 13px; font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; flex-shrink: 0; }
.btn-delete { background: none; border: none; color: #ccc; font-size: 18px; cursor: pointer; padding: 4px; flex-shrink: 0; }
.btn-delete:hover { color: #e07a5f; }
.footer-note { padding: 10px 14px; font-size: 12px; color: #aaa; text-align: center; }
.error-toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #2d2d2d; color: #fff; padding: 10px 18px; border-radius: 10px; font-size: 13px; z-index: 100; display: none; }
.loading { text-align: center; padding: 40px 20px; color: var(--muted); font-size: 14px; }
.hidden { display: none !important; }
</style>
</head>
<body>

<div id="app">
  <div class="loading">Загрузка...</div>
</div>
<div class="error-toast" id="toast"></div>

<script>
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const initData = tg.initData;
let state = { isOwner: false, items: [], claimedCount: 0, budget: 100, myClaimedIds: new Set() };

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: {
      'X-Telegram-Init-Data': initData,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { showToast('Ошибка авторизации'); throw new Error('401'); }
  return res;
}

function showToast(msg, duration = 3000) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', duration);
}

function emojiFor(name) {
  const n = name.toLowerCase();
  if (n.includes('книг')) return '📖';
  if (n.includes('духи') || n.includes('парфюм')) return '🌸';
  if (n.includes('наушник') || n.includes('airpod')) return '🎧';
  if (n.includes('йога') || n.includes('коврик')) return '🧘';
  if (n.includes('шарф') || n.includes('платок')) return '🧣';
  if (n.includes('обув') || n.includes('туфл')) return '👟';
  if (n.includes('сумк')) return '👜';
  return '🎁';
}

function formatPrice(min, max) {
  if (min === null) return '';
  if (min === max) return min + '€';
  return min + '–' + max + '€';
}

async function loadItems() {
  const res = await api('GET', '/api/items');
  const data = await res.json();
  state.isOwner = data.is_owner;
  state.claimedCount = data.claimed_count;
  state.items = data.items;
  if (!state.isOwner) {
    state.myClaimedIds = new Set(
      tg.initDataUnsafe?.user?.id
        ? [] // populated from server — items returned are only unclaimed OR claimed by this user
        : []
    );
    // Mark items where we detect claim button should be "undo" by checking response
    // (friend response only returns unclaimed items — we track locally which we claimed this session)
  }
  // Set slider max to highest price
  const maxPrice = Math.max(100, ...state.items.map(i => i.price_max ?? i.price_min ?? 0).filter(Boolean));
  state.budget = maxPrice;
  render();
}

function render() {
  document.getElementById('app').innerHTML = state.isOwner ? renderOwner() : renderFriend();
  attachEvents();
}

function renderOwner() {
  const itemsHtml = state.items.map(item => \`
    <div class="item" data-id="\${item.id}">
      <div class="item-img">
        \${item.image_url
          ? \`<img src="\${item.image_url}" alt="" onerror="this.parentNode.innerHTML='\${emojiFor(item.name)}'"/>\`
          : emojiFor(item.name)}
      </div>
      <div class="item-body">
        <div class="item-name">\${escHtml(item.name)}</div>
        <div class="item-meta">
          \${formatPrice(item.price_min, item.price_max)}
          \${item.link ? \` · <a href="\${escHtml(item.link)}" target="_blank">ссылка</a>\` : ''}
        </div>
      </div>
      <button class="btn-delete" data-delete="\${item.id}" title="Удалить">✕</button>
    </div>
  \`).join('');

  return \`
    <div class="header">🎁 Мой вишлист</div>
    <div class="add-form">
      <input id="inp-name" placeholder="Название подарка *" autocomplete="off">
      <input id="inp-link" placeholder="Ссылка (необязательно)" type="url">
      <input id="inp-price" placeholder="Цена: 50 или диапазон 50-100">
      <button class="btn-primary" id="btn-add">+ Добавить подарок</button>
    </div>
    <div class="stats-bar">
      \${state.items.length} подарков · <strong>\${state.claimedCount} уже выбраны 🎉</strong>
    </div>
    <div class="item-list">\${itemsHtml}</div>
    \${state.items.length === 0 ? '<div class="footer-note">Добавьте первый подарок 🎁</div>' : ''}
  \`;
}

function renderFriend() {
  const maxPrice = Math.max(100, ...state.items.map(i => i.price_max ?? i.price_min ?? 0).filter(p => p));
  const visible = state.items.filter(i => i.price_min === null || i.price_min <= state.budget);
  const otherClaimedCount = state.claimedCount - state.myClaimedIds.size;

  const itemsHtml = visible.map(item => {
    const isMine = state.myClaimedIds.has(item.id);
    return \`
      <div class="item" data-id="\${item.id}">
        <div class="item-img">
          \${item.image_url
            ? \`<img src="\${item.image_url}" alt="" onerror="this.parentNode.innerHTML='\${emojiFor(item.name)}'"/>\`
            : emojiFor(item.name)}
        </div>
        <div class="item-body">
          <div class="item-name">\${escHtml(item.name)}</div>
          <div class="item-meta">
            \${formatPrice(item.price_min, item.price_max)}
            \${item.link ? \` · <a href="\${escHtml(item.link)}" target="_blank">ссылка</a>\` : ''}
          </div>
        </div>
        \${isMine
          ? \`<button class="btn-unclaim" data-unclaim="\${item.id}">Отменить ↩</button>\`
          : \`<button class="btn-claim" data-claim="\${item.id}">Подарю!</button>\`}
      </div>
    \`;
  }).join('');

  return \`
    <div class="header">🎁 Вишлист</div>
    <div class="budget-bar">
      <div class="budget-label">Мой бюджет</div>
      <div class="budget-row">
        <input type="range" id="budget-slider" min="0" max="\${maxPrice}" value="\${state.budget}">
        <input class="budget-num" type="number" id="budget-num" value="\${state.budget}">
        <span class="budget-unit">€</span>
      </div>
      <div class="budget-hint" id="budget-hint">Показано \${visible.length} из \${state.items.length} подарков</div>
    </div>
    <div class="item-list">\${itemsHtml}</div>
    \${otherClaimedCount > 0 ? \`<div class="footer-note">\${otherClaimedCount} подарков уже выбраны другими</div>\` : ''}
    \${visible.length === 0 ? '<div class="footer-note">Нет подарков в вашем бюджете</div>' : ''}
  \`;
}

function attachEvents() {
  // Owner: add item
  document.getElementById('btn-add')?.addEventListener('click', async () => {
    const name = document.getElementById('inp-name').value.trim();
    if (!name) { showToast('Введите название подарка'); return; }
    const link = document.getElementById('inp-link').value.trim();
    const price = document.getElementById('inp-price').value.trim();
    const res = await api('POST', '/api/items', { name, link: link || undefined, price: price || undefined });
    if (res.ok) {
      document.getElementById('inp-name').value = '';
      document.getElementById('inp-link').value = '';
      document.getElementById('inp-price').value = '';
      await loadItems();
    } else {
      const err = await res.json();
      showToast(err.error || 'Ошибка');
    }
  });

  // Owner: delete item
  document.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.delete;
      const res = await api('DELETE', \`/api/items/\${id}\`);
      if (res.ok) await loadItems();
    });
  });

  // Friend: budget slider
  const slider = document.getElementById('budget-slider');
  const numInput = document.getElementById('budget-num');
  function updateBudget(val) {
    state.budget = Math.max(0, +val);
    if (slider) slider.value = state.budget;
    if (numInput) numInput.value = state.budget;
    const maxPrice = Math.max(100, ...state.items.map(i => i.price_max ?? i.price_min ?? 0).filter(Boolean));
    const visible = state.items.filter(i => i.price_min === null || i.price_min <= state.budget);
    const hint = document.getElementById('budget-hint');
    if (hint) hint.textContent = \`Показано \${visible.length} из \${state.items.length} подарков\`;
    // Re-render item list only
    const list = document.querySelector('.item-list');
    if (list) {
      const otherClaimedCount = state.claimedCount - state.myClaimedIds.size;
      const itemsHtml = visible.map(item => {
        const isMine = state.myClaimedIds.has(item.id);
        return \`<div class="item" data-id="\${item.id}">
          <div class="item-img">\${item.image_url ? \`<img src="\${item.image_url}" alt="" onerror="this.parentNode.innerHTML='\${emojiFor(item.name)}'"/>\` : emojiFor(item.name)}</div>
          <div class="item-body"><div class="item-name">\${escHtml(item.name)}</div><div class="item-meta">\${formatPrice(item.price_min, item.price_max)}\${item.link ? \` · <a href="\${escHtml(item.link)}" target="_blank">ссылка</a>\` : ''}</div></div>
          \${isMine ? \`<button class="btn-unclaim" data-unclaim="\${item.id}">Отменить ↩</button>\` : \`<button class="btn-claim" data-claim="\${item.id}">Подарю!</button>\`}
        </div>\`;
      }).join('');
      list.innerHTML = itemsHtml;
      attachClaimEvents();
    }
  }
  slider?.addEventListener('input', () => updateBudget(slider.value));
  numInput?.addEventListener('input', () => updateBudget(numInput.value));

  attachClaimEvents();
}

function attachClaimEvents() {
  // Friend: claim
  document.querySelectorAll('[data-claim]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.claim;
      const res = await api('POST', \`/api/items/\${id}/claim\`);
      if (res.status === 409) {
        showToast('Кто-то успел раньше! Обновите список.');
        await loadItems();
      } else if (res.ok) {
        state.myClaimedIds.add(id);
        await loadItems();
      }
    });
  });

  // Friend: unclaim
  document.querySelectorAll('[data-unclaim]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.unclaim;
      const res = await api('DELETE', \`/api/items/\${id}/claim\`);
      if (res.ok) {
        state.myClaimedIds.delete(id);
        await loadItems();
      }
    });
  });
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

loadItems().catch(err => {
  document.getElementById('app').innerHTML = '<div class="loading">Ошибка загрузки. Попробуйте снова.</div>';
});
</script>
</body>
</html>`
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Run all tests to ensure nothing broke**

```bash
npm test
```

Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/frontend.ts
git commit -m "feat: add Mini App frontend (owner + friend views, Russian UI)"
```

---

### Task 11: Deployment

**Files:**
- Modify: `wrangler.toml` (finalize)
- Create: `README.md`

- [ ] **Step 1: Add `.dev.vars` for local development**

```bash
cat > .dev.vars << 'EOF'
TELEGRAM_BOT_TOKEN=your-bot-token-here
OWNER_TELEGRAM_ID=your-telegram-user-id-here
EOF
echo ".dev.vars" >> .gitignore
```

- [ ] **Step 2: Test locally**

```bash
npm run dev
```

Open the local URL and verify it returns the HTML page.

- [ ] **Step 3: Set production secrets**

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
# paste your token when prompted
npx wrangler secret put OWNER_TELEGRAM_ID
# paste your Telegram user ID (find it via @userinfobot on Telegram)
```

- [ ] **Step 4: Deploy**

```bash
npm run deploy
```

Note the deployed URL (e.g. `https://wishlist-bot.your-subdomain.workers.dev`).

- [ ] **Step 5: Register the bot webhook**

```bash
WORKER_URL="https://wishlist-bot.your-subdomain.workers.dev"
BOT_TOKEN="your-bot-token"
curl "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${WORKER_URL}/webhook"
```

Expected: `{"ok":true,"result":true}`

- [ ] **Step 6: Register the Mini App with BotFather**

In Telegram, message `@BotFather`:
1. `/newapp` (or `/editapp` if bot exists)
2. Set the Web App URL to `https://wishlist-bot.your-subdomain.workers.dev`
3. Note the resulting `t.me/yourbot/app` link — this is what your wife shares

- [ ] **Step 7: Smoke test**

- Open `t.me/yourbot` → tap Start → tap the button → Mini App opens
- Add a gift as owner
- Open the same link from another Telegram account → see the gift as friend
- Claim the gift → it disappears for others

- [ ] **Step 8: Commit**

```bash
git add .gitignore README.md
git commit -m "chore: add deployment instructions and .gitignore"
```

---

## Task Dependencies

```
Task 0 (scaffold)
  └── Task 1 (schema)
        └── Task 5 (db layer)
              ├── Task 6 (items handlers)
              └── Task 7 (claims handlers)
Task 2 (price parsing) → Task 6 (items handlers)
Task 3 (auth) → Tasks 6, 7
Task 4 (ogimage) → Task 6 (items handlers)
Tasks 6, 7, 8 → Task 9 (entry point)
Task 9 → Task 10 (frontend)
Task 10 → Task 11 (deployment)
```
