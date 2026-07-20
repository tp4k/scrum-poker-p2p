import { describe, expect, it } from 'vitest'
import { PRESETS, average, decodeDeck, encodeDeck, isFractionalCard, isNumericCard } from './deck'

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
    expect(encodeDeck(PRESETS.frac)).toBe('frac')
  })

  it('round-trips the Fractional preset through the URL d param', () => {
    expect(decodeDeck(encodeDeck(PRESETS.frac))).toEqual(PRESETS.frac)
  })

  it('encodes the literal Fractional preset array as its short alias', () => {
    expect(encodeDeck(['0.1', '0.2', '0.5', '1', '2', '?', '☕'])).toBe('frac')
  })

  it('decodes the frac alias to the Fractional preset', () => {
    expect(decodeDeck('frac')).toEqual(['0.1', '0.2', '0.5', '1', '2', '?', '☕'])
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

describe('isFractionalCard', () => {
  it('is true for fractional numeric values', () => {
    expect(isFractionalCard('0.5')).toBe(true)
    expect(isFractionalCard('0.25')).toBe(true)
  })

  it('is false for integer or non-numeric values', () => {
    expect(isFractionalCard('5')).toBe(false)
    expect(isFractionalCard('100')).toBe(false)
    expect(isFractionalCard('1')).toBe(false)
    expect(isFractionalCard('☕')).toBe(false)
    expect(isFractionalCard('?')).toBe(false)
  })
})
