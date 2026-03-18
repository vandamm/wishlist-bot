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
