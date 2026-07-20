import { describe, expect, it } from 'vitest'
import {
  applyRemoteState,
  clearPeerVotes,
  MAX_NAME_LENGTH,
  MAX_ROUND,
  MAX_VOTE_LENGTH,
  nextConnectionState,
  prunePeers,
  type LocalRoomState,
  type PeerInfo,
  type RemoteMessage
} from './room'

function local(overrides: Partial<LocalRoomState> = {}): LocalRoomState {
  return {
    peers: {},
    round: 0,
    revealed: false,
    localVote: null,
    ...overrides
  }
}

function msg(overrides: Partial<RemoteMessage> = {}): RemoteMessage {
  return {
    peerId: 'peer-a',
    name: 'Alice',
    vote: '5',
    round: 0,
    revealed: false,
    ...overrides
  }
}

describe('applyRemoteState', () => {
  it('same round: records the peer vote and OR-merges revealed', () => {
    const before = local({ round: 2, revealed: false })
    const result = applyRemoteState(before, msg({ round: 2, vote: '8', revealed: true }))

    expect(result.state.peers['peer-a']).toEqual({ name: 'Alice', vote: '8' })
    expect(result.state.revealed).toBe(true)
    expect(result.state.round).toBe(2)
    expect(result.resendTo).toBeNull()
  })

  it('same round: revealed stays true once set, even if incoming revealed is false', () => {
    const before = local({ round: 1, revealed: true })
    const result = applyRemoteState(before, msg({ round: 1, revealed: false }))

    expect(result.state.revealed).toBe(true)
  })

  it('higher round: adopts the new round, clears localVote, adopts revealed', () => {
    const before = local({ round: 1, revealed: true, localVote: '3', peers: {} })
    const result = applyRemoteState(before, msg({ round: 2, vote: null, revealed: false }))

    expect(result.state.round).toBe(2)
    expect(result.state.localVote).toBeNull()
    expect(result.state.revealed).toBe(false)
    expect(result.state.peers['peer-a']).toEqual({ name: 'Alice', vote: null })
    expect(result.resendTo).toBeNull()
  })

  it('higher round: clears other stored peers votes while preserving their names', () => {
    const before = local({
      round: 1,
      peers: {
        'peer-b': { name: 'Bob', vote: '8' },
        'peer-c': { name: 'Carol', vote: '5' }
      }
    })
    const result = applyRemoteState(before, msg({ peerId: 'peer-a', round: 2, vote: null }))

    expect(result.state.peers['peer-b']).toEqual({ name: 'Bob', vote: null })
    expect(result.state.peers['peer-c']).toEqual({ name: 'Carol', vote: null })
    expect(result.state.peers['peer-a']).toEqual({ name: 'Alice', vote: null })
  })

  it('higher round: still records the senders own vote while clearing others', () => {
    const before = local({
      round: 1,
      peers: {
        'peer-b': { name: 'Bob', vote: '8' },
        'peer-c': { name: 'Carol', vote: '5' }
      }
    })
    const result = applyRemoteState(before, msg({ peerId: 'peer-a', round: 2, vote: '3' }))

    expect(result.state.peers['peer-a']).toEqual({ name: 'Alice', vote: '3' })
    expect(result.state.peers['peer-b']).toEqual({ name: 'Bob', vote: null })
    expect(result.state.peers['peer-c']).toEqual({ name: 'Carol', vote: null })
  })

  it('higher round: is idempotent when other peers already hold votes', () => {
    const before = local({
      round: 1,
      peers: {
        'peer-b': { name: 'Bob', vote: '8' },
        'peer-c': { name: 'Carol', vote: '5' }
      }
    })
    const message = msg({ peerId: 'peer-a', round: 2, vote: '3' })

    const once = applyRemoteState(before, message)
    const twice = applyRemoteState(once.state, message)

    expect(twice.state).toEqual(once.state)
  })

  it('lower round: ignores the vote and flags the sender for a resend', () => {
    const before = local({
      round: 5,
      revealed: false,
      peers: { 'peer-a': { name: 'Alice', vote: '13' } }
    })
    const result = applyRemoteState(before, msg({ round: 3, vote: '1', revealed: true }))

    expect(result.state.peers['peer-a']).toEqual({ name: 'Alice', vote: '13' })
    expect(result.state.round).toBe(5)
    expect(result.state.revealed).toBe(false)
    expect(result.resendTo).toBe('peer-a')
  })

  it('is idempotent for same-round messages', () => {
    const before = local({ round: 4, revealed: false })
    const message = msg({ round: 4, vote: '2', revealed: true })

    const once = applyRemoteState(before, message)
    const twice = applyRemoteState(once.state, message)

    expect(twice.state).toEqual(once.state)
  })

  it('is idempotent for higher-round messages', () => {
    const before = local({ round: 1, revealed: false, localVote: '5' })
    const message = msg({ round: 2, vote: '3', revealed: false })

    const once = applyRemoteState(before, message)
    const twice = applyRemoteState(once.state, message)

    expect(twice.state).toEqual(once.state)
  })

  it('is idempotent for lower-round messages', () => {
    const before = local({
      round: 5,
      revealed: false,
      peers: { 'peer-a': { name: 'Alice', vote: '8' } }
    })
    const message = msg({ round: 1, vote: '1', revealed: true })

    const once = applyRemoteState(before, message)
    const twice = applyRemoteState(once.state, message)

    expect(twice.state).toEqual(once.state)
  })

  it('non-numeric votes (T-shirt / question mark / coffee) do not break the merge', () => {
    const before = local({ round: 0, revealed: false })

    const tshirt = applyRemoteState(before, msg({ round: 0, vote: 'XL' }))
    expect(tshirt.state.peers['peer-a']).toEqual({ name: 'Alice', vote: 'XL' })

    const unsure = applyRemoteState(tshirt.state, msg({ round: 0, vote: '?' }))
    expect(unsure.state.peers['peer-a']).toEqual({ name: 'Alice', vote: '?' })

    const coffee = applyRemoteState(unsure.state, msg({ round: 0, vote: '☕' }))
    expect(coffee.state.peers['peer-a']).toEqual({ name: 'Alice', vote: '☕' })
  })

  it('ignores a message whose round exceeds the safe cap (e.g. 1e308)', () => {
    const before = local({ round: 0 })
    const result = applyRemoteState(before, msg({ round: 1e308 }))

    expect(result.state).toEqual(before)
    expect(result.resendTo).toBeNull()
  })

  it('ignores a message whose round is not a number (e.g. the string "999")', () => {
    const before = local({ round: 0 })
    const malicious = { ...msg(), round: '999' } as unknown as RemoteMessage
    const result = applyRemoteState(before, malicious)

    expect(result.state).toEqual(before)
    expect(result.resendTo).toBeNull()
  })

  it('rejects a round right above the cap and accepts one right at the cap', () => {
    const before = local({ round: 0 })

    const tooHigh = applyRemoteState(before, msg({ round: MAX_ROUND + 1 }))
    expect(tooHigh.state).toEqual(before)

    const atCap = applyRemoteState(before, msg({ round: MAX_ROUND }))
    expect(atCap.state.round).toBe(MAX_ROUND)
  })

  it('truncates an oversized remote name before it reaches peers', () => {
    const before = local({ round: 0 })
    const hugeName = 'x'.repeat(10_000)
    const result = applyRemoteState(before, msg({ round: 0, name: hugeName }))

    expect(result.state.peers['peer-a'].name).toBe('x'.repeat(MAX_NAME_LENGTH))
  })

  it('coerces and truncates a non-string remote vote before it reaches peers', () => {
    const before = local({ round: 0 })
    const malicious = { ...msg({ round: 0 }), vote: 123456789012345678 } as unknown as RemoteMessage
    const result = applyRemoteState(before, malicious)

    expect(result.state.peers['peer-a'].vote).toBe(String(123456789012345678).slice(0, MAX_VOTE_LENGTH))
  })
})

