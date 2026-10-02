import { afterAll, describe, expect, it } from 'vitest'
import { gameFromPgn } from '../lib/chesscom'
import { createEnginePool } from '../engine/pool'
import { createNodeStockfish } from '../test/nodeEngine'
import { HUNG_QUEEN_PGN, SCHOLARS_MATE_PGN } from '../test/fixtures'
import { analyzeGame } from './analyzeGame'

describe('analyzeGame (real engine)', () => {
  // Two engines, as in the browser, so positions are analysed out of order.
  const engine = createEnginePool(2, createNodeStockfish)
  afterAll(() => engine.dispose())

  it('explains a Scholar’s Mate loss', async () => {
    const game = gameFromPgn(SCHOLARS_MATE_PGN, 'testplayer')
    const progress: number[] = []
    const analysis = await analyzeGame(game, engine, {
      depth: 10,
      onProgress: (done) => progress.push(done),
    })
    expect(progress.at(-1)).toBe(8) // start position + 7 moves

    const nf6 = analysis.moves[5]
    expect(nf6.san).toBe('Nf6')
    expect(nf6.grade).toBe('blunder')
    expect(nf6.labels.map((l) => l.kind)).toContain('allowedMate')

    const mate = analysis.moves[6]
    expect(mate.san).toBe('Qxf7#')
    expect(mate.grade).toBe('best')
    expect(analysis.summary.blunder).toBe(1)
    expect(analysis.accuracy.w).toBeGreaterThan(analysis.accuracy.b)
  })

  it('explains hanging the queen', async () => {
    const game = gameFromPgn(HUNG_QUEEN_PGN, 'testplayer')
    const analysis = await analyzeGame(game, engine, { depth: 10 })
    const qxe5 = analysis.moves[4]
    expect(qxe5.san).toBe('Qxe5+')
    expect(qxe5.grade).toBe('blunder')
    expect(qxe5.labels.find((l) => l.kind === 'hungPiece')?.text).toBe(
      'Hung your queen: after Qxe5+, Nxe5 takes it.',
    )
    expect(qxe5.labels.map((l) => l.kind)).toContain('rushed')
    // The opponent's moves are graded but never labelled.
    expect(analysis.moves.filter((m) => m.color === 'b').every((m) => m.labels.length === 0)).toBe(
      true,
    )
    expect(analysis.moves[2].labels.map((l) => l.kind)).toContain('earlyQueen')
  })
})
