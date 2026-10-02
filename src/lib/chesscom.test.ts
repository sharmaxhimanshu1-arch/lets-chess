import { describe, expect, it } from 'vitest'
import { ARCHIVES, fakeChessComFetch, HUNG_QUEEN_PGN } from '../test/fixtures'
import { archiveMonth, fetchRapidGames, gameFromPgn } from './chesscom'

describe('fetchRapidGames', () => {
  it('keeps only standard rapid games, newest first, matching the username case-insensitively', async () => {
    const { fetchFn } = fakeChessComFetch()
    const { games, latestMonth } = await fetchRapidGames('TestPlayer', { fetchFn, minGames: 1 })
    expect(games.map((g) => g.id)).toEqual([
      'https://www.chess.com/game/live/1002',
      'https://www.chess.com/game/live/1001',
    ])
    expect(latestMonth).toBe('2026/09')
    expect(games[1]).toMatchObject({
      myColor: 'b',
      result: 'loss',
      termination: 'checkmated',
      opening: 'Bishops Opening',
      white: { name: 'quickmate99', rating: 812 },
    })
    expect(games[0]).toMatchObject({ myColor: 'w', result: 'loss', timeControl: '600+5' })
  })

  it('stops walking back once enough games are found on a first import', async () => {
    const { fetchFn, requested } = fakeChessComFetch()
    await fetchRapidGames('testplayer', { fetchFn, minGames: 2 })
    expect(requested).not.toContain(ARCHIVES.archives[0])
  })

  it('walks back further when it needs more games, and maps draws', async () => {
    const { fetchFn, requested } = fakeChessComFetch()
    const { games } = await fetchRapidGames('testplayer', { fetchFn, minGames: 10 })
    expect(requested).toContain(ARCHIVES.archives[0])
    expect(games.at(-1)).toMatchObject({ result: 'draw', termination: 'agreed' })
  })

  it('only re-fetches the last imported month and newer on later imports', async () => {
    const { fetchFn, requested } = fakeChessComFetch()
    await fetchRapidGames('testplayer', { fetchFn, sinceMonth: '2026/09', minGames: 999 })
    expect(requested).toEqual([
      'https://api.chess.com/pub/player/testplayer/games/archives',
      ARCHIVES.archives[1],
    ])
  })

  it('reports an unknown user clearly', async () => {
    const { fetchFn } = fakeChessComFetch({})
    await expect(fetchRapidGames('nobody', { fetchFn })).rejects.toThrow(/not found/)
  })
})

describe('gameFromPgn', () => {
  it('works out the user’s colour and result from headers', () => {
    const game = gameFromPgn(HUNG_QUEEN_PGN, 'testplayer')
    expect(game).toMatchObject({ source: 'pgn', myColor: 'w', result: 'loss' })
    expect(game.id).toMatch(/^pgn:/)
    expect(new Date(game.playedAt).toISOString()).toBe('2026-09-21T10:15:00.000Z')
  })

  it('extracts the archive month from its URL', () => {
    expect(archiveMonth(ARCHIVES.archives[0])).toBe('2026/08')
  })
})
