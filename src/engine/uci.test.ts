import { afterAll, describe, expect, it } from 'vitest'
import { createNodeStockfish } from '../test/nodeEngine'
import { parseInfo, toWhitePov } from './uci'

describe('parseInfo', () => {
  it('parses centipawn and mate lines', () => {
    expect(
      parseInfo('info depth 12 seldepth 19 multipv 2 score cp -251 nodes 6244 pv h5e2 c6d4'),
    ).toEqual({ depth: 12, multipv: 2, score: { cp: -251 }, pv: ['h5e2', 'c6d4'] })
    expect(parseInfo('info depth 12 multipv 1 score mate 1 nodes 1 pv h5f7')?.score).toEqual({
      mate: 1,
    })
  })

  it('ignores bound scores and lines without a PV', () => {
    expect(parseInfo('info depth 5 score cp 20 lowerbound nodes 9 pv e2e4')).toBeNull()
    expect(parseInfo('info string NNUE evaluation enabled')).toBeNull()
    expect(parseInfo('info depth 3 currmove e2e4 currmovenumber 1')).toBeNull()
  })

  it('flips scores to White’s point of view when Black is to move', () => {
    expect(toWhitePov({ cp: 50 }, 'b')).toEqual({ cp: -50 })
    expect(toWhitePov({ mate: 2 }, 'b')).toEqual({ mate: -2 })
    expect(toWhitePov({ cp: 50 }, 'w')).toEqual({ cp: 50 })
  })
})

describe('Stockfish over UCI (real engine)', () => {
  const engine = createNodeStockfish()
  afterAll(() => engine.dispose())

  it('finds Qxf7# and reports it as mate for White', async () => {
    const lines = await engine.analyse(
      'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
      { depth: 10, multiPv: 2 },
    )
    expect(lines).toHaveLength(2)
    expect(lines[0].pv[0]).toBe('h5f7')
    expect(lines[0].score).toEqual({ mate: 1 })
  })

  it('reports Black’s winning advantage as negative for White', async () => {
    // Black to move, a queen up (queen on a2, not giving check).
    const [best] = await engine.analyse('4k3/8/8/8/8/8/q7/4K3 b - - 0 1', { depth: 8 })
    expect('mate' in best.score ? best.score.mate < 0 : best.score.cp < -500).toBe(true)
  })
})
