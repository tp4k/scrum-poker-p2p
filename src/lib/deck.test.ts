import { describe, expect, it } from 'vitest'
import { PRESETS, average, decodeDeck, encodeDeck, isNumericCard } from './deck'

const CUSTOM_DECK = ['1', '2', '4', '8']

describe('deck encode/decode', () => {
  it('round-trips the Fibonacci preset through the URL d param', () => {
    expect(decodeDeck(encodeDeck(PRESETS.fib))).toEqual(PRESETS.fib)
  })

  it('round-trips the T-shirt preset through the URL d param', () => {
    expect(decodeDeck(encodeDeck(PRESETS.tshirt))).toEqual(PRESETS.tshirt)
  })

  it('round-trips a custom comma-separated deck through the URL d param', () => {
    expect(decodeDeck(encodeDeck(CUSTOM_DECK))).toEqual(CUSTOM_DECK)
  })

  it('encodes presets as their short alias', () => {
    expect(encodeDeck(PRESETS.fib)).toBe('fib')
    expect(encodeDeck(PRESETS.tshirt)).toBe('tshirt')
  })

  it('falls back to the Fibonacci preset instead of throwing on a malformed percent-sequence', () => {
    expect(() => decodeDeck('%')).not.toThrow()
    expect(decodeDeck('%')).toEqual(PRESETS.fib)
    expect(() => decodeDeck('%zz')).not.toThrow()
    expect(decodeDeck('%zz')).toEqual(PRESETS.fib)
  })
})

describe('isNumericCard', () => {
  it('is true for numeric card values', () => {
    expect(isNumericCard('0')).toBe(true)
    expect(isNumericCard('1')).toBe(true)
    expect(isNumericCard('5')).toBe(true)
    expect(isNumericCard('13')).toBe(true)
  })

  it('is false for non-numeric card values', () => {
    expect(isNumericCard('?')).toBe(false)
    expect(isNumericCard('☕')).toBe(false)
    expect(isNumericCard('XL')).toBe(false)
  })
})

describe('average', () => {
  it('ignores non-numeric cards among numeric ones', () => {
    expect(average(['5', '8', '?', '☕'])).toBe(6.5)
  })

  it('is null when no card is numeric', () => {
    expect(average(['XS', 'M'])).toBeNull()
  })
})
