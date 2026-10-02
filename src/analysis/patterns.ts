// Rule-based detectors that explain *why* a move was bad in beginner terms.
// Each detector is a pure function of the move and the engine's best lines.

import { Chess } from 'chess.js'
import { detectFork, PIECE_NAME, pieceMaterial, settleLine, uciToSan } from '../chess/board'
import type { ParsedMove } from '../lib/pgn'
import type { EngineLine } from '../engine/uci'
import type { Label, Phase } from './types'
import type { Color, Grade, Score } from './winprob'

export interface MoveContext {
  move: ParsedMove
  /** Engine's best line in the position before the move (mover to play). */
  before?: EngineLine
  /** Engine's best line in the position after the move (opponent to play). */
  after?: EngineLine
  grade: Grade
  /** All earlier moves in the game, both colours. */
  previous: readonly ParsedMove[]
}

const MATE_HORIZON = 3

function isMistake(grade: Grade) {
  return grade === 'mistake' || grade === 'blunder'
}

function isSlip(grade: Grade) {
  return grade === 'inaccuracy' || isMistake(grade)
}

/** Moves until mate for `color` (positive), mate against `color` (negative), or null. */
function mateFor(score: Score | undefined, color: Color): number | null {
  if (!score || !('mate' in score)) return null
  return color === 'w' ? score.mate : -score.mate
}

