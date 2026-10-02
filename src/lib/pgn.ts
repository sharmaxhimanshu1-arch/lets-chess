import { Chess, DEFAULT_POSITION } from 'chess.js'
import type { Color } from '../analysis/winprob'
import { moveToUci } from '../chess/board'

export interface ParsedMove {
  /** 1-based half-move index. */
  ply: number
  /** Full-move number as printed in the PGN ("12" for 12. Nf3 and 12... Nc6). */
  moveNumber: number
  color: Color
  san: string
  uci: string
  fenBefore: string
  fenAfter: string
  /** Seconds left on the mover's clock after the move, from `[%clk]`. */
  clock?: number
  /** Seconds the mover spent on this move (increment taken into account). */
  timeSpent?: number
}

export interface ParsedGame {
  headers: Record<string, string>
  startFen: string
  moves: ParsedMove[]
}

/** "0:09:58.5" → 598.5 seconds. */
export function parseClock(text: string): number | null {
  const parts = text.split(':').map(Number)
  if (parts.length === 0 || parts.some(Number.isNaN)) return null
  return parts.reduce((total, part) => total * 60 + part, 0)
}

/** "600+5" → { base: 600, increment: 5 }. Daily games ("1/86400") return null. */
export function parseTimeControl(
  tc: string | undefined,
): { base: number; increment: number } | null {
  const match = tc?.match(/^(\d+)(?:\+(\d+))?$/)
  if (!match) return null
  return { base: Number(match[1]), increment: Number(match[2] ?? 0) }
}

function extractClocks(pgn: string): number[] {
  const clocks: number[] = []
  for (const match of pgn.matchAll(/\[%clk\s+([\d:.]+)\]/g)) {
    const seconds = parseClock(match[1])
    if (seconds !== null) clocks.push(seconds)
  }
  return clocks
}

export function parsePgn(pgn: string): ParsedGame {
  const chess = new Chess()
  chess.loadPgn(pgn)
  const headers = Object.fromEntries(
    Object.entries(chess.getHeaders()).filter((entry): entry is [string, string] => !!entry[1]),
  )
  const startFen = headers.FEN ?? DEFAULT_POSITION
  const history = chess.history({ verbose: true })

  // Chess.com writes exactly one [%clk] per move; ignore clocks if that doesn't hold.
  const clocks = extractClocks(pgn)
  const hasClocks = clocks.length === history.length
  const tc = parseTimeControl(headers.TimeControl)

  const moves = history.map((move, i): ParsedMove => {
    const [, , , , , fullMove] = move.before.split(' ')
    const parsed: ParsedMove = {
      ply: i + 1,
      moveNumber: Number(fullMove),
      color: move.color,
      san: move.san,
      uci: moveToUci(move),
      fenBefore: move.before,
      fenAfter: move.after,
    }
    if (hasClocks) {
      parsed.clock = clocks[i]
      const previous = i >= 2 ? clocks[i - 2] : tc?.base
      if (previous !== undefined) {
        parsed.timeSpent = Math.max(0, previous - clocks[i] + (tc?.increment ?? 0))
      }
    }
    return parsed
  })

  return { headers, startFen, moves }
}

/** "https://www.chess.com/openings/Italian-Game-Two-Knights-Defense" → "Italian Game Two Knights Defense". */
export function openingName(headers: Record<string, string>): string | undefined {
  const url = headers.ECOUrl
  if (url) {
    const slug = url.split('/').pop()
    if (slug) return decodeURIComponent(slug).replace(/-/g, ' ')
  }
  return headers.Opening ?? headers.ECO
}
