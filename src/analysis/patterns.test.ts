import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { playUci } from '../chess/board'
import type { EngineLine } from '../engine/uci'
import { parsePgn, type ParsedMove } from '../lib/pgn'
import {
  allowedFork,
  allowedMate,
  detectLabels,
  earlyQueen,
  fPawn,
  gameNotes,
  hungPiece,
  missedFork,
  missedFreePiece,
  missedMate,
  rushed,
  samePieceTwice,
  type MoveContext,
} from './patterns'
import type { Grade, Score } from './winprob'

function move(fen: string, uci: string, extra: Partial<ParsedMove> = {}): ParsedMove {
  const chess = new Chess(fen)
  const played = playUci(chess, uci)
  if (!played) throw new Error(`illegal ${uci} in ${fen}`)
  return {
    ply: 1,
    moveNumber: Number(fen.split(' ')[5]),
    color: played.color,
    san: played.san,
    uci,
    fenBefore: fen,
    fenAfter: played.after,
    ...extra,
  }
}

const line = (score: Score, pv: string[]): EngineLine => ({ score, pv, depth: 12 })

function ctx(
  m: ParsedMove,
  before: EngineLine | undefined,
  after: EngineLine | undefined,
  grade: Grade,
  previous: ParsedMove[] = [],
): MoveContext {
  return { move: m, before, after, grade, previous }
}

/** Every move of a short PGN, each paired with the moves before it. */
function fromPgn(pgn: string) {
  const { moves } = parsePgn(pgn)
  return moves.map((m, i) => ({ move: m, previous: moves.slice(0, i) }))
}

describe('hungPiece', () => {
  const fen = '4k3/8/8/3p4/8/2N5/8/4K3 w - - 0 1'
  const ne4 = move(fen, 'c3e4')
  const before = line({ cp: 0 }, ['e1d2'])

  it('fires when the moved piece can simply be taken', () => {
    const label = hungPiece(ctx(ne4, before, line({ cp: -300 }, ['d5e4', 'e1d2']), 'blunder'))
    expect(label?.text).toBe('Hung your knight: after Ne4, dxe4 takes it.')
  })

  it('stays quiet when the opponent’s best reply does not win material', () => {
    expect(hungPiece(ctx(ne4, before, line({ cp: -300 }, ['e8d7']), 'blunder'))).toBeNull()
  })

  it('only explains real mistakes', () => {
    expect(hungPiece(ctx(ne4, before, line({ cp: -300 }, ['d5e4']), 'good'))).toBeNull()
  })
})

describe('missedFreePiece', () => {
  const fen = '4k3/8/8/3n4/8/2N5/8/4K3 w - - 0 1'
  const before = line({ cp: 300 }, ['c3d5', 'e8d7'])

  it('fires when a free capture was available and not taken', () => {
    const label = missedFreePiece(
      ctx(move(fen, 'e1d2'), before, line({ cp: 0 }, ['d5b4']), 'blunder'),
    )
    expect(label?.text).toBe('Missed a free knight: Nxd5 wins it.')
  })

  it('does not fire when the capture was played', () => {
    expect(
      missedFreePiece(ctx(move(fen, 'c3d5'), before, line({ cp: 300 }, ['e8d7']), 'best')),
    ).toBeNull()
  })
})

describe('mates', () => {
  const beforeQxf7 = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4'
  const mateInOne = line({ mate: 1 }, ['h5f7'])

  it('flags a missed mate in one', () => {
    const label = missedMate(
      ctx(move(beforeQxf7, 'h5e2'), mateInOne, line({ cp: -50 }, ['f6e4']), 'blunder'),
    )
    expect(label?.text).toBe('Missed checkmate: Qxf7# was mate in one.')
  })

  it('does not flag the mate when it is played', () => {
    expect(missedMate(ctx(move(beforeQxf7, 'h5f7'), mateInOne, undefined, 'best'))).toBeNull()
  })

  it('flags allowing a mate in one (Black, from White’s-view scores)', () => {
    const beforeNf6 = 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3'
    const label = allowedMate(
      ctx(move(beforeNf6, 'g8f6'), line({ cp: 30 }, ['g7g6']), mateInOne, 'blunder'),
    )
    expect(label?.text).toBe('Allowed checkmate: your opponent can play Qxf7#.')
  })
})

