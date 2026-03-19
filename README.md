# Wishlist Bot

A Telegram Mini App for a birthday wishlist. The owner adds gifts and friends claim them.

## Setup

### 1. Create the D1 database

```bash
npx wrangler d1 create wishlist
```

Copy the `database_id` from the output and update `wrangler.toml`.

### 2. Run the migration

```bash
npx wrangler d1 execute wishlist --file=migrations/0001_initial.sql
```

### 3. Set production secrets

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
# paste your bot token when prompted

npx wrangler secret put TELEGRAM_OWNER_USERNAME
# paste your Telegram username (without @)
```

### 4. Deploy

```bash
npm run deploy
```

Note the deployed URL (e.g. `https://wishlist-bot.your-subdomain.workers.dev`).

### 5. Register the bot webhook

```bash
WORKER_URL="https://wishlist-bot.your-subdomain.workers.dev"
BOT_TOKEN="your-bot-token"
curl "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${WORKER_URL}/webhook"
```

Expected: `{"ok":true,"result":true}`

### 6. Register the Mini App with BotFather

In Telegram, message `@BotFather`:
1. `/newapp` (or `/editapp` if bot exists)
2. Set the Web App URL to `https://wishlist-bot.your-subdomain.workers.dev`

### 7. Local development

Create `.dev.vars` with your secrets:

```
TELEGRAM_BOT_TOKEN=your-bot-token-here
TELEGRAM_OWNER_USERNAME=your-telegram-username-here
```

Then run:

```bash
npm run dev
```

## Testing

```bash
npm test
```

## Tech Stack

- Cloudflare Workers (TypeScript)
- Cloudflare D1 (SQLite)
- Hono router
- Telegram Bot API + Mini App SDK
- Vitest + @cloudflare/vitest-pool-workers
