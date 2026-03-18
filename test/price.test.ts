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
