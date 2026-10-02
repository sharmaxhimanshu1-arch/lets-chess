import { Chess } from 'chess.js'
import { uciToSan } from '../chess/board'
import type { Engine, EngineLine } from '../engine/uci'
import type { StoredGame } from '../lib/chesscom'
import { parsePgn } from '../lib/pgn'
import { detectLabels, gameNotes, phaseOf } from './patterns'
import { ANALYSIS_VERSION, type AnalyzedMove, type GameAnalysis } from './types'
import { gameAccuracy, gradeMove, winPercentLost, type Color } from './winprob'

export interface AnalyzeOptions {
  depth: number
  onProgress?: (done: number, total: number) => void
  signal?: AbortSignal
}

/** Evaluation for positions the engine can't search (checkmate, stalemate, draws). */
function terminalLine(fen: string): EngineLine | null {
  const chess = new Chess(fen)
  if (chess.isCheckmate()) {
    // The side to move has been mated.
    return { score: { cp: chess.turn() === 'w' ? -10_000 : 10_000 }, pv: [], depth: 0 }
  }
  if (chess.isGameOver()) return { score: { cp: 0 }, pv: [], depth: 0 }
  return null
}

export async function analyzeGame(
  game: StoredGame,
  engine: Engine,
  { depth, onProgress, signal }: AnalyzeOptions,
): Promise<GameAnalysis> {
  const { startFen, moves } = parsePgn(game.pgn)
  const fens = [startFen, ...moves.map((m) => m.fenAfter)]
  const lines: EngineLine[] = []

  for (const [i, fen] of fens.entries()) {
    signal?.throwIfAborted()
    const line = terminalLine(fen) ??
      (await engine.analyse(fen, { depth }))[0] ?? { score: { cp: 0 }, pv: [], depth: 0 }
    lines.push(line)
    onProgress?.(i + 1, fens.length)
  }

  const analyzed = moves.map((move, i): AnalyzedMove => {
    const before = lines[i]
    const after = lines[i + 1]
    const bestUci = before.pv[0]
    const lost = winPercentLost(before.score, after.score, move.color)
    const grade = gradeMove(lost, move.uci === bestUci)
    const labels =
      move.color === game.myColor
        ? detectLabels({ move, before, after, grade, previous: moves.slice(0, i) })
        : []
    return {
      ply: move.ply,
      moveNumber: move.moveNumber,
      color: move.color,
      san: move.san,
      uci: move.uci,
      fenBefore: move.fenBefore,
      fenAfter: move.fenAfter,
      evalBefore: before.score,
      evalAfter: after.score,
      bestUci,
      bestSan: bestUci ? (uciToSan(move.fenBefore, bestUci) ?? undefined) : undefined,
      lost,
      grade,
      labels,
      phase: phaseOf(move),
      clock: move.clock,
      timeSpent: move.timeSpent,
    }
  })

  const accuracyFor = (color: Color) =>
    gameAccuracy(analyzed.filter((m) => m.color === color).map((m) => m.lost))
  const mine = analyzed.filter((m) => m.color === game.myColor)
  const count = (grade: AnalyzedMove['grade']) => mine.filter((m) => m.grade === grade).length

  return {
    gameId: game.id,
    version: ANALYSIS_VERSION,
    depth,
    analyzedAt: Date.now(),
    moves: analyzed,
    accuracy: { w: accuracyFor('w'), b: accuracyFor('b') },
    summary: {
      inaccuracy: count('inaccuracy'),
      mistake: count('mistake'),
      blunder: count('blunder'),
    },
    notes: gameNotes(moves, game.myColor),
  }
}