describe('clearPeerVotes', () => {
  it('clears every peers vote while preserving names', () => {
    const peers: Record<string, PeerInfo> = {
      'peer-a': { name: 'Alice', vote: '5' },
      'peer-b': { name: 'Bob', vote: null }
    }
    const result = clearPeerVotes(peers)

    expect(result).toEqual({
      'peer-a': { name: 'Alice', vote: null },
      'peer-b': { name: 'Bob', vote: null }
    })
  })

  it('returns a new object rather than mutating the input', () => {
    const peers: Record<string, PeerInfo> = { 'peer-a': { name: 'Alice', vote: '5' } }
    const result = clearPeerVotes(peers)

    expect(result).not.toBe(peers)
    expect(peers['peer-a'].vote).toBe('5')
  })

  it('handles an empty map', () => {
    expect(clearPeerVotes({})).toEqual({})
  })
})

describe('nextConnectionState', () => {
  it('peerJoin promotes a connecting room to ready', () => {
    expect(nextConnectionState('connecting', 'peerJoin')).toBe('ready')
  })

  it('peerJoin promotes a failed room to ready (a live peer proves the room works)', () => {
    expect(nextConnectionState('failed', 'peerJoin')).toBe('ready')
  })

  it('peerJoin leaves an already-ready room as ready', () => {
    expect(nextConnectionState('ready', 'peerJoin')).toBe('ready')
  })

  it('joinError never downgrades a ready room', () => {
    expect(nextConnectionState('ready', 'joinError')).toBe('ready')
  })

  it('joinError fails a connecting room', () => {
    expect(nextConnectionState('connecting', 'joinError')).toBe('failed')
  })

  it('joinError leaves an already-failed room as failed', () => {
    expect(nextConnectionState('failed', 'joinError')).toBe('failed')
  })
})

describe('prunePeers', () => {
  const alice: PeerInfo = { name: 'Alice', vote: '5' }
  const bob: PeerInfo = { name: 'Bob', vote: null }

  it('removes peers that are no longer live and keeps the rest', () => {
    const result = prunePeers({ 'peer-a': alice, 'peer-b': bob }, ['peer-a'])

    expect(result.peers).toEqual({ 'peer-a': alice })
    expect(result.removedIds).toEqual(['peer-b'])
  })

  it('keeps all peers untouched when every peer is still live', () => {
    const peers = { 'peer-a': alice, 'peer-b': bob }
    const result = prunePeers(peers, ['peer-a', 'peer-b'])

    expect(result.peers).toEqual(peers)
    expect(result.removedIds).toEqual([])
  })

  it('is idempotent: pruning an already-pruned map removes nothing further', () => {
    const once = prunePeers({ 'peer-a': alice, 'peer-b': bob }, ['peer-a'])
    const twice = prunePeers(once.peers, ['peer-a'])

    expect(twice.peers).toEqual(once.peers)
    expect(twice.removedIds).toEqual([])
  })
})
