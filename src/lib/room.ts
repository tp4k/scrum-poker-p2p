import { derived, get, writable, type Readable, type Writable } from 'svelte/store'
import { joinRoom, getRelaySockets, selfId, type JsonValue } from 'trystero'
import { average as averageCards, isNumericCard } from './deck'

const APP_ID = 'scrumpoker-online-mighty-thimble'
const STATE_ACTION_NAMESPACE = 'state'
const CONNECTION_POLL_INTERVAL_MS = 1000
const CONNECTION_FAIL_TIMEOUT_MS = 15000
const PEER_LOG_CAP = 200
const PEER_RECONCILE_INTERVAL_MS = 10_000
export const MAX_ROUND = 1_000_000
export const MAX_NAME_LENGTH = 64
export const MAX_VOTE_LENGTH = 16

export interface PeerInfo {
  name: string
  vote: string | null
}

export type ConnectionState = 'connecting' | 'ready' | 'failed'

export interface PeerState {
  [key: string]: JsonValue
  name: string
  vote: string | null
  round: number
  revealed: boolean
}

export interface RemoteMessage extends PeerState {
  peerId: string
}

export interface LocalRoomState {
  peers: Record<string, PeerInfo>
  round: number
  revealed: boolean
  localVote: string | null
}

export interface ApplyRemoteResult {
  state: LocalRoomState
  resendTo: string | null
}

export type ConnectionEvent = 'peerJoin' | 'joinError'

export interface PrunePeersResult {
  peers: Record<string, PeerInfo>
  removedIds: string[]
}

function appendLogEntry(log: string[], entry: string): string[] {
  const next = [...log, entry]
  return next.length > PEER_LOG_CAP ? next.slice(next.length - PEER_LOG_CAP) : next
}

function isValidRound(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_ROUND
}

function sanitizeName(name: unknown): string {
  return String(name).slice(0, MAX_NAME_LENGTH)
}

function sanitizeVote(vote: unknown): string | null {
  return vote == null ? null : String(vote).slice(0, MAX_VOTE_LENGTH)
}

export function clearPeerVotes(peers: Record<string, PeerInfo>): Record<string, PeerInfo> {
  return Object.fromEntries(
    Object.entries(peers).map(([id, peer]) => [id, { ...peer, vote: null }])
  )
}

export function applyRemoteState(local: LocalRoomState, msg: RemoteMessage): ApplyRemoteResult {
  const { peerId, name, vote, round: msgRound, revealed: msgRevealed } = msg

  if (!isValidRound(msgRound)) {
    return { state: local, resendTo: null }
  }

  const revealed = Boolean(msgRevealed)
  const peerInfo: PeerInfo = { name: sanitizeName(name), vote: sanitizeVote(vote) }

  if (msgRound > local.round) {
    return {
      state: {
        peers: { ...clearPeerVotes(local.peers), [peerId]: peerInfo },
        round: msgRound,
        revealed,
        localVote: null
      },
      resendTo: null
    }
  }

  if (msgRound === local.round) {
    return {
      state: {
        peers: { ...local.peers, [peerId]: peerInfo },
        round: local.round,
        revealed: local.revealed || revealed,
        localVote: local.localVote
      },
      resendTo: null
    }
  }

  return {
    state: local,
    resendTo: peerId
  }
}

// peerJoin always promotes to 'ready'; joinError only fails while still 'connecting'.
export function nextConnectionState(
  current: ConnectionState,
  event: ConnectionEvent
): ConnectionState {
  if (event === 'peerJoin') return 'ready'
  return current === 'connecting' ? 'failed' : current
}

export function prunePeers(
  peers: Record<string, PeerInfo>,
  liveIds: readonly string[]
): PrunePeersResult {
  const liveIdSet = new Set(liveIds)
  const removedIds = Object.keys(peers).filter((peerId) => !liveIdSet.has(peerId))

  if (removedIds.length === 0) {
    return { peers, removedIds }
  }

  const next = { ...peers }
  removedIds.forEach((peerId) => delete next[peerId])
  return { peers: next, removedIds }
}

export interface RoomHandle {
  peers: Writable<Record<string, PeerInfo>>
  localVote: Writable<string | null>
  round: Writable<number>
  revealed: Writable<boolean>
  connection: Writable<ConnectionState>
  average: Readable<number | null>
  everyoneVoted: Readable<boolean>
  selfId: string
  relaySockets: Writable<Record<string, WebSocket>>
  peerLog: Writable<string[]>
  vote: (card: string) => void
  reveal: () => void
  newRound: () => void
  leave: () => void
  setName: (name: string) => void
}

export interface RoomOptions {
  keepPolling?: boolean
}

