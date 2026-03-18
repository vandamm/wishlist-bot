# Wishlist Telegram Mini App — Design Spec

## Overview

A Telegram Mini App for a birthday wishlist. The owner adds gifts to a single list and shares it via a Telegram bot link. Friends open the app, optionally filter by budget, and claim gifts. Claimed gifts disappear from the list for other friends. The owner sees all gifts but not who claimed which — only the total count claimed.

---

## Tech Stack

- **Runtime:** Cloudflare Workers (TypeScript)
- **Database:** Cloudflare D1 (SQLite)
- **Frontend:** Single-page HTML/JS served as a static asset from the Worker (vanilla JS, no framework)
- **Auth:** Telegram Mini App `initData` HMAC validation
- **Bot:** Telegram Bot API (webhook on the Worker)
- **Language:** Russian UI

---

## Authorization Model

Every request to the API includes the Telegram `initData` string (injected by the Telegram Mini App SDK into `window.Telegram.WebApp.initData`). The Worker validates the HMAC signature of `initData` using the bot token (`TELEGRAM_BOT_TOKEN` env var). From the validated data, `user.id` is extracted.

The owner is identified by comparing `user.id` against the `OWNER_TELEGRAM_ID` env var (set once during deployment). No registration flow needed.

---

## Data Model

```sql
CREATE TABLE items (
  id         TEXT    PRIMARY KEY,   -- nanoid
  name       TEXT    NOT NULL,
  link       TEXT,                  -- optional URL
  image_url  TEXT,                  -- fetched og:image, nullable
  price_min  REAL,                  -- nullable if no price given
  price_max  REAL,                  -- equals price_min for fixed price, higher for range
  created_at INTEGER NOT NULL       -- unix timestamp
);

CREATE TABLE claims (
  item_id            TEXT    PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
  telegram_user_id   INTEGER NOT NULL,
  telegram_username  TEXT,
  claimed_at         INTEGER NOT NULL
);
```

**Price encoding:**
- No price → `price_min = NULL`, `price_max = NULL`
- Fixed price `50` → `price_min = 50`, `price_max = 50`
- Range `50-100` → `price_min = 50`, `price_max = 100`

**Budget filter logic:** show item if `price_min IS NULL OR price_min <= budget`

---

## API Routes

All routes validate `initData` from the `X-Telegram-Init-Data` header. Requests with invalid or missing `initData` return `401`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/items` | any | Returns items. For owner: all items + `is_claimed` bool per item + total claimed count. For friends: unclaimed items only. |
| `POST` | `/api/items` | owner only | Add item. Triggers async og:image fetch if `link` provided. |
| `DELETE` | `/api/items/:id` | owner only | Delete item (also removes claim if any). |
| `POST` | `/api/items/:id/claim` | friend only | Claim item. Uses D1 transaction: fails if already claimed. Returns `409` if taken. |
| `DELETE` | `/api/items/:id/claim` | claimer only | Unclaim. Only the user who claimed it can unclaim. |

**Friend vs owner distinction:** Owner-only routes return `403` for non-owners.

**`GET /api/items` response shape:**
```json
{
  "is_owner": true,
  "claimed_count": 2,
  "items": [
    {
      "id": "abc123",
      "name": "AirPods Pro",
      "link": "https://apple.com/...",
      "image_url": "https://...",
      "price_min": 249,
      "price_max": 249,
      "is_claimed": false
    }
  ]
}
```
For friend responses: `is_owner` is `false`, `claimed_count` is included (for the footer count), `is_claimed` is omitted from each item (friends only see unclaimed items), and `items` only contains unclaimed gifts.

---

## Image Auto-Fetch

When the owner adds an item with a `link`, the Worker fires an async `fetch()` to that URL, parses the HTML for `<meta property="og:image">`, and stores the result in `items.image_url`. This runs after the 200 response is sent (using `ctx.waitUntil()`). If the fetch fails, the og:image URL is relative (not absolute), or no og:image is found, `image_url` stays null — the UI falls back to a placeholder emoji based on item name.

---

## Telegram Bot

The bot is minimal. Its only job is to serve as the entry point:

- Responds to `/start` with a message and a **Web App button** that opens the Mini App URL (`https://<worker-domain>/`)
- The shareable link your wife sends to friends is `t.me/<botname>` — friends tap it, hit Start, tap the button

No other bot commands needed.

---

## Frontend

A single `index.html` served at `GET /` from the Worker. Vanilla JS, no build step.

**Startup flow:**
1. `Telegram.WebApp.ready()` called immediately
2. `initData` extracted from `Telegram.WebApp.initData`
3. `GET /api/items` called with `initData` in header
4. Response includes `is_owner: bool` — UI renders owner view or friend view accordingly

**Owner view:**
- Add-item form (name, link, price input — accepts `50` or `50-100`)
- Stats bar: "N подарков · X уже выбраны 🎉"
- Full item list — all items shown identically regardless of claim status
- Each item: thumbnail (og:image or emoji fallback), name, price/range, link

**Friend view:**
- Budget bar: slider (0 → max item price, defaults to 100 if list is empty) + synced number input + "€" label + "Showing N of M gifts" hint
- Item list filtered by budget (client-side filtering after initial load)
- Each item: thumbnail, name, price/range, "Подарю!" button
- Items the current friend has claimed show "Отменить ↩" instead
- Footer: "X подарков уже выбраны другими" (count of items claimed by others)

**Color scheme:** Pastel blue (`--accent: #7a9ec9`), single CSS variable — trivially changeable.

---

## Price Input Parsing

Single text input accepts:
- `50` → fixed price
- `50-100` or `50–100` → price range
- Empty → no price

Parsed on the frontend before submission, validated again on the Worker.

---

## Error Handling

- `409` on claim conflict → UI shows "Кто-то успел раньше! Обновите список." and refreshes
- `401` invalid initData → UI shows "Ошибка авторизации"
- `403` non-owner on owner route → silent (buttons not shown to non-owners anyway)
- Network errors → generic retry prompt

---

## Deployment

- Worker deployed via Wrangler (`wrangler deploy`)
- D1 database bound as `DB` in `wrangler.toml`
- Env vars: `TELEGRAM_BOT_TOKEN`, `OWNER_TELEGRAM_ID`
- Webhook set once: `POST https://api.telegram.org/bot<token>/setWebhook?url=https://<worker-domain>/webhook`

---

## Out of Scope

- Multiple wishlists
- Group gifting / partial contributions
- Push notifications
- Admin UI beyond the Mini App
- Any web access without Telegram