describe('forks', () => {
  it('flags allowing a knight fork of king and rook', () => {
    const m = move('4k3/8/8/8/1n6/8/4K3/R7 w - - 0 1', 'e2e1')
    const label = allowedFork(
      ctx(m, line({ cp: 0 }, ['a1a8']), line({ cp: -500 }, ['b4c2', 'e1d2', 'c2a1']), 'blunder'),
    )
    expect(label?.text).toMatch(/^Allowed a fork: Nc2\+ attacks your (rook and king|king and rook)/)
  })

  it('flags missing a knight fork', () => {
    const fen = 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1'
    const label = missedFork(
      ctx(
        move(fen, 'e1d2'),
        line({ cp: 500 }, ['b5c7', 'e8d7', 'c7a8']),
        line({ cp: 0 }, ['a8a1']),
        'blunder',
      ),
    )
    expect(label?.text).toMatch(/^Missed a fork: Nc7\+ would attack their/)
  })

  it('ignores a "fork" by a piece that can simply be captured', () => {
    // Same fork, but a black bishop on b8 guards c7.
    const fen = 'rb2k3/8/8/1N6/8/8/8/4K3 w - - 0 1'
    expect(
      missedFork(
        ctx(move(fen, 'e1d2'), line({ cp: 500 }, ['b5c7']), line({ cp: 0 }, []), 'blunder'),
      ),
    ).toBeNull()
  })
})

describe('rushed', () => {
  const fen = '4k3/8/8/3p4/8/2N5/8/4K3 w - - 0 1'
  it('flags a fast blunder with plenty of time left', () => {
    const m = move(fen, 'c3e4', { timeSpent: 2, clock: 420 })
    expect(rushed(ctx(m, undefined, undefined, 'blunder'))?.text).toMatch(
      /^Played in 2s with 7 minutes left/,
    )
  })
  it('allows fast moves in time trouble', () => {
    const m = move(fen, 'c3e4', { timeSpent: 2, clock: 60 })
    expect(rushed(ctx(m, undefined, undefined, 'blunder'))).toBeNull()
  })
})

describe('opening tips', () => {
  it('flags the first early queen move only', () => {
    const plies = fromPgn('1. e4 e5 2. Qh5 Nc6 3. Qf3 *')
    expect(
      earlyQueen(ctx(plies[2].move, undefined, undefined, 'good', plies[2].previous))?.kind,
    ).toBe('earlyQueen')
    expect(
      earlyQueen(ctx(plies[4].move, undefined, undefined, 'good', plies[4].previous)),
    ).toBeNull()
  })

  it('flags moving the same piece twice while others are undeveloped', () => {
    const plies = fromPgn('1. Nf3 d5 2. Ng5 *')
    expect(
      samePieceTwice(ctx(plies[2].move, undefined, undefined, 'inaccuracy', plies[2].previous))
        ?.kind,
    ).toBe('samePieceTwice')
    expect(
      samePieceTwice(ctx(plies[2].move, undefined, undefined, 'good', plies[2].previous)),
    ).toBeNull()
  })

  it('flags an early f-pawn push before castling', () => {
    const plies = fromPgn('1. e4 e5 2. f3 *')
    expect(
      fPawn(ctx(plies[2].move, undefined, undefined, 'inaccuracy', plies[2].previous))?.kind,
    ).toBe('fPawn')
  })

  it('notes not castling by move 12', () => {
    const { moves } = parsePgn(
      '1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 Nf6 4. Ng1 Ng8 5. Nc3 Nc6 6. Nb1 Nb8 7. Nc3 Nc6 8. Nb1 Nb8 9. e3 e6 10. Be2 Be7 11. Bf1 Bf8 12. Be2 Be7 *',
    )
    expect(gameNotes(moves, 'w').map((n) => n.kind)).toEqual(['notCastled'])
    expect(gameNotes(moves.slice(0, 10), 'w')).toEqual([])
  })
})

describe('detectLabels', () => {
  it('does not double-count a fork as a hung piece', () => {
    const m = move('4k3/8/8/8/1n6/8/4K3/R7 w - - 0 1', 'e2e1')
    const labels = detectLabels(
      ctx(m, line({ cp: 0 }, ['a1a8']), line({ cp: -500 }, ['b4c2', 'e1d2', 'c2a1']), 'blunder'),
    )
    expect(labels.map((l) => l.kind)).toEqual(['allowedFork'])
  })
})
