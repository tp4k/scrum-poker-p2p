<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import { decodeDeck } from './lib/deck'
  import { createRoom, type ConnectionState, type RoomHandle } from './lib/room'

  const DIAG_ROOM_SLUG = 'diag'
  const DIAG_DECK_CODE = 'fib'

  const READY_STATE_LABELS: Record<number, string> = {
    [WebSocket.CONNECTING]: 'connecting…',
    [WebSocket.OPEN]: 'open',
    [WebSocket.CLOSING]: 'closing…',
    [WebSocket.CLOSED]: 'closed'
  }

  let room: RoomHandle | null = null
  const unsubs: Array<() => void> = []

  let selfId = $state('')
  let connectionState: ConnectionState = $state('connecting')
  let relaySockets: Record<string, WebSocket> = $state({})
  let peerLog: string[] = $state([])

  onMount(() => {
    const cards = decodeDeck(DIAG_DECK_CODE)
    const handle = createRoom(DIAG_ROOM_SLUG, DIAG_DECK_CODE, cards, { keepPolling: true })
    room = handle
    selfId = handle.selfId
    unsubs.push(handle.connection.subscribe((value) => (connectionState = value)))
    unsubs.push(handle.relaySockets.subscribe((value) => (relaySockets = value)))
    unsubs.push(handle.peerLog.subscribe((value) => (peerLog = value)))
  })

  onDestroy(() => {
    unsubs.forEach((unsub) => unsub())
    room?.leave()
  })

  const READY_STATE_CLASSES: Record<number, string> = {
    [WebSocket.CONNECTING]: 'connecting',
    [WebSocket.OPEN]: 'open',
    [WebSocket.CLOSING]: 'closing',
    [WebSocket.CLOSED]: 'closed'
  }

  function readyStateLabel(socket: WebSocket): string {
    return READY_STATE_LABELS[socket.readyState] ?? 'unknown'
  }

  function readyStateClass(socket: WebSocket): string {
    return READY_STATE_CLASSES[socket.readyState] ?? 'unknown'
  }
</script>

<main>
  <h1>Diagnostics</h1>
  <p>Diagnostic room: {DIAG_ROOM_SLUG} (deck {DIAG_DECK_CODE})</p>
  <p>Self ID: {selfId}</p>
  <p class="connection {connectionState}">Connection: {connectionState}</p>

  <h2>Relay sockets</h2>
  {#if Object.keys(relaySockets).length === 0}
    <p>No relay sockets yet.</p>
  {:else}
    <ul class="relay-sockets">
      {#each Object.entries(relaySockets) as [url, socket] (url)}
        <li class="relay-socket {readyStateClass(socket)}">
          <span class="relay-url">{url}</span>
          <span class="relay-state">{readyStateLabel(socket)}</span>
        </li>
      {/each}
    </ul>
  {/if}

  <h2>Peer log</h2>
  {#if peerLog.length === 0}
    <p>No peer events yet.</p>
  {:else}
    <ul class="peer-log">
      {#each peerLog as entry, index (index)}
        <li>{entry}</li>
      {/each}
    </ul>
  {/if}
</main>

<style>
  main {
    max-width: 44rem;
    margin: 0 auto;
    padding: var(--space-6) var(--space-5);
    color: var(--color-text-primary);
    font-family: var(--font-family-base);
  }

  h1 {
    font-size: var(--font-size-xl);
    margin: 0 0 var(--space-5);
  }

  h2 {
    font-size: var(--font-size-lg);
    margin: var(--space-6) 0 var(--space-3);
  }

  p {
    margin: 0 0 var(--space-2);
  }

  .connection {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius);
    width: fit-content;
  }

  .connection.connecting {
    background: var(--color-warn-bg);
    color: var(--color-warn-text);
  }

  .connection.ready {
    background: var(--color-success-bg);
    color: var(--color-success-text);
  }

  .connection.failed {
    background: var(--color-danger-bg);
    color: var(--color-danger-text);
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .relay-socket,
  .peer-log li {
    display: flex;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius);
    background: var(--color-surface);
    color: var(--color-text-primary);
    font-family: ui-monospace, monospace;
    font-size: var(--font-size-secondary);
  }

  .relay-socket.open {
    color: var(--color-success-text);
  }

  .relay-socket.closed {
    color: var(--color-danger-text);
  }
</style>
