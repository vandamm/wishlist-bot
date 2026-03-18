// src/types.ts - standalone version (no import from auth.ts yet)
import type {} from 'hono'

export interface TelegramUser {
  id: number
  username?: string
  first_name?: string
}

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
