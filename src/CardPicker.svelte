<script lang="ts">
  import { isFractionalCard } from './lib/deck'

  interface Props {
    cards: string[]
    selected: string | null
    onVote: (card: string) => void
  }

  const { cards, selected, onVote }: Props = $props()
</script>

<div class="card-picker">
  {#each cards as card (card)}
    <button
      type="button"
      class="card"
      class:label-fraction={isFractionalCard(card)}
      class:selected={card === selected}
      aria-pressed={card === selected}
      onclick={() => onVote(card)}
    >
      {card}
    </button>
  {/each}
</div>

<style>
  .card-picker {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  .card {
    min-width: var(--size-card-min-w);
    width: auto;
    height: var(--size-card-h);
    padding: var(--space-2);
    border-radius: var(--radius);
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text-primary);
    font-size: var(--font-size-card);
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition:
      transform var(--transition-fast),
      border-color var(--transition-fast),
      background var(--transition-fast);
  }

  .card.label-fraction {
    font-size: var(--font-size-card-fraction);
  }

  .card:hover {
    border-color: var(--color-border-strong);
    transform: translateY(-0.2rem);
  }

  .card.selected {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: var(--color-accent-text);
  }
</style>
