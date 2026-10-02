import { describe, expect, it } from 'vitest'
import { HUNG_QUEEN_PGN, SCHOLARS_MATE_PGN } from '../test/fixtures'
import { openingName, parseClock, parsePgn, parseTimeControl } from './pgn'

describe('parsePgn', () => {
  it('reads moves, FENs and move numbers from a Chess.com PGN', () => {
    const { headers, moves } = parsePgn(SCHOLARS_MATE_PGN)
    expect(headers.Black).toBe('testplayer')
    expect(moves.map((m) => m.san)).toEqual(['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#'])
    expect(moves[5]).toMatchObject({ ply: 6, moveNumber: 3, color: 'b', uci: 'g8f6' })
    expect(moves[6].fenBefore).toBe(moves[5].fenAfter)
  })

  it('derives time spent from clocks, including the increment', () => {
    const { moves } = parsePgn(HUNG_QUEEN_PGN)
    // 10+5: White starts on 600s; after 1. e4 the clock reads 603 (spent 2s, +5 increment).
    expect(moves[0].clock).toBe(603)
    expect(moves[0].timeSpent).toBe(2)
    // 3. Qxe5+ : 601 -> 604 with +5 => 2s spent.
    expect(moves[4].timeSpent).toBe(2)
    // 4. d4 : 604 -> 570 => 39s spent.
    expect(moves[6].timeSpent).toBe(39)
  })

  it('leaves clocks undefined when the PGN has none', () => {
    const { moves } = parsePgn('1. e4 e5 2. Nf3 *')
    expect(moves[0].clock).toBeUndefined()
    expect(moves[0].timeSpent).toBeUndefined()
  })
})

describe('helpers', () => {
  it('parses clocks and time controls', () => {
    expect(parseClock('0:09:58.5')).toBeCloseTo(598.5)
    expect(parseClock('1:00')).toBe(60)
    expect(parseTimeControl('600+5')).toEqual({ base: 600, increment: 5 })
    expect(parseTimeControl('1/86400')).toBeNull()
  })

  it('turns the ECO URL into a readable opening name', () => {
    expect(openingName(parsePgn(HUNG_QUEEN_PGN).headers)).toBe(
      'Kings Pawn Opening Wayward Queen Attack',
    )
  })
})
