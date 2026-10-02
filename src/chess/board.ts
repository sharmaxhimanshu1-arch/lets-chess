import { Chess, type Move, type PieceSymbol, type Square } from 'chess.js'
import type { Color } from '../analysis/winprob'

export const PIECE_VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

export const PIECE_NAME: Record<PieceSymbol, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
}

export function opposite(color: Color): Color {
  return color === 'w' ? 'b' : 'w'
}

export function sideToMove(fen: string): Color {
  return fen.split(' ')[1] === 'b' ? 'b' : 'w'
}

/** Material for `color` minus material for the opponent, in pawns. */
export function materialBalance(chess: Chess, color: Color): number {
  let balance = 0
  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece) continue
      balance += piece.color === color ? PIECE_VALUE[piece.type] : -PIECE_VALUE[piece.type]
    }
  }
  return balance
}

/** Non-pawn, non-king material on the board for both sides together. */
export function pieceMaterial(chess: Chess): number {
  let total = 0
  for (const row of chess.board()) {
    for (const piece of row) {
      if (piece && piece.type !== 'p') total += PIECE_VALUE[piece.type]
    }
  }
  return total
}

/** Plays a UCI move ("e2e4", "e7e8q") and returns it, or null if it is illegal. */
export function playUci(chess: Chess, uci: string): Move | null {
  try {
    return chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci[4] : undefined,
    })
  } catch {
    return null
  }
}

export function uciToSan(fen: string, uci: string): string | null {
  return playUci(new Chess(fen), uci)?.san ?? null
}

export function moveToUci(move: Pick<Move, 'from' | 'to' | 'promotion'>): string {
  return move.from + move.to + (move.promotion ?? '')
}

export interface LineOutcome {
  /** Material change for the given colour, in pawns, once the captures in the line settle. */
  gain: number
  /** Moves played from the line before it settled. */
  moves: Move[]
}

/**
 * Plays an engine line from `fen` and measures how material changes for `color`.
 * The line is followed while captures keep coming, so a trade (I take, you take
 * back) counts as even and an unanswered capture counts as a loss.
 */
export function settleLine(
  fen: string,
  pv: readonly string[],
  color: Color,
  maxPlies = 8,
): LineOutcome {
  const chess = new Chess(fen)
  const start = materialBalance(chess, color)
  const moves: Move[] = []
  for (let i = 0; i < Math.min(pv.length, maxPlies); i++) {
    const move = playUci(chess, pv[i])
    if (!move) break
    moves.push(move)
    const next = pv[i + 1]
    if (!next || !isCapture(chess, next)) break
  }
  return { gain: materialBalance(chess, color) - start, moves }
}

function isCapture(chess: Chess, uci: string): boolean {
  const target = chess.get(uci.slice(2, 4) as Square)
  if (target) return true
  // En passant: a pawn moving diagonally onto an empty square.
  const mover = chess.get(uci.slice(0, 2) as Square)
  return mover?.type === 'p' && uci[0] !== uci[2]
}

export interface ForkInfo {
  attacker: { type: PieceSymbol; square: Square }
  targets: { type: PieceSymbol; square: Square }[]
}

/**
 * After `uci` is played from `fen`, does the moved piece attack two or more enemy
 * pieces that are each either the king, worth more than the attacker, or undefended?
 */
export function detectFork(fen: string, uci: string): ForkInfo | null {
  const chess = new Chess(fen)
  const move = playUci(chess, uci)
  if (!move) return null
  const us = move.color
  const them = opposite(us)
  const attackerSquare = move.to
  const attackerType = move.promotion ?? move.piece
  // A piece that can simply be taken for free is not a real fork.
  if (
    chess.attackers(attackerSquare, them).length > 0 &&
    chess.attackers(attackerSquare, us).length === 0
  ) {
    return null
  }
  const targets: ForkInfo['targets'] = []
  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece || piece.color !== them) continue
      if (!chess.attackers(piece.square, us).includes(attackerSquare)) continue
      const valuable =
        piece.type === 'k' ||
        PIECE_VALUE[piece.type] > PIECE_VALUE[attackerType] ||
        (piece.type !== 'p' && chess.attackers(piece.square, them).length === 0)
      if (valuable) targets.push({ type: piece.type, square: piece.square })
    }
  }
  return targets.length >= 2
    ? { attacker: { type: attackerType, square: attackerSquare }, targets }
    : null
}
