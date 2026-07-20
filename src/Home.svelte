<script lang="ts">
  import { PRESETS, encodeDeck } from './lib/deck'
  import { buildRoomHash, newSlug } from './lib/router'

  const RECENT_ROOMS_STORAGE_KEY = 'poker.recentRooms'
  const RECENT_ROOMS_CAP = 8

  type DeckChoice = 'fib' | 'tshirt' | 'frac' | 'custom'

  interface RecentRoom {
    slug: string
    deck: string
    deckLabel?: string
    visitedAt: number
  }

  let deckChoice: DeckChoice = $state('fib')
  let customDeckInput = $state('')

  function readRecentRooms(): RecentRoom[] {
    try {
      const raw = localStorage.getItem(RECENT_ROOMS_STORAGE_KEY)
      if (raw === null) return []
      const parsed = JSON.parse(raw) as RecentRoom[]
      return parsed.slice(0, RECENT_ROOMS_CAP)
    } catch {
      return []
    }
  }

  const recentRooms: RecentRoom[] = readRecentRooms()

  function selectedCards(): string[] {
    if (deckChoice === 'fib') return PRESETS.fib
    if (deckChoice === 'tshirt') return PRESETS.tshirt
    if (deckChoice === 'frac') return PRESETS.frac
    return customDeckInput
      .split(',')
      .map((card) => card.trim())
      .filter((card) => card !== '')
  }

  function createRoom(): void {
    const cards = selectedCards()
    if (cards.length === 0) return
    const slug = newSlug()
    const deckCode = encodeDeck(cards)
    location.hash = buildRoomHash(slug, deckCode)
  }

  function openRecentRoom(entry: RecentRoom): void {
    location.hash = buildRoomHash(entry.slug, entry.deck)
  }

  function formatVisitedAt(timestamp: number): string {
    return new Date(timestamp).toLocaleString()
  }
</script>

<main>
  <h1>Scrum Poker</h1>

  <section class="deck-picker">
    <h2>Choose a deck</h2>
    <label>
      <input type="radio" bind:group={deckChoice} value="fib" />
      Fibonacci
    </label>
    <label>
      <input type="radio" bind:group={deckChoice} value="tshirt" />
      T-shirt
    </label>
    <label>
      <input type="radio" bind:group={deckChoice} value="frac" />
      Fractional (0.1–2)
    </label>
    <label>
      <input type="radio" bind:group={deckChoice} value="custom" />
      Custom
    </label>
    {#if deckChoice === 'custom'}
      <input
        type="text"
        class="custom-deck-input"
        placeholder="e.g. 1,2,3,5,8"
        bind:value={customDeckInput}
      />
    {/if}
    <button type="button" onclick={createRoom}>Create</button>
  </section>

  {#if recentRooms.length > 0}
    <section class="recent-rooms">
      <h2>Recent rooms</h2>
      <ul>
        {#each recentRooms as entry (entry.slug)}
          <li>
            <button type="button" class="recent-room" onclick={() => openRecentRoom(entry)}>
              <span class="recent-room-slug">{entry.slug}</span>
              <span class="recent-room-deck">{entry.deckLabel ?? entry.deck}</span>
              <span class="recent-room-date">{formatVisitedAt(entry.visitedAt)}</span>
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</main>

<style>
  main {
    max-width: 42rem;
    margin: 0 auto;
    padding: var(--space-6) var(--space-5);
    color: var(--color-text-primary);
    font-family: var(--font-family-base);
  }

  h1 {
    font-size: var(--font-size-xl);
    margin: 0 0 var(--space-6);
  }

  h2 {
    font-size: var(--font-size-lg);
    margin: 0 0 var(--space-4);
  }

  section {
    margin-bottom: var(--space-6);
  }

  label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
    font-size: var(--font-size-base);
  }

  .custom-deck-input {
    display: block;
    width: 100%;
    min-height: 2.5rem;
    margin: var(--space-3) 0;
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

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .recent-room {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-3) var(--space-4);
    text-align: left;
  }

  .recent-room-slug {
    flex-shrink: 0;
    color: var(--color-text-primary);
  }

  .recent-room-deck {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: var(--color-text-secondary);
  }

  .recent-room-date {
    flex-shrink: 0;
    color: var(--color-text-secondary);
    font-size: var(--font-size-secondary);
  }
</style>
