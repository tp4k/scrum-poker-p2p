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

  it('label font scale: long labels get a smaller-font class, short ones do not', () => {
    render(CardPicker, { cards: ['5', '100', '0.25'], selected: null, onVote: vi.fn() })

    expect(screen.getByRole('button', { name: '5' })).not.toHaveClass('label-md', 'label-sm')
    expect(screen.getByRole('button', { name: '100' })).toHaveClass('label-md')
    expect(screen.getByRole('button', { name: '100' })).not.toHaveClass('label-sm')
    expect(screen.getByRole('button', { name: '0.25' })).toHaveClass('label-sm')
    expect(screen.getByRole('button', { name: '0.25' })).not.toHaveClass('label-md')
  })
})
