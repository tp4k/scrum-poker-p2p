import { render, fireEvent, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import CardPicker from './CardPicker.svelte'

describe('CardPicker', () => {
  it('selection highlight: clicking a card marks it selected and invokes the vote callback', async () => {
    const onVote = vi.fn()
    render(CardPicker, { cards: ['1', '2', '3'], selected: null, onVote })

    const cardTwo = screen.getByRole('button', { name: '2' })
    await fireEvent.click(cardTwo)

    expect(onVote).toHaveBeenCalledWith('2')
    expect(onVote).toHaveBeenCalledTimes(1)
  })

  it('selection highlight: only the selected card is marked pressed', () => {
    render(CardPicker, { cards: ['1', '2', '3'], selected: '2', onVote: vi.fn() })

    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '3' })).toHaveAttribute('aria-pressed', 'false')
  })
})