export function createRoom(
  slug: string,
  deckCode: string,
  deckCards: string[],
  options: RoomOptions = {}
): RoomHandle {
  void deckCards
  const { keepPolling = false } = options

  const roomId = `${slug}:${deckCode}`
  const joinedAt = Date.now()
  let name = ''

  const peers: Writable<Record<string, PeerInfo>> = writable({})
  const localVote: Writable<string | null> = writable(null)
  const round: Writable<number> = writable(0)
  const revealed: Writable<boolean> = writable(false)
  const connection: Writable<ConnectionState> = writable('connecting')
  const relaySockets: Writable<Record<string, WebSocket>> = writable({})
  const peerLog: Writable<string[]> = writable([])

  const average: Readable<number | null> = derived([peers, localVote], ([$peers, $localVote]) => {
    const votes = Object.values($peers)
      .map((peer) => peer.vote)
      .filter((vote): vote is string => vote !== null)
    if ($localVote !== null) votes.push($localVote)
    return averageCards(votes.filter(isNumericCard))
  })

  const everyoneVoted: Readable<boolean> = derived([peers, localVote], ([$peers, $localVote]) => {
    if ($localVote === null) return false
    return Object.values($peers).every((peer) => peer.vote !== null)
  })

  function readLocal(): LocalRoomState {
    return {
      peers: get(peers),
      round: get(round),
      revealed: get(revealed),
      localVote: get(localVote)
    }
  }

  function writeLocal(state: LocalRoomState): void {
    peers.set(state.peers)
    round.set(state.round)
    revealed.set(state.revealed)
    localVote.set(state.localVote)
  }

  function selfPeerState(): PeerState {
    const local = readLocal()
    return { name, vote: local.localVote, round: local.round, revealed: local.revealed }
  }

  const room = joinRoom({ appId: APP_ID }, roomId, {
    onJoinError: (details) => {
      peerLog.update((log) => appendLogEntry(log, `onJoinError:${details.peerId}:${details.error}`))
      connection.update((current) => nextConnectionState(current, 'joinError'))
    }
  })

  const stateAction = room.makeAction<PeerState>(STATE_ACTION_NAMESPACE)

  stateAction.onMessage = (data, { peerId }) => {
    const result = applyRemoteState(readLocal(), { ...data, peerId })
    writeLocal(result.state)
    if (result.resendTo !== null) {
      void stateAction.send(selfPeerState(), { target: result.resendTo })
    }
  }

  room.onPeerJoin = (peerId) => {
    peerLog.update((log) => appendLogEntry(log, `join:${peerId}`))
    void stateAction.send(selfPeerState(), { target: peerId })
    connection.update((current) => nextConnectionState(current, 'peerJoin'))
  }

  room.onPeerLeave = (peerId) => {
    peerLog.update((log) => appendLogEntry(log, `leave:${peerId}`))
    peers.update((current) => {
      const next = { ...current }
      delete next[peerId]
      return next
    })
  }

  const reconcileTimer = setInterval(() => {
    const liveIds = Object.keys(room.getPeers())
    const result = prunePeers(get(peers), liveIds)
    if (result.removedIds.length === 0) return
    peers.set(result.peers)
    result.removedIds.forEach((peerId) => {
      peerLog.update((log) => appendLogEntry(log, `prune:${peerId}`))
    })
  }, PEER_RECONCILE_INTERVAL_MS)

  const pollTimer = setInterval(() => {
    const sockets = getRelaySockets() as Record<string, WebSocket>
    relaySockets.set(sockets)
    if (get(connection) === 'connecting') {
      const anyOpen = Object.values(sockets).some((socket) => socket.readyState === WebSocket.OPEN)
      if (anyOpen) {
        connection.set('ready')
      } else if (Date.now() - joinedAt >= CONNECTION_FAIL_TIMEOUT_MS) {
        connection.set('failed')
      }
    }
    if (!keepPolling && get(connection) !== 'connecting') {
      clearInterval(pollTimer)
    }
  }, CONNECTION_POLL_INTERVAL_MS)

  function vote(card: string): void {
    if (get(revealed)) return
    localVote.set(card)
    void stateAction.send(selfPeerState())
  }

  function reveal(): void {
    revealed.set(true)
    void stateAction.send(selfPeerState())
  }

  function newRound(): void {
    round.update((r) => r + 1)
    revealed.set(false)
    localVote.set(null)
    peers.update(clearPeerVotes)
    void stateAction.send(selfPeerState())
  }

  function leave(): void {
    clearInterval(pollTimer)
    clearInterval(reconcileTimer)
    void room.leave()
  }

  function setName(newName: string): void {
    name = newName
    void stateAction.send(selfPeerState())
  }

  return {
    peers,
    localVote,
    round,
    revealed,
    connection,
    average,
    everyoneVoted,
    selfId,
    relaySockets,
    peerLog,
    vote,
    reveal,
    newRound,
    leave,
    setName
  }
}
