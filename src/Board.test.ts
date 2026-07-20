import { render } from '@testing-library/svelte'
import type { ComponentProps } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import Board from './Board.svelte'

type BoardProps = ComponentProps<typeof Board>

function baseProps(overrides: Partial<BoardProps> = {}): BoardProps {
  return {
    peers: {},
    selfId: 'self-1',
    selfName: 'Alice',
    localVote: null,
    revealed: false,
    average: null,
    onReveal: vi.fn(),
    onNewRound: vi.fn(),
    ...overrides
  }
}

describe('Board', () => {
  it('Reveal disabled at zero votes', () => {
    const zeroVotes = render(Board, baseProps({ peers: { p1: { name: 'Bob', vote: null } } }))
    expect(zeroVotes.getByRole('button', { name: 'Reveal' })).toBeDisabled()
    zeroVotes.unmount()

    const oneVote = render(Board, baseProps({ peers: { p1: { name: 'Bob', vote: '5' } } }))
    expect(oneVote.getByRole('button', { name: 'Reveal' })).toBeEnabled()
  })

  it('average formatting', () => {
    const whole = render(Board, baseProps({ average: 4, revealed: true }))
    expect(whole.getByText('4.0')).toBeInTheDocument()
    whole.unmount()

    const rounded = render(Board, baseProps({ average: 4.666666, revealed: true }))
    expect(rounded.getByText('4.7')).toBeInTheDocument()
    rounded.unmount()

    const empty = render(Board, baseProps({ average: null, revealed: true }))
    expect(empty.getByText('–')).toBeInTheDocument()
  })

  it('average hidden until reveal', () => {
    const hidden = render(Board, baseProps({ average: 4.666666, revealed: false }))
    expect(hidden.queryByText('4.7')).not.toBeInTheDocument()
    expect(hidden.getByText('–')).toBeInTheDocument()
  })

  it('own row is highlighted, no (you) text label', () => {
    const { getByText } = render(
      Board,
      baseProps({ peers: { p1: { name: 'Bob', vote: null } } })
    )

    const selfName = getByText('Alice')
    expect(selfName.textContent).toBe('Alice')
    expect(selfName.closest('.peer')).toHaveClass('self-row')

    const otherName = getByText('Bob')
    expect(otherName.closest('.peer')).not.toHaveClass('self-row')
  })

  it('votes hidden until reveal', () => {
    const hidden = render(
      Board,
      baseProps({ peers: { p1: { name: 'Bob', vote: '8' } }, revealed: false })
    )
    expect(hidden.queryByText('8')).not.toBeInTheDocument()
    expect(hidden.getByText('✓')).toBeInTheDocument()
    hidden.unmount()

    const shown = render(
      Board,
      baseProps({ peers: { p1: { name: 'Bob', vote: '8' } }, revealed: true })
    )
    expect(shown.getByText('8')).toBeInTheDocument()
  })

  it('mini-card label font scale: fractional revealed votes get a smaller-font class, integers do not', () => {
    const short = render(
      Board,
      baseProps({ peers: { p1: { name: 'Bob', vote: '5' } }, revealed: true })
    )
    expect(short.getByText('5')).not.toHaveClass('label-fraction')
    short.unmount()

    const medium = render(
      Board,
      baseProps({ peers: { p1: { name: 'Bob', vote: '100' } }, revealed: true })
    )
    expect(medium.getByText('100')).not.toHaveClass('label-fraction')
    medium.unmount()

    const fraction = render(
      Board,
      baseProps({ peers: { p1: { name: 'Bob', vote: '0.25' } }, revealed: true })
    )
    expect(fraction.getByText('0.25')).toHaveClass('label-fraction')
  })
})
