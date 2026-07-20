<script lang="ts">
  import { labelSizeClass } from './lib/deck'

  export interface BoardPeer {
    name: string
    vote: string | null
  }

  interface Props {
    peers: Record<string, BoardPeer>
    selfId: string
    selfName: string
    localVote: string | null
    revealed: boolean
    average: number | null
    onReveal: () => void
    onNewRound: () => void
  }

  const { peers, selfId, selfName, localVote, revealed, average, onReveal, onNewRound }: Props =
    $props()

  const AVERAGE_DECIMAL_PLACES = 1
  const EMPTY_AVERAGE_GLYPH = '–'
  const VOTED_GLYPH = '✓'
  const NOT_VOTED_GLYPH = '…'

  interface BoardRow {
    id: string
    name: string
    vote: string | null
    isSelf: boolean
  }

  const rows = $derived<BoardRow[]>([
    { id: selfId, name: selfName, vote: localVote, isSelf: true },
    ...Object.entries(peers).map(([id, peer]) => ({
      id,
      name: peer.name,
      vote: peer.vote,
      isSelf: false
    }))
  ])

  const voteCount = $derived(rows.filter((row) => row.vote !== null).length)
  const revealDisabled = $derived(voteCount === 0)

  function formatAverage(value: number | null, isRevealed: boolean): string {
    if (!isRevealed || value === null) return EMPTY_AVERAGE_GLYPH
    return value.toFixed(AVERAGE_DECIMAL_PLACES)
  }

  function displayLabel(row: BoardRow): string {
    if (row.vote === null) return NOT_VOTED_GLYPH
    return revealed ? row.vote : VOTED_GLYPH
  }
</script>

<section class="board">
  <ul class="peers">
    {#each rows as row (row.id)}
      <li class="peer" class:self-row={row.isSelf}>
        <span class="peer-name">{row.name}</span>
        <span
          class="peer-vote {labelSizeClass(displayLabel(row))}"
          class:card-back={row.vote !== null && !revealed}
          class:mini-card={row.vote !== null && revealed}
        >
          {displayLabel(row)}
        </span>
      </li>
    {/each}
  </ul>

  <div class="average">Average: <span>{formatAverage(average, revealed)}</span></div>
  <div class="controls">
    <button type="button" onclick={onReveal} disabled={revealDisabled}>Reveal</button>
    <button type="button" onclick={onNewRound}>New Round</button>
  </div>
</section>

<style>
  .board {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .peers {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .peer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    min-height: calc(var(--size-vote-indicator-h) + var(--space-3) * 2 + 2px);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius);
    border: 1px solid var(--color-border);
    border-left: 3px solid transparent;
    background: var(--color-surface);
  }

  .peer.self-row {
    border-left-color: var(--color-accent);
    background: var(--color-surface-elevated);
  }

  .peer-name {
    color: var(--color-text-primary);
    font-size: var(--font-size-base);
  }

  .peer-vote {
    color: var(--color-text-secondary);
    font-weight: 600;
    min-width: var(--size-vote-indicator-w);
    height: var(--size-vote-indicator-h);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-vote);
  }

  .peer-vote.label-md {
    font-size: var(--font-size-vote-md);
  }

  .peer-vote.label-sm {
    font-size: var(--font-size-vote-sm);
  }

  .peer-vote.card-back {
    padding: 0 var(--space-2);
    border-radius: calc(var(--radius) * 0.6);
    border: 1px solid var(--color-accent-strong);
    background: var(--color-accent);
    color: var(--color-accent-text);
  }

  .peer-vote.mini-card {
    color: var(--color-text-primary);
  }

  .average {
    font-size: var(--font-size-lg);
    color: var(--color-text-primary);
  }

  .controls {
    display: flex;
    gap: var(--space-3);
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
    transition:
      border-color var(--transition-fast),
      transform var(--transition-fast);
  }

  button:hover:not(:disabled) {
    border-color: var(--color-border-strong);
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
