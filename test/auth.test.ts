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
