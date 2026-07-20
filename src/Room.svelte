<script lang="ts">
  import { onDestroy, onMount, untrack } from 'svelte'
  import { decodeDeck, PRESETS } from './lib/deck'
  import { createRoom, type ConnectionState, type PeerInfo, type RoomHandle } from './lib/room'
  import Board from './Board.svelte'
  import CardPicker from './CardPicker.svelte'

  interface Props {
    slug: string
    deck: string
  }

  const { slug, deck }: Props = $props()

  const NAME_STORAGE_KEY = 'poker.name'
  const RECENT_ROOMS_STORAGE_KEY = 'poker.recentRooms'
  const RECENT_ROOMS_CAP = 8

  interface RecentRoom {
    slug: string
    deck: string
    deckLabel: string
    visitedAt: number
  }

  const deckCards = untrack(() => decodeDeck(deck))

  function labelForDeck(cards: string[]): string {
    const joined = cards.join(',')
    if (joined === PRESETS.fib.join(',')) return 'Fibonacci'
    if (joined === PRESETS.tshirt.join(',')) return 'T-shirt'
    if (joined === PRESETS.frac.join(',')) return 'Fractional'
    return joined
  }

  let room: RoomHandle | null = null
  const unsubs: Array<() => void> = []

  function safeGetItem(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  }

  function safeSetItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value)
    } catch {
      // storage unavailable (e.g. private browsing); degrade to in-memory
    }
  }

  let name = $state(safeGetItem(NAME_STORAGE_KEY) ?? '')
  let nameInput = $state(untrack(() => name))
  let hasName = $state(untrack(() => name !== ''))

  let selfId = $state('')
  let connectionState: ConnectionState = $state('connecting')
  let peers: Record<string, PeerInfo> = $state({})
  const statusText = $derived(connectionLabel(connectionState, Object.keys(peers).length))
  let localVote: string | null = $state(null)
  let revealed = $state(false)
  let average: number | null = $state(null)

  function saveRecentRoom(): void {
    const raw = safeGetItem(RECENT_ROOMS_STORAGE_KEY)
    let existing: RecentRoom[] = []
    if (raw !== null) {
      try {
        existing = JSON.parse(raw) as RecentRoom[]
      } catch {
        existing = []
      }
    }
    const withoutCurrent = existing.filter((entry) => entry.slug !== slug)
    const next = [
      { slug, deck, deckLabel: labelForDeck(deckCards), visitedAt: Date.now() },
      ...withoutCurrent
    ].slice(0, RECENT_ROOMS_CAP)
    safeSetItem(RECENT_ROOMS_STORAGE_KEY, JSON.stringify(next))
  }

  onMount(() => {
    const handle = createRoom(slug, deck, deckCards)
    room = handle
    selfId = handle.selfId
    unsubs.push(handle.connection.subscribe((value) => (connectionState = value)))
    unsubs.push(handle.peers.subscribe((value) => (peers = value)))
    unsubs.push(handle.localVote.subscribe((value) => (localVote = value)))
    unsubs.push(handle.revealed.subscribe((value) => (revealed = value)))
    unsubs.push(handle.average.subscribe((value) => (average = value)))
    if (hasName) {
      handle.setName(name)
    }
    saveRecentRoom()
  })

  onDestroy(() => {
    unsubs.forEach((unsub) => unsub())
    room?.leave()
  })

  function submitName(event: SubmitEvent): void {
    event.preventDefault()
    const trimmed = nameInput.trim()
    if (trimmed === '') return
    name = trimmed
    hasName = true
    safeSetItem(NAME_STORAGE_KEY, trimmed)
    room?.setName(trimmed)
  }

  function connectionLabel(state: ConnectionState, peerCount: number): string {
    if (state === 'connecting') return 'Connecting…'
    if (state === 'ready') {
      return peerCount === 0 ? 'Waiting for teammates — share the link' : ''
    }
    return 'Connection failed'
  }
</script>

<main>
  {#if !hasName}
    <form onsubmit={submitName}>
      <label for="name-input">Your name</label>
      <input id="name-input" type="text" placeholder="e.g. Alex" bind:value={nameInput} />
      <button type="submit">Join room</button>
    </form>
  {:else}
    <div class="room-header">
      <span
        class="room-slug"
        style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace;"
      >
        {slug}
      </span>
      <span class="status {connectionState}" role="status">
        <span
          class="status-dot"
          aria-label={statusText === '' ? 'Connected' : undefined}
        ></span>
        {#if statusText !== ''}
          {statusText}
        {/if}
      </span>
    </div>
    <CardPicker cards={deckCards} selected={localVote} onVote={(card) => room?.vote(card)} />
    <Board
      {peers}
      {selfId}
      selfName={name}
      {localVote}
      {revealed}
      {average}
      onReveal={() => room?.reveal()}
      onNewRound={() => room?.newRound()}
    />
  {/if}
</main>

<style>
  main {
    max-width: 42rem;
    margin: 0 auto;
    padding: var(--space-6) var(--space-5);
    color: var(--color-text-primary);
    font-family: var(--font-family-base);
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  label {
    font-size: var(--font-size-base);
  }

  input {
    min-height: 2.5rem;
    padding: var(--space-3);
    border-radius: var(--radius);
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text-primary);
    font-size: var(--font-size-base);
  }

  button {
    min-height: 2.5rem;
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius);
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text-primary);
    font-size: var(--font-size-base);
    cursor: pointer;
    transition: border-color var(--transition-fast);
  }

  button:hover {
    border-color: var(--color-border-strong);
  }

  .room-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .room-slug {
    font-size: var(--font-size-lg);
    font-weight: 600;
  }

  .status {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-size-secondary);
    color: var(--color-text-secondary);
  }

  .status-dot {
    width: var(--size-status-dot);
    height: var(--size-status-dot);
    border-radius: 50%;
  }

  .status.connecting .status-dot {
    background: var(--color-warn-text);
  }

  .status.ready .status-dot {
    background: var(--color-success-text);
  }

  .status.failed .status-dot {
    background: var(--color-danger-text);
  }

  @media (prefers-reduced-motion: no-preference) {
    .status.connecting .status-dot {
      animation: status-dot-pulse var(--duration-status-pulse) ease-in-out infinite;
    }
  }

  @keyframes status-dot-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.35;
    }
  }
</style>
