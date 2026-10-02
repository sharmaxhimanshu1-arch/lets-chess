import type { Color } from '../analysis/winprob'
import { openingName, parsePgn } from './pgn'

/** A game as returned by Chess.com's public monthly archive endpoint. */
export interface ChessComGame {
  url: string
  pgn?: string
  time_control: string
  end_time: number
  rated?: boolean
  time_class: string
  rules: string
  eco?: string
  white: ChessComPlayer
  black: ChessComPlayer
}

interface ChessComPlayer {
  username: string
  rating: number
  result: string
}

export type GameResult = 'win' | 'loss' | 'draw'

export interface StoredGame {
  /** Chess.com game URL, or "pgn:<hash>" for pasted games. */
  id: string
  source: 'chesscom' | 'pgn'
  pgn: string
  /** Unix ms. */
  playedAt: number
  timeControl: string
  myColor: Color
  white: { name: string; rating?: number }
  black: { name: string; rating?: number }
  result: GameResult
  /** How the game ended, e.g. "resigned", "checkmated", "timeout". */
  termination?: string
  opening?: string
  url?: string
}

const API = 'https://api.chess.com/pub'
const DRAW_RESULTS = new Set([
  'agreed',
  'repetition',
  'stalemate',
  'insufficient',
  '50move',
  'timevsinsufficient',
])

type FetchFn = (url: string) => Promise<Response>

async function getJson<T>(fetchFn: FetchFn, url: string): Promise<T> {
  const res = await fetchFn(url)
  if (res.status === 404) throw new Error('Chess.com user not found. Check the username.')
  if (!res.ok) throw new Error(`Chess.com request failed (${res.status}). Try again in a minute.`)
  return (await res.json()) as T
}

/** "…/games/2024/03" → "2024/03"; sorts chronologically as a string. */
export function archiveMonth(archiveUrl: string): string {
  return archiveUrl.split('/').slice(-2).join('/')
}

export function isRapidStandard(game: ChessComGame): boolean {
  return game.rules === 'chess' && game.time_class === 'rapid' && !!game.pgn
}

export function toStoredGame(game: ChessComGame, username: string): StoredGame | null {
  if (!game.pgn) return null
  const me = username.toLowerCase()
  const myColor: Color | null =
    game.white.username.toLowerCase() === me
      ? 'w'
      : game.black.username.toLowerCase() === me
        ? 'b'
        : null
  if (!myColor) return null
  const mine = myColor === 'w' ? game.white : game.black
  const theirs = myColor === 'w' ? game.black : game.white
  const result: GameResult =
    mine.result === 'win' ? 'win' : DRAW_RESULTS.has(mine.result) ? 'draw' : 'loss'
  const { headers } = parsePgn(game.pgn)
  return {
    id: game.url,
    source: 'chesscom',
    pgn: game.pgn,
    playedAt: game.end_time * 1000,
    timeControl: game.time_control,
    myColor,
    white: { name: game.white.username, rating: game.white.rating },
    black: { name: game.black.username, rating: game.black.rating },
    result,
    termination: result === 'win' ? theirs.result : mine.result,
    opening: openingName(headers),
    url: game.url,
  }
}

export interface FetchGamesOptions {
  /** Last archive month already imported ("2024/03"); that month and later ones are re-fetched. */
  sinceMonth?: string
  /** On a first import, keep walking back through months until this many rapid games are found. */
  minGames?: number
  fetchFn?: FetchFn
  onProgress?: (message: string) => void
}

export interface FetchGamesResult {
  games: StoredGame[]
  /** Newest archive month seen, to pass back as `sinceMonth` next time. */
  latestMonth?: string
}

export async function fetchRapidGames(
  username: string,
  { sinceMonth, minGames = 100, fetchFn = fetch, onProgress }: FetchGamesOptions = {},
): Promise<FetchGamesResult> {
  const user = encodeURIComponent(username.trim().toLowerCase())
  const { archives } = await getJson<{ archives: string[] }>(
    fetchFn,
    `${API}/player/${user}/games/archives`,
  )
  const newestFirst = [...archives].sort((a, b) => archiveMonth(b).localeCompare(archiveMonth(a)))
  const games: StoredGame[] = []

  for (const archive of newestFirst) {
    const month = archiveMonth(archive)
    if (sinceMonth ? month < sinceMonth : games.length >= minGames) break
    onProgress?.(`Fetching ${month}…`)
    const { games: monthGames } = await getJson<{ games: ChessComGame[] }>(fetchFn, archive)
    for (const game of monthGames) {
      if (!isRapidStandard(game)) continue
      const stored = toStoredGame(game, username)
      if (stored) games.push(stored)
    }
  }

  return {
    games: games.sort((a, b) => b.playedAt - a.playedAt),
    latestMonth: newestFirst[0] ? archiveMonth(newestFirst[0]) : sinceMonth,
  }
}

/** Builds a game record from a pasted PGN, working out which side the user played. */
export function gameFromPgn(pgn: string, username: string): StoredGame {
  const { headers, moves } = parsePgn(pgn)
  if (moves.length === 0) throw new Error('That PGN has no moves.')
  const me = username.trim().toLowerCase()
  const white = headers.White ?? 'White'
  const black = headers.Black ?? 'Black'
  const myColor: Color = black.toLowerCase() === me ? 'b' : 'w'
  const outcome = headers.Result
  const result: GameResult =
    outcome === '1/2-1/2' ? 'draw' : outcome === (myColor === 'w' ? '1-0' : '0-1') ? 'win' : 'loss'
  const date = (headers.UTCDate ?? headers.Date ?? '').replace(/\./g, '-')
  const playedAt = Date.parse(`${date}T${headers.UTCTime ?? '00:00:00'}Z`)
  return {
    id: `pgn:${hash(pgn)}`,
    source: 'pgn',
    pgn,
    playedAt: Number.isNaN(playedAt) ? Date.now() : playedAt,
    timeControl: headers.TimeControl ?? '-',
    myColor,
    white: { name: white, rating: Number(headers.WhiteElo) || undefined },
    black: { name: black, rating: Number(headers.BlackElo) || undefined },
    result,
    termination: headers.Termination,
    opening: openingName(headers),
    url: headers.Link,
  }
}

function hash(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}
