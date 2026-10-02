import type { Color, Grade, Score } from './winprob'

/** Bump when analysis output changes so stored games get re-analysed. */
export const ANALYSIS_VERSION = 1

export type LabelKind =
  | 'missedMate'
  | 'allowedMate'
  | 'allowedFork'
  | 'missedFork'
  | 'hungPiece'
  | 'missedFreePiece'
  | 'rushed'
  | 'earlyQueen'
  | 'samePieceTwice'
  | 'fPawn'
  | 'notCastled'

/** Opening habits worth pointing out even when the engine barely punishes them. */
export const TIP_KINDS: ReadonlySet<LabelKind> = new Set([
  'earlyQueen',
  'samePieceTwice',
  'fPawn',
  'notCastled',
])

export interface Label {
  kind: LabelKind
  /** One plain-language sentence for a beginner. */
  text: string
}

export type Phase = 'opening' | 'middlegame' | 'endgame'

export interface AnalyzedMove {
  ply: number
  moveNumber: number
  color: Color
  san: string
  uci: string
  fenBefore: string
  fenAfter: string
  /** Evaluation (White's view) before and after the move. */
  evalBefore: Score
  evalAfter: Score
  /** Engine's preferred move in the position before this move. */
  bestUci?: string
  bestSan?: string
  /** Win % the mover gave away (0–100). */
  lost: number
  grade: Grade
  labels: Label[]
  phase: Phase
  clock?: number
  timeSpent?: number
}

export interface GameAnalysis {
  gameId: string
  version: number
  depth: number
  analyzedAt: number
  moves: AnalyzedMove[]
  accuracy: Record<Color, number>
  /** Counts for the user's own moves. */
  summary: { inaccuracy: number; mistake: number; blunder: number }
  /** Game-level observations, e.g. not castling. */
  notes: Label[]
}
