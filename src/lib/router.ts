import { readable, type Readable } from 'svelte/store'

export type Route = { name: 'home' } | { name: 'room'; slug: string; deck: string } | { name: 'diag' }

const SLUG_LENGTH = 10
const SLUG_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
const ROOM_PATH_PATTERN = /^\/room\/([^?]+)(?:\?(.*))?$/

function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '')

  if (path === '' || path === '/') {
    return { name: 'home' }
  }

  if (path === '/diag') {
    return { name: 'diag' }
  }

  const match = ROOM_PATH_PATTERN.exec(path)
  if (match) {
    const slug = match[1]
    const params = new URLSearchParams(match[2] ?? '')
    const deck = params.get('d') ?? ''
    return { name: 'room', slug, deck }
  }

  return { name: 'home' }
}

export const route: Readable<Route> = readable<Route>(parseHash(location.hash), (set) => {
  set(parseHash(location.hash))
  const onHashChange = () => set(parseHash(location.hash))
  window.addEventListener('hashchange', onHashChange)
  return () => window.removeEventListener('hashchange', onHashChange)
})

export function buildRoomHash(slug: string, deckCode: string): string {
  return `#/room/${slug}?d=${deckCode}`
}

export function newSlug(): string {
  const values = new Uint32Array(SLUG_LENGTH)
  crypto.getRandomValues(values)
  let slug = ''
  for (let i = 0; i < SLUG_LENGTH; i++) {
    slug += SLUG_ALPHABET[values[i] % SLUG_ALPHABET.length]
  }
  return slug
}
