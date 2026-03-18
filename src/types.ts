import type {} from 'hono'
import type { TelegramUser } from './auth'

export type { TelegramUser }

export interface Env {
  DB: D1Database
  TELEGRAM_BOT_TOKEN: string
  OWNER_TELEGRAM_ID: string
}

declare module 'hono' {
  interface ContextVariableMap {
    user: TelegramUser
  }
}
