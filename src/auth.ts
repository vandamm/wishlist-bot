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

  const authDate = Number(params.get('auth_date') ?? 0)
  if (Date.now() / 1000 - authDate > 86400) return { valid: false }

  const userStr = params.get('user')
  if (!userStr) return { valid: false }

  try {
    const user = JSON.parse(userStr) as TelegramUser
    return { valid: true, user }
  } catch {
    return { valid: false }
  }
}
