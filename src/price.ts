export interface ParsedPrice {
  min: number
  max: number
}

export function parsePrice(input: string): ParsedPrice | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // Range: "50-100" or "50–100" (en-dash), with optional spaces
  const rangeMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/)
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1])
    const max = parseFloat(rangeMatch[2])
    if (min > max) return null
    return { min, max }
  }

  // Fixed price: "50" or "49.99"
  const fixedMatch = trimmed.match(/^(\d+(?:\.\d+)?)$/)
  if (fixedMatch) {
    const val = parseFloat(fixedMatch[1])
    return { min: val, max: val }
  }

  return null
}

export function formatPrice(min: number | null, max: number | null): string {
  if (min === null) return ''
  if (min === max) return `${min}€`
  return `${min}–${max}€`
}
