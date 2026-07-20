import { describe, expect, it } from 'vitest'
import { get } from 'svelte/store'
import { buildRoomHash, newSlug, route } from './router'

const SLUG_PATTERN = /^[a-z0-9]{10}$/

describe('router', () => {
  it('buildRoomHash + route round-trip', () => {
    expect(buildRoomHash('abc123', 'fib')).toBe('#/room/abc123?d=fib')

    location.hash = '#/room/abc123?d=fib'
    expect(get(route)).toEqual({ name: 'room', slug: 'abc123', deck: 'fib' })

    location.hash = '#/diag'
    expect(get(route)).toEqual({ name: 'diag' })

    location.hash = ''
    expect(get(route)).toEqual({ name: 'home' })

    location.hash = '#/'
    expect(get(route)).toEqual({ name: 'home' })
  })

  it('newSlug returns a 10-char lowercase alphanumeric slug', () => {
    expect(newSlug()).toMatch(SLUG_PATTERN)
  })
})
