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
