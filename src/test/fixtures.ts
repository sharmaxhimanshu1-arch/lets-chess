import type { ChessComGame } from '../lib/chesscom'

// Hand-written games in the exact shape of Chess.com's public API, for offline tests.

const headers = (o: Record<string, string>) =>
  Object.entries(o)
    .map(([k, v]) => `[${k} "${v}"]`)
    .join('\n')

/** Rapid, user is Black, mated by Scholar's Mate (3...Nf6?? allows Qxf7#). */
export const SCHOLARS_MATE_PGN = `${headers({
  Event: 'Live Chess',
  Site: 'Chess.com',
  Date: '2026.09.20',
  White: 'quickmate99',
  Black: 'testplayer',
  Result: '1-0',
  ECO: 'C23',
  ECOUrl: 'https://www.chess.com/openings/Bishops-Opening',
  UTCDate: '2026.09.20',
  UTCTime: '18:01:02',
  WhiteElo: '812',
  BlackElo: '795',
  TimeControl: '600',
  Termination: 'quickmate99 won by checkmate',
  Link: 'https://www.chess.com/game/live/1001',
})}

1. e4 {[%clk 0:09:58.1]} 1... e5 {[%clk 0:09:57.0]} 2. Bc4 {[%clk 0:09:55.2]} 2... Nc6 {[%clk 0:09:50.3]} 3. Qh5 {[%clk 0:09:52.0]} 3... Nf6 {[%clk 0:09:47.9]} 4. Qxf7# {[%clk 0:09:49.5]} 1-0
`

/** Rapid 10+5, user is White and hangs the queen with 3. Qxe5+?? Nxe5. */
export const HUNG_QUEEN_PGN = `${headers({
  Event: 'Live Chess',
  Site: 'Chess.com',
  Date: '2026.09.21',
  White: 'testplayer',
  Black: 'knightrider',
  Result: '0-1',
  ECO: 'C20',
  ECOUrl: 'https://www.chess.com/openings/Kings-Pawn-Opening-Wayward-Queen-Attack',
  UTCDate: '2026.09.21',
  UTCTime: '10:15:00',
  WhiteElo: '801',
  BlackElo: '830',
  TimeControl: '600+5',
  Termination: 'knightrider won by resignation',
  Link: 'https://www.chess.com/game/live/1002',
})}

1. e4 {[%clk 0:10:03]} 1... e5 {[%clk 0:10:02]} 2. Qh5 {[%clk 0:10:01]} 2... Nc6 {[%clk 0:09:58]} 3. Qxe5+ {[%clk 0:10:04]} 3... Nxe5 {[%clk 0:09:50]} 4. d4 {[%clk 0:09:30]} 4... Nc6 {[%clk 0:09:45]} 5. d5 {[%clk 0:09:20]} 5... Nd4 {[%clk 0:09:40]} 0-1
`

const BLITZ_PGN = `[White "testplayer"]\n[Black "someone"]\n[Result "1/2-1/2"]\n\n1. d4 d5 1/2-1/2\n`

function game(
  partial: Partial<ChessComGame> & Pick<ChessComGame, 'url' | 'end_time'>,
): ChessComGame {
  return {
    time_control: '600',
    rated: true,
    time_class: 'rapid',
    rules: 'chess',
    white: { username: 'testplayer', rating: 800, result: 'win' },
    black: { username: 'opponent', rating: 800, result: 'resigned' },
    ...partial,
  }
}

export const ARCHIVES = {
  archives: [
    'https://api.chess.com/pub/player/testplayer/games/2026/08',
    'https://api.chess.com/pub/player/testplayer/games/2026/09',
  ],
}

export const MONTH_2026_09 = {
  games: [
    game({
      url: 'https://www.chess.com/game/live/1001',
      end_time: 1790000000,
      pgn: SCHOLARS_MATE_PGN,
      white: { username: 'quickmate99', rating: 812, result: 'win' },
      black: { username: 'Testplayer', rating: 795, result: 'checkmated' },
    }),
    game({
      url: 'https://www.chess.com/game/live/1002',
      end_time: 1790100000,
      time_control: '600+5',
      pgn: HUNG_QUEEN_PGN,
      white: { username: 'testplayer', rating: 801, result: 'resigned' },
      black: { username: 'knightrider', rating: 830, result: 'win' },
    }),
    game({
      url: 'https://www.chess.com/game/live/1003',
      end_time: 1790200000,
      time_class: 'blitz',
      time_control: '180',
      pgn: BLITZ_PGN,
    }),
    game({
      url: 'https://www.chess.com/game/daily/1004',
      end_time: 1790300000,
      rules: 'chess960',
      pgn: BLITZ_PGN,
    }),
  ],
}

export const MONTH_2026_08 = {
  games: [
    game({
      url: 'https://www.chess.com/game/live/900',
      end_time: 1787000000,
      pgn: BLITZ_PGN,
      white: { username: 'testplayer', rating: 790, result: 'agreed' },
      black: { username: 'opponent', rating: 805, result: 'agreed' },
    }),
  ],
}

/** A fake `fetch` serving the fixtures above; records requested URLs. */
export function fakeChessComFetch(routes: Record<string, unknown> = defaultRoutes()) {
  const requested: string[] = []
  const fetchFn = async (url: string) => {
    requested.push(url)
    const body = routes[url]
    return body === undefined
      ? new Response('not found', { status: 404 })
      : new Response(JSON.stringify(body), { status: 200 })
  }
  return { fetchFn, requested }
}

function defaultRoutes(): Record<string, unknown> {
  return {
    'https://api.chess.com/pub/player/testplayer/games/archives': ARCHIVES,
    [ARCHIVES.archives[1]]: MONTH_2026_09,
    [ARCHIVES.archives[0]]: MONTH_2026_08,
  }
}
