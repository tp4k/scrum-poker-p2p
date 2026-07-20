<script lang="ts">
  interface Props {
    cards: string[]
    selected: string | null
    onVote: (card: string) => void
  }

  const { cards, selected, onVote }: Props = $props()

  const LABEL_LENGTH_MEDIUM = 3
  const LABEL_LENGTH_LONG = 4

  function labelSizeClass(label: string): string {
    if (label.length >= LABEL_LENGTH_LONG) return 'label-sm'
    if (label.length === LABEL_LENGTH_MEDIUM) return 'label-md'
    return ''
  }
</script>

<div class="card-picker">
  {#each cards as card (card)}
    <button
      type="button"
      class="card {labelSizeClass(card)}"
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

  .card.label-md {
    font-size: var(--font-size-card-md);
  }

  .card.label-sm {
    font-size: var(--font-size-card-sm);
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
