export async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WishlistBot/1.0)' },
      redirect: 'follow',
    })
    if (!response.ok) return null

    const html = await response.text()

    // Match both attribute orders
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
