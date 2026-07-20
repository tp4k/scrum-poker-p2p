const FIBONACCI_DECK = ['0', '1', '2', '3', '5', '8', '13', '21', '?', '☕']
const TSHIRT_DECK = ['XS', 'S', 'M', 'L', 'XL', '?']

export const PRESETS: Record<string, string[]> = {
  fib: FIBONACCI_DECK,
  tshirt: TSHIRT_DECK
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((card, i) => card === b[i])
}

export function encodeDeck(cards: string[]): string {
  if (arraysEqual(cards, PRESETS.fib)) return 'fib'
  if (arraysEqual(cards, PRESETS.tshirt)) return 'tshirt'
  return encodeURIComponent(cards.join(','))
}

export function decodeDeck(code: string): string[] {
  if (code === 'fib') return PRESETS.fib
  if (code === 'tshirt') return PRESETS.tshirt
  try {
    return decodeURIComponent(code).split(',')
  } catch {
    return PRESETS.fib
  }
}

export function isNumericCard(card: string): boolean {
  return Number.isFinite(parseFloat(card))
}

export function average(cards: string[]): number | null {
  const numericCards = cards.filter(isNumericCard)
  if (numericCards.length === 0) return null
  const sum = numericCards.reduce((total, card) => total + parseFloat(card), 0)
  return sum / numericCards.length
}

const LABEL_LENGTH_MEDIUM = 3
const LABEL_LENGTH_LONG = 4

export function labelSizeClass(label: string): string {
  const length = [...label].length
  if (length >= LABEL_LENGTH_LONG) return 'label-sm'
  if (length === LABEL_LENGTH_MEDIUM) return 'label-md'
  return ''
}