function listNames(names: string[]): string {
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

export function missedMate({ move, before, after }: MoveContext): Label | null {
  const mate = mateFor(before?.score, move.color)
  if (!before || mate === null || mate < 1 || mate > MATE_HORIZON) return null
  if (move.uci === before.pv[0]) return null
  const stillMating = mateFor(after?.score, move.color)
  if (stillMating !== null && stillMating > 0) return null
  if (move.san.endsWith('#')) return null
  const best = uciToSan(move.fenBefore, before.pv[0])
  return {
    kind: 'missedMate',
    text:
      mate === 1
        ? `Missed checkmate: ${best} was mate in one.`
        : `Missed a forced mate in ${mate}, starting with ${best}.`,
  }
}

export function allowedMate({ move, before, after }: MoveContext): Label | null {
  const against = mateFor(after?.score, move.color)
  if (!after?.pv[0] || against === null || -against < 1 || -against > MATE_HORIZON) return null
  const alreadyLost = mateFor(before?.score, move.color)
  if (alreadyLost !== null && alreadyLost < 0) return null
  const reply = uciToSan(move.fenAfter, after.pv[0])
  const n = -against
  return {
    kind: 'allowedMate',
    text:
      n === 1
        ? `Allowed checkmate: your opponent can play ${reply}.`
        : `Allowed a forced mate in ${n}, starting with ${reply}.`,
  }
}

export function allowedFork({ move, after, grade }: MoveContext): Label | null {
  if (!isMistake(grade) || !after?.pv[0]) return null
  const fork = detectFork(move.fenAfter, after.pv[0])
  if (!fork) return null
  const reply = uciToSan(move.fenAfter, after.pv[0])
  const targets = listNames(fork.targets.map((t) => PIECE_NAME[t.type]))
  return {
    kind: 'allowedFork',
    text: `Allowed a fork: ${reply} attacks your ${targets} at the same time.`,
  }
}

export function missedFork({ move, before, grade }: MoveContext): Label | null {
  if (!isMistake(grade) || !before?.pv[0] || move.uci === before.pv[0]) return null
  const fork = detectFork(move.fenBefore, before.pv[0])
  if (!fork) return null
  const best = uciToSan(move.fenBefore, before.pv[0])
  const targets = listNames(fork.targets.map((t) => PIECE_NAME[t.type]))
  return {
    kind: 'missedFork',
    text: `Missed a fork: ${best} would attack their ${targets} at once.`,
  }
}

/** Material the mover ends up with after the move and the opponent's best reply line. */
function playedOutcome({ move, after }: MoveContext) {
  return settleLine(move.fenBefore, [move.uci, ...(after?.pv ?? [])], move.color)
}

export function hungPiece(ctx: MoveContext): Label | null {
  const { move, before, grade } = ctx
  if (!isMistake(grade) || !before) return null
  const played = playedOutcome(ctx)
  const best = settleLine(move.fenBefore, before.pv, move.color)
  if (played.gain > -2 || best.gain - played.gain < 2) return null
  const capture = played.moves.find((m) => m.color !== move.color && m.captured)
  if (!capture?.captured) return null
  const piece = PIECE_NAME[capture.captured]
  return {
    kind: 'hungPiece',
    text:
      capture.to === move.uci.slice(2, 4)
        ? `Hung your ${piece}: after ${move.san}, ${capture.san} takes it.`
        : `Hung your ${piece} on ${capture.to}: ${capture.san} takes it.`,
  }
}

export function missedFreePiece(ctx: MoveContext): Label | null {
  const { move, before, grade } = ctx
  if (!isMistake(grade) || !before?.pv[0] || move.uci === before.pv[0]) return null
  const best = settleLine(move.fenBefore, before.pv, move.color)
  const first = best.moves[0]
  if (!first?.captured || best.gain < 2) return null
  const played = playedOutcome(ctx)
  if (best.gain - played.gain < 2) return null
  return {
    kind: 'missedFreePiece',
    text: `Missed a free ${PIECE_NAME[first.captured]}: ${first.san} wins it.`,
  }
}

export function rushed({ move, grade }: MoveContext): Label | null {
  if (!isMistake(grade) || move.timeSpent === undefined || move.clock === undefined) return null
  if (move.timeSpent >= 5 || move.clock <= 180) return null
  const minutes = Math.floor(move.clock / 60)
  return {
    kind: 'rushed',
    text: `Played in ${Math.round(move.timeSpent)}s with ${minutes} minutes left. Take your time on moves like this.`,
  }
}

function castled(moves: readonly ParsedMove[], color: Color) {
  return moves.some((m) => m.color === color && m.san.startsWith('O-O'))
}

export function earlyQueen({ move, previous }: MoveContext): Label | null {
  if (!move.san.startsWith('Q') || move.moveNumber > 5) return null
  if (previous.some((m) => m.color === move.color && m.san.startsWith('Q'))) return null
  return {
    kind: 'earlyQueen',
    text: 'Early queen move. Develop your knights and bishops first so the queen doesn’t get chased.',
  }
}

const MINOR_HOMES: Record<Color, string[]> = {
  w: ['b1', 'g1', 'c1', 'f1'],
  b: ['b8', 'g8', 'c8', 'f8'],
}

export function samePieceTwice({ move, previous, grade }: MoveContext): Label | null {
  if (!isSlip(grade) || move.moveNumber > 8 || move.san.includes('x')) return null
  if (move.san.startsWith('O-O') || /^[a-h]/.test(move.san)) return null
  const from = move.uci.slice(0, 2)
  const mine = previous.filter((m) => m.color === move.color)
  if (!mine.some((m) => m.uci.slice(2, 4) === from)) return null
  const board = new Chess(move.fenBefore)
  const atHome = MINOR_HOMES[move.color].filter((sq) => {
    const piece = board.get(sq as Parameters<Chess['get']>[0])
    return piece?.color === move.color && (piece.type === 'n' || piece.type === 'b')
  })
  if (atHome.length < 2) return null
  return {
    kind: 'samePieceTwice',
    text: 'Moved the same piece twice while other pieces are still at home. Develop a new piece instead.',
  }
}

export function fPawn({ move, previous, grade }: MoveContext): Label | null {
  if (!isSlip(grade) || move.moveNumber > 10 || !/^f[1-8]/.test(move.san)) return null
  if (castled(previous, move.color)) return null
  return {
    kind: 'fPawn',
    text: 'Early f-pawn move. It opens the diagonal to your king, so keep it home until you castle.',
  }
}

const DETECTORS = [
  missedMate,
  allowedMate,
  allowedFork,
  missedFork,
  hungPiece,
  missedFreePiece,
  rushed,
  earlyQueen,
  samePieceTwice,
  fPawn,
]

export function detectLabels(ctx: MoveContext): Label[] {
  const labels = DETECTORS.map((detect) => detect(ctx)).filter((l): l is Label => l !== null)
  const kinds = new Set(labels.map((l) => l.kind))
  // A mate or fork already explains the material loss, so don't also list it.
  const explained = kinds.has('allowedMate') || kinds.has('allowedFork')
  return labels.filter((l) => !(explained && l.kind === 'hungPiece'))
}

/** Game-level notes for the user's side. */
export function gameNotes(moves: readonly ParsedMove[], color: Color): Label[] {
  const reachedMove12 = moves.some((m) => m.color === color && m.moveNumber >= 12)
  const castledBy12 = moves.some(
    (m) => m.color === color && m.moveNumber <= 12 && m.san.startsWith('O-O'),
  )
  return reachedMove12 && !castledBy12
    ? [
        {
          kind: 'notCastled',
          text: 'You hadn’t castled by move 12. Castle early to keep your king safe.',
        },
      ]
    : []
}

export function phaseOf(move: ParsedMove): Phase {
  if (move.moveNumber <= 10) return 'opening'
  return pieceMaterial(new Chess(move.fenBefore)) <= 26 ? 'endgame' : 'middlegame'
}
